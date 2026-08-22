import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

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
import { SelfActionsService } from '../self-actions/self-actions.service';

import { ASSISTANT_SYSTEM_PROMPT } from './assistant.prompt';
import { AssistantProvider, resolveProvider } from './assistant.config';
import {
  AssistantTool,
  ToolDeps,
  toolSchemas,
  toolsFor,
} from './assistant-tools';
import { ChatDto } from './dto/chat.dto';

/** Answers are a number and a sentence. 2k leaves room for a wide table. */
const MAX_TOKENS = 2048;

type Msg = OpenAI.Chat.Completions.ChatCompletionMessageParam;

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
  /** Drop everything streamed for this answer so far. Emitted when a turn that
   * was producing prose turns out to have been narrating its way into a tool
   * call: "I'll check the leave calendar..." is not the answer and must not be
   * glued to the front of it. Streaming stays live; the client just discards
   * the turn that was not the answer. */
  | { type: 'reset' }
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
  private readonly client: OpenAI;
  private readonly provider: AssistantProvider;
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
    selfActions: SelfActionsService,
  ) {
    // OpenCode Zen speaks the Anthropic protocol on /v1/messages and
    // authenticates with x-api-key, so the same client reaches either gateway
    // and only the base URL moves. baseURL is undefined for direct Anthropic.
    this.provider = resolveProvider(process.env);
    this.client = new OpenAI({
      apiKey: this.provider.apiKey,
      baseURL: this.provider.baseURL,
      // Zen authenticates with x-api-key. The SDK sends Authorization: Bearer,
      // which Zen also accepts, but both are set so a change at either end does
      // not turn into a 401 nobody can place.
      defaultHeaders: { 'x-api-key': this.provider.apiKey },
    });
    this.logger.log(
      `Assistant on OpenCode Zen, model ${this.provider.model}`,
    );
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
      selfActions,
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

    const messages: Msg[] = [
      { role: 'system', content: ASSISTANT_SYSTEM_PROMPT },
      ...this.history(dto),
      { role: 'user', content: this.framedQuestion(dto, user) },
    ];

    const toolsUsed: string[] = [];
    let answer = '';
    let usage = { input: 0, output: 0, cached: 0 };

    try {
      for (let turn = 0; turn < MAX_TURNS; turn += 1) {
        const stream = this.client.chat.completions.stream({
          model: this.provider.model,
          max_tokens: MAX_TOKENS,
          messages,
          tools: toolSchemas(tools),
        });

        // Text streamed during this turn, kept separately so it can be
        // withdrawn if the turn ends in a tool call.
        let turnText = '';
        stream.on('content', (delta) => {
          turnText += delta;
          emit({ type: 'text', text: delta });
        });

        const completion = await stream.finalChatCompletion();
        usage = {
          input: usage.input + (completion.usage?.prompt_tokens ?? 0),
          output: usage.output + (completion.usage?.completion_tokens ?? 0),
          cached:
            usage.cached +
            (completion.usage?.prompt_tokens_details?.cached_tokens ?? 0),
        };

        const message = completion.choices[0]?.message;
        const calls = message?.tool_calls ?? [];
        if (!message || calls.length === 0) {
          answer += turnText;
          break;
        }

        // The turn was narration, not the answer. Withdraw it.
        if (turnText) emit({ type: 'reset' });

        // The assistant turn carrying the calls has to go back verbatim, or the
        // tool replies below have nothing to attach to and the gateway 400s.
        messages.push(message);

        // Executed together, appended in call order. Each reply names the call
        // it answers, so order is for readability rather than correctness.
        const results = await Promise.all(
          calls.map((call) => this.runTool(call, byName, user, toolsUsed, emit)),
        );
        messages.push(...results);
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
    call: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
    byName: Map<string, AssistantTool>,
    user: JwtPayload,
    toolsUsed: string[],
    emit: (event: AssistantEvent) => void,
  ): Promise<Msg> {
    const reply = (content: string): Msg => ({
      role: 'tool',
      tool_call_id: call.id,
      content,
    });

    // Narrowed rather than assumed: the union covers custom tool types too.
    if (call.type !== 'function') {
      return reply(`Unsupported tool call type ${call.type}.`);
    }

    const tool = byName.get(call.function.name);
    if (!tool) {
      // Only reachable if the model invents a name, since the catalog it was
      // given is already filtered to this caller.
      return reply(`No tool named ${call.function.name}.`);
    }

    toolsUsed.push(call.function.name);
    emit({ type: 'tool', name: call.function.name });

    let args: Record<string, unknown> = {};
    try {
      // Arguments arrive as a JSON string assembled from stream fragments, and
      // a weaker model gets that wrong often enough to matter. A bad payload is
      // told to the model rather than thrown, so it can retry or say so.
      args = call.function.arguments
        ? (JSON.parse(call.function.arguments) as Record<string, unknown>)
        : {};
    } catch {
      return reply(
        'Those arguments were not valid JSON. Call the tool again with a valid object.',
      );
    }

    try {
      const rows = await tool.run(args, user, this.deps);
      return reply(JSON.stringify(rows ?? null));
    } catch (error) {
      // A ForbiddenException from a service is information the model should
      // relay ("I can only show you your own department"), not a 500.
      const reason = error instanceof Error ? error.message : 'Lookup failed.';
      this.logger.warn(`${call.function.name} failed for ${user.sub}: ${reason}`);
      return reply(reason);
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
  private history(dto: ChatDto): Msg[] {
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
    if (error instanceof OpenAI.AuthenticationError) {
      return 'The assistant is not configured. OPENCODE_API_KEY was rejected by OpenCode Zen.';
    }
    if (error instanceof OpenAI.RateLimitError) {
      return 'The assistant is rate limited. Try again in a moment.';
    }
    if (error instanceof OpenAI.APIConnectionError) {
      return 'Could not reach the assistant. Check the connection and retry.';
    }
    if (error instanceof OpenAI.NotFoundError) {
      return `Model ${this.provider.model} is not available on this key. Check ASSISTANT_MODEL.`;
    }
    if (error instanceof OpenAI.APIError) {
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
