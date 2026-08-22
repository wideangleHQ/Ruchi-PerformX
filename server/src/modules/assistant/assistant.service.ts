import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { LeaveService } from '../leave/leave.service';
import { HolidaysService } from '../holidays/holidays.service';
import { TasksService } from '../tasks/tasks.service';
import { ProjectsService } from '../projects/projects.service';
import { VendorsService } from '../vendors/vendors.service';
import { VendorWorkService } from '../vendors/vendor-work.service';
import { RndService } from '../rnd/rnd.service';
import { ScoringService } from '../scoring/scoring.service';
import { HodScoreService } from '../hod-score/hod-score.service';
import { UsersService } from '../users/users.service';
import { DepartmentsService } from '../departments/departments.service';
import { AssetsService } from '../assets/assets.service';

import { ASSISTANT_SYSTEM_PROMPT } from './assistant.prompt';
import {
  AssistantTool,
  ToolDeps,
  toolSchemas,
  toolsFor,
} from './assistant-tools';
import { ChatDto } from './dto/chat.dto';

/**
 * Haiku 4.5. Chosen in `ai-assistant-price-comparison.md`: roughly a tenth of a
 * rupee per question with the tool catalog cached, and a fixed catalog of about
 * thirty tools is well inside its routing range. Move up only if the eval set
 * says tool selection is missing, not on a hunch.
 *
 * No `thinking` and no `output_config.effort`: 4.5 predates adaptive thinking
 * and rejects `effort` outright.
 */
const MODEL = 'claude-haiku-4-5';

/** Answers are a number and a sentence. 2k leaves room for a wide table. */
const MAX_TOKENS = 2048;

/**
 * How many model turns one question may take. A tier 1 question resolves in
 * two: pick a tool, then answer. Three or four happens when the model has to
 * resolve a department name to an id first. Past that it is looping, and a cap
 * is the difference between a slow answer and an unbounded bill.
 */
const MAX_TURNS = 6;

/** Turns of history accepted from the client, per p2_assistant.md. */
const MAX_HISTORY_TURNS = 10;

export type AssistantEvent =
  | { type: 'text'; text: string }
  | { type: 'tool'; name: string }
  | { type: 'done'; exchangeId: string; toolsUsed: string[]; declined: boolean }
  | { type: 'error'; message: string };

/**
 * The tier 1 loop.
 *
 * ```
 *   question + client-held history
 *          |
 *          v
 *   +--------------------------------------------------+
 *   |  messages.stream(model, system+tools, messages)   | <-- cache breakpoint
 *   +---------------------+----------------------------+     on system covers
 *          |              |                                  tools too
 *   text deltas      stop_reason
 *   stream out            |
 *                  +------+------+
 *                  |             |
 *              end_turn       tool_use
 *                  |             |
 *                  v             v
 *              log exchange   run each tool as the caller
 *                                |
 *                                v
 *                          append tool_result, loop (max 6)
 * ```
 *
 * There is no tier 2 here on purpose: no generated SQL, no RLS. Every tool
 * calls a service that already scopes on the caller's `JwtPayload`, so this
 * class adds no authorization of its own beyond `toolsFor`.
 */
@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);
  private readonly client: Anthropic;
  private readonly deps: ToolDeps;

  constructor(
    private readonly prisma: PrismaService,
    leave: LeaveService,
    holidays: HolidaysService,
    tasks: TasksService,
    projects: ProjectsService,
    vendors: VendorsService,
    vendorWork: VendorWorkService,
    rnd: RndService,
    scoring: ScoringService,
    hodScore: HodScoreService,
    users: UsersService,
    departments: DepartmentsService,
    assets: AssetsService,
  ) {
    this.client = new Anthropic();
    this.deps = {
      leave,
      holidays,
      tasks,
      projects,
      vendors,
      vendorWork,
      rnd,
      scoring,
      hodScore,
      users,
      departments,
      assets,
    };
  }

  /**
   * Answer one question, streaming as it goes.
   *
   * `emit` is called for every text delta and every tool call. It never throws
   * back into the loop: the controller owns the transport and a dead socket is
   * its problem, not this method's.
   */
  async ask(
    dto: ChatDto,
    user: JwtPayload,
    emit: (event: AssistantEvent) => void,
  ): Promise<void> {
    const tools = toolsFor(user);
    const byName = new Map(tools.map((tool) => [tool.name, tool]));

    const messages: Anthropic.MessageParam[] = [
      ...this.history(dto),
      { role: 'user', content: this.framedQuestion(dto, user) },
    ];

    const toolsUsed: string[] = [];
    let answer = '';
    let usage = { input: 0, output: 0, cached: 0 };

    try {
      for (let turn = 0; turn < MAX_TURNS; turn += 1) {
        const stream = this.client.messages.stream({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          // Renders before `messages`, and `tools` renders before this, so one
          // breakpoint here caches the prompt and the whole catalog. Nothing
          // that varies per request may move above this line.
          system: [
            {
              type: 'text',
              text: ASSISTANT_SYSTEM_PROMPT,
              cache_control: { type: 'ephemeral' },
            },
          ],
          tools: toolSchemas(tools),
          messages,
        });

        stream.on('text', (delta) => {
          answer += delta;
          emit({ type: 'text', text: delta });
        });

        const message = await stream.finalMessage();
        usage = {
          input: usage.input + message.usage.input_tokens,
          output: usage.output + message.usage.output_tokens,
          cached: usage.cached + (message.usage.cache_read_input_tokens ?? 0),
        };

        if (message.stop_reason !== 'tool_use') break;

        const calls = message.content.filter(
          (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
        );
        messages.push({ role: 'assistant', content: message.content });

        // All results go back in one user message. Splitting them teaches the
        // model to stop calling tools in parallel.
        const results = await Promise.all(
          calls.map((call) => this.runTool(call, byName, user, toolsUsed, emit)),
        );
        messages.push({ role: 'user', content: results });
      }
    } catch (error) {
      const message = this.explain(error);
      this.logger.error(`Assistant failed for ${user.sub}: ${message}`);
      emit({ type: 'error', message });
      return;
    }

    const declined = toolsUsed.length === 0;
    const exchange = await this.log(dto, user, answer, toolsUsed, declined, usage);
    emit({ type: 'done', exchangeId: exchange.id, toolsUsed, declined });
  }

  /**
   * Run one tool call and shape it into a `tool_result`.
   *
   * A tool that throws comes back as `is_error` rather than killing the turn.
   * That is deliberate: a ForbiddenException from a service is information the
   * model should relay ("I can only show you your own department"), not a 500.
   * Dropping the block instead would leave a `tool_use` with no result, which
   * the API rejects on the next request.
   */
  private async runTool(
    call: Anthropic.ToolUseBlock,
    byName: Map<string, AssistantTool>,
    user: JwtPayload,
    toolsUsed: string[],
    emit: (event: AssistantEvent) => void,
  ): Promise<Anthropic.ToolResultBlockParam> {
    const tool = byName.get(call.name);
    if (!tool) {
      // Only reachable if the model invents a name, since the catalog it was
      // given is already filtered to this caller.
      return {
        type: 'tool_result',
        tool_use_id: call.id,
        content: `No tool named ${call.name}.`,
        is_error: true,
      };
    }

    toolsUsed.push(call.name);
    emit({ type: 'tool', name: call.name });

    try {
      const args = (call.input ?? {}) as Record<string, unknown>;
      const rows = await tool.run(args, user, this.deps);
      return {
        type: 'tool_result',
        tool_use_id: call.id,
        content: JSON.stringify(rows ?? null),
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Lookup failed.';
      this.logger.warn(`${call.name} failed for ${user.sub}: ${reason}`);
      return {
        type: 'tool_result',
        tool_use_id: call.id,
        content: reason,
        is_error: true,
      };
    }
  }

  /**
   * The volatile half of the prompt: who is asking, what today is, what they
   * can see. It sits in the user turn rather than the system block because
   * anything that changes per request would invalidate the cached prefix.
   */
  private framedQuestion(dto: ChatDto, user: JwtPayload): string {
    const today = new Date().toISOString().slice(0, 10);
    const page = dto.page_context?.trim();
    return [
      `[context] today ${today}; asking user role ${user.role}${
        page ? `; currently viewing ${page}` : ''
      }`,
      dto.question.trim(),
    ].join('\n');
  }

  /**
   * History as the client holds it, capped and normalised.
   *
   * ponytail: the client sends the turns it already has on screen rather than
   * the server rebuilding them. Nothing reads `assistant_exchanges` on the
   * request path as a result. Forged history cannot widen access, because every
   * tool authorises against the caller's own token rather than against anything
   * in the transcript, so the worst a user can do is confuse their own session.
   */
  private history(dto: ChatDto): Anthropic.MessageParam[] {
    const turns = dto.history ?? [];
    return turns.slice(-MAX_HISTORY_TURNS * 2).map((turn) => ({
      role: turn.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: turn.content,
    }));
  }

  private async log(
    dto: ChatDto,
    user: JwtPayload,
    answer: string,
    toolsUsed: string[],
    declined: boolean,
    usage: { input: number; output: number; cached: number },
  ) {
    return this.prisma.assistant_exchanges.create({
      data: {
        conversation_id: dto.conversation_id,
        user_id: user.sub,
        question: dto.question,
        answer,
        tools_used: toolsUsed,
        declined,
        input_tokens: usage.input,
        output_tokens: usage.output,
        cached_tokens: usage.cached,
      },
      select: { id: true },
    });
  }

  /** Typed chain, most specific first, so a 401 does not read as a 429. */
  private explain(error: unknown): string {
    if (error instanceof Anthropic.AuthenticationError) {
      return 'The assistant is not configured. ANTHROPIC_API_KEY is missing or rejected.';
    }
    if (error instanceof Anthropic.RateLimitError) {
      return 'The assistant is rate limited. Try again in a moment.';
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return 'Could not reach the assistant. Check the connection and retry.';
    }
    if (error instanceof Anthropic.APIError) {
      return `The assistant returned an error (${error.status}).`;
    }
    return 'The assistant failed. The question was not answered.';
  }

  /** Thumbs up or down on one answer. The eval set grows from this column. */
  async recordFeedback(id: string, user: JwtPayload, value: number) {
    const result = await this.prisma.assistant_exchanges.updateMany({
      where: { id, user_id: user.sub },
      data: { feedback: value >= 0 ? 1 : -1 },
    });
    return { updated: result.count };
  }

  /**
   * Questions the assistant could not answer, newest first.
   *
   * This is the tier 2 replacement. The spec's plan was to read a generated-SQL
   * log to decide which tools to add next; with no tier 2 there is no such log,
   * so the declines are the signal instead. A shape that keeps appearing here
   * is the next tool to write.
   */
  async declines(limit: number) {
    return this.prisma.assistant_exchanges.findMany({
      where: { declined: true },
      orderBy: { created_at: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
      select: { id: true, question: true, answer: true, created_at: true },
    });
  }
}
