import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { role_enum } from '@prisma/client';

import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../common/gaurds/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';

import { AddTeamMemberDto } from './dto/add-team-member.dto';
import { CreateRndReportDto } from './dto/create-rnd-report.dto';
import { UpdateRndReportDto } from './dto/update-rnd-report.dto';
import { OVERSIGHT_ROLES } from './rnd-visibility';
import { RndService } from './rnd.service';

/**
 * Every internal role reaches the report routes; the service decides what comes
 * back. Membership is a per-person grant, so `@Roles` cannot express it and
 * narrowing this list would only hide the module from people the MD has invited.
 */
const INTERNAL_ROLES = [
  role_enum.MD,
  role_enum.EA,
  role_enum.PA,
  role_enum.DEPARTMENT_CONTROLLER,
  role_enum.PURCHASE_HEAD,
  role_enum.HOD,
  role_enum.EMPLOYEE,
  role_enum.HR,
  role_enum.ADMIN,
];

// Literal paths are declared above the parameterised ones they would otherwise
// be shadowed by: `team/me` before `team/:userId`, `reports/categories` before
// `reports/:id`.
@Controller('rnd')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RndController {
  constructor(private readonly service: RndService) {}

  /** The roster, for the team management screen. */
  @Get('team')
  @Roles(...OVERSIGHT_ROLES)
  listTeam() {
    return this.service.listTeam();
  }

  /**
   * Whether the caller is on the roster. Left open to any authenticated user
   * because the sidebar asks it for everyone; the shape `{ isMember }` is what
   * `useNavAccess` reads.
   */
  @Get('team/me')
  async me(@CurrentUser() user: JwtPayload) {
    return { isMember: await this.service.isMember(user.sub) };
  }

  /** Invite a user onto the R&D team. */
  @Post('team')
  @Roles(...OVERSIGHT_ROLES)
  addTeamMember(@Body() dto: AddTeamMemberDto, @CurrentUser() user: JwtPayload) {
    return this.service.addTeamMember(dto, user);
  }

  /** Take a user off the R&D team. Their reports are retained. */
  @Delete('team/:userId')
  @Roles(...OVERSIGHT_ROLES)
  removeTeamMember(@Param('userId') userId: string) {
    return this.service.removeTeamMember(userId);
  }

  /** Submit a research report. Rejected with 403 for a non-member. */
  @Post('reports')
  @Roles(...INTERNAL_ROLES)
  createReport(
    @Body() dto: CreateRndReportDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createReport(dto, user);
  }

  /** Report history: everything for the MD office, own categories for a member. */
  @Get('reports')
  @Roles(...INTERNAL_ROLES)
  listReports(@CurrentUser() user: JwtPayload) {
    return this.service.listReports(user);
  }

  /** The category names the caller can read, for grouping and form suggestions. */
  @Get('reports/categories')
  @Roles(...INTERNAL_ROLES)
  listCategories(@CurrentUser() user: JwtPayload) {
    return this.service.listCategories(user);
  }

  /** One report. Opening it as MD, EA, or PA marks it read and ends the edit window. */
  @Get('reports/:id')
  @Roles(...INTERNAL_ROLES)
  findReport(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findReport(id, user);
  }

  /** Correct a report, submitter only, before the MD office has read it. */
  @Patch('reports/:id')
  @Roles(...INTERNAL_ROLES)
  updateReport(
    @Param('id') id: string,
    @Body() dto: UpdateRndReportDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateReport(id, dto, user);
  }
}
