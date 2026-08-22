import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { role_enum } from '@prisma/client';
import type { Response } from 'express';

import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../common/gaurds/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';

import { AssistantService, AssistantEvent } from './assistant.service';
import { ALL_INTERNAL, isVmsScoped, toolsFor } from './assistant-tools';
import { ChatDto, FeedbackDto } from './dto/chat.dto';

/**
 * `@Roles` is listed rather than left off. An empty `@Roles` means any
 * authenticated principal, and from Phase 2 a vendor portal login is one of
 * those. `toolsFor` refuses VENDOR a second time, but the outer door should
 * not depend on the inner one.
 */
@Controller('assistant')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  /**
   * Ask a question. Server-sent events, one JSON object per `data:` line.
   *
   * Streaming rather than a single response because three seconds with a
   * spinner feels broken and the same three seconds with text arriving feels
   * fast. The event types are `text`, `tool`, `done` and `error`; the client
   * renders `tool` as the "Checked: ..." line under the answer.
   *
   * Errors arrive as an `error` event on a 200 rather than as an HTTP status,
   * because by the time one happens the headers are long gone.
   */
  @Post('chat')
  @Roles(...ALL_INTERNAL)
  async chat(
    @Body() dto: ChatDto,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ): Promise<void> {
    // A kiosk token would otherwise arrive here as ADMIN. See isVmsScoped.
    // Refused rather than handed an empty catalog, so it reads as a refusal.
    if (isVmsScoped(user)) {
      throw new ForbiddenException('The assistant is not available from a VMS session');
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Nginx and the Vercel proxy both buffer SSE without this, which turns
      // a stream back into one slow response.
      'X-Accel-Buffering': 'no',
    });

    const send = (event: AssistantEvent) => {
      if (res.writableEnded) return;
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    let open = true;
    res.on('close', () => {
      open = false;
    });

    await this.assistant.ask(dto, user, (event) => {
      if (open) send(event);
    });

    if (!res.writableEnded) res.end();
  }

  /**
   * The tools this user may call, for the empty state of the panel.
   *
   * Same filter the model gets, so what the panel offers as examples and what
   * the assistant can actually do cannot drift apart.
   */
  @Get('tools')
  @Roles(...ALL_INTERNAL)
  tools(@CurrentUser() user: JwtPayload) {
    return toolsFor(user).map((tool) => ({
      name: tool.name,
      description: tool.description,
    }));
  }

  /** Thumbs up or down. Only the person who asked may rate their own answer. */
  @Post('exchanges/:id/feedback')
  @Roles(...ALL_INTERNAL)
  feedback(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FeedbackDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.assistant.recordFeedback(id, user, dto.value);
  }

  /**
   * Questions that got no tool call, newest first.
   *
   * The queue for whoever writes the next tool. Restricted because it is every
   * question anyone has asked, which includes the shape of what they were
   * looking for even where the answer was refused.
   */
  @Get('declines')
  @Roles(role_enum.MD, role_enum.ADMIN)
  declines(@Query('limit') limit?: string) {
    return this.assistant.declines(Number(limit) || 50);
  }
}
