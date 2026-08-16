import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { role_enum } from '@prisma/client';

import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../common/gaurds/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { type JwtPayload } from '../../common/types/jwt-payload.type';
import { ProjectCollabService } from './project-collab.service';
import { CreateMessageDto } from './dto/message/create-message.dto';
import { CreateOutcomeDto } from './dto/outcome/create-outcome.dto';

// Every internal role. VENDOR is deliberately absent and stays absent: RolesGuard
// knows nothing about vendor_assignments, so listing it here would open every
// project's outcome log to every vendor. An endpoint with no @Roles at all would
// do the same, which is why these rows are spelled out rather than left open.
// See docs/src/p2_vendors.md.
const INTERNAL_ROLES = [
  role_enum.MD,
  role_enum.HOD,
  role_enum.EMPLOYEE,
  role_enum.EA,
  role_enum.PA,
  role_enum.DEPARTMENT_CONTROLLER,
  role_enum.PURCHASE_HEAD,
  role_enum.ADMIN,
  role_enum.HR,
];

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectCollabController {
  constructor(private readonly service: ProjectCollabService) {}

  /** The project message thread. Members only; observers get a 403. */
  @Get(':id/messages')
  @Roles(...INTERNAL_ROLES)
  listMessages(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.listMessages(id, user.sub);
  }

  /** Post to the thread. Members only; observers get a 403. */
  @Post(':id/messages')
  @Roles(...INTERNAL_ROLES)
  createMessage(
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createMessage(id, dto, user);
  }

  /** The TRY / FAILURE / OUTCOME log, grouped by type. Any internal reader. */
  @Get(':id/outcomes')
  @Roles(...INTERNAL_ROLES)
  listOutcomes(@Param('id') id: string) {
    return this.service.listOutcomes(id);
  }

  /** Log a TRY, a FAILURE, or an OUTCOME. Members only; observers get a 403. */
  @Post(':id/outcomes')
  @Roles(...INTERNAL_ROLES)
  createOutcome(
    @Param('id') id: string,
    @Body() dto: CreateOutcomeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createOutcome(id, dto, user);
  }
}
