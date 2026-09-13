import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { role_enum } from '@prisma/client';

import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../common/gaurds/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';

import { CreateKpiDto } from './dto/create-kpi.dto';
import { ChangeKpiStatusDto, UpdateKpiDto } from './dto/update-kpi.dto';
import {
  CreateKpiRevisionDto,
  RecordKpiUpdateDto,
  SetKpiContributionsDto,
} from './dto/kpi-progress.dto';
import {
  KpiFilterDto,
  PsScoreQueryDto,
  UnitSearchDto,
} from './dto/kpi-query.dto';
import { KPI_AUTHOR_ROLES } from './kpi-lifecycle';
import { KpiService } from './kpi.service';

/**
 * Every internal role reaches these routes and the service decides what comes
 * back, the way `rnd` does. An employee has no KPI of their own to create but
 * does have one to update, and narrowing `@Roles` here would only hide the
 * module from the people it measures.
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
];

// Literal paths are declared above the parameterised ones they would otherwise
// be shadowed by: `units` and `ps-score` before `:id`.
@Controller('kpis')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KpiController {
  constructor(private readonly service: KpiService) {}

  /** The unit library for the search box on the KPI form. */
  @Get('units')
  @Roles(...INTERNAL_ROLES)
  searchUnits(@Query() query: UnitSearchDto) {
    return this.service.searchUnits(query.q);
  }

  /** The caller's own PS Score for a month. Defaults to the current one. */
  @Get('ps-score')
  @Roles(...INTERNAL_ROLES)
  myPsScore(@Query() query: PsScoreQueryDto, @CurrentUser() user: JwtPayload) {
    return this.service.psScoreFor(user.sub, query, user);
  }

  /** Somebody else's PS Score, within the caller's department scope. */
  @Get('ps-score/:userId')
  @Roles(...KPI_AUTHOR_ROLES)
  psScoreFor(
    @Param('userId') userId: string,
    @Query() query: PsScoreQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.psScoreFor(userId, query, user);
  }

  /** Define a KPI. It lands in DRAFT and needs approval before it counts. */
  @Post()
  @Roles(...KPI_AUTHOR_ROLES)
  create(@Body() dto: CreateKpiDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user);
  }

  /** KPIs the caller may see, filtered. */
  @Get()
  @Roles(...INTERNAL_ROLES)
  list(@Query() filter: KpiFilterDto, @CurrentUser() user: JwtPayload) {
    return this.service.list(filter, user);
  }

  /** One KPI with its stages, allocation, history, and score as it stands. */
  @Get(':id')
  @Roles(...INTERNAL_ROLES)
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findOne(id, user);
  }

  /** Edit a draft. An approved target changes through a revision instead. */
  @Patch(':id')
  @Roles(...KPI_AUTHOR_ROLES)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateKpiDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user);
  }

  /** Every lifecycle move, from submitting a draft to locking a finished KPI. */
  @Patch(':id/status')
  @Roles(...KPI_AUTHOR_ROLES)
  changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeKpiStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.changeStatus(id, dto, user);
  }

  /** Enter the actual. The server works out the percentage. */
  @Post(':id/updates')
  @Roles(...INTERNAL_ROLES)
  recordUpdate(
    @Param('id') id: string,
    @Body() dto: RecordKpiUpdateDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.recordUpdate(id, dto, user);
  }

  /** Tick a milestone off, or untick one ticked by mistake. */
  @Post(':id/milestones/:milestoneId/tick')
  @Roles(...INTERNAL_ROLES)
  tickMilestone(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.tickMilestone(id, milestoneId, user);
  }

  /** Replace the contribution allocation of a shared KPI. */
  @Put(':id/contributions')
  @Roles(...KPI_AUTHOR_ROLES)
  setContributions(
    @Param('id') id: string,
    @Body() dto: SetKpiContributionsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.setContributions(id, dto, user);
  }

  /** Change an approved target or weight, keeping the original. */
  @Post(':id/revisions')
  @Roles(...KPI_AUTHOR_ROLES)
  createRevision(
    @Param('id') id: string,
    @Body() dto: CreateKpiRevisionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createRevision(id, dto, user);
  }
}
