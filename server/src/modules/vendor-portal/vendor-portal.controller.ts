import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { role_enum } from '@prisma/client';

import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../common/gaurds/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';

import { VendorPortalService } from './vendor-portal.service';
import {
  VendorMessageDto,
  VendorTaskFilterDto,
  VendorTaskStatusDto,
} from './dto/vendor-portal.dto';

/**
 * The external vendor portal. Every route here is `VENDOR` only and every one
 * is scoped through `vendor_assignments` inside the service.
 *
 * This namespace exists so that no internal controller ever carries
 * `role_enum.VENDOR`. A shared controller with an `if (role === VENDOR)` inside
 * is how the whole company's data leaks; `just vendor-roles` fails the build if
 * VENDOR appears on a controller outside this directory.
 *
 * If a vendor needs to see something new, it goes here. It does not go into an
 * internal route behind a role branch.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(role_enum.VENDOR)
@Controller('vendor')
export class VendorPortalController {
  constructor(private readonly service: VendorPortalService) {}

  /** Assigned tasks grouped by status, assigned projects, own deliverables, shared messages. */
  @Get('dashboard')
  dashboard(@CurrentUser() user: JwtPayload) {
    return this.service.dashboard(user);
  }

  /** Assigned tasks only, optionally narrowed by status. */
  @Get('tasks')
  tasks(@Query() filters: VendorTaskFilterDto, @CurrentUser() user: JwtPayload) {
    return this.service.tasks(user, filters);
  }

  /** One assigned task with attachments and the shared thread. 403 if not assigned. */
  @Get('tasks/:id')
  task(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.task(user, id);
  }

  /** ACCEPTED, IN_PROGRESS, COMPLETED, or REJECTED with a reason. Nothing else. */
  @Patch('tasks/:id/status')
  updateTaskStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VendorTaskStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateTaskStatus(user, id, dto);
  }

  /** Assigned projects only. */
  @Get('projects')
  projects(@CurrentUser() user: JwtPayload) {
    return this.service.projects(user);
  }

  /** One assigned project. 403 if not assigned. */
  @Get('projects/:id')
  project(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.project(user, id);
  }

  /** The shared vendor thread. Internal notes are not reachable from this path. */
  @Get('messages')
  messages(@CurrentUser() user: JwtPayload) {
    return this.service.messages(user);
  }

  /** Appends to the shared thread and notifies the vendor's internal owner. */
  @Post('messages')
  postMessage(@Body() dto: VendorMessageDto, @CurrentUser() user: JwtPayload) {
    return this.service.postMessage(user, dto);
  }
}
