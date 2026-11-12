// src/modules/scoring/scoring.controller.ts

import { Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { role_enum } from '@prisma/client';
import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../common/gaurds/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { DepartmentScopeService } from '../../common/services/department-scope.service';
import { ScoringService } from './scoring.service';
import { ScoreQueryDto, ManagementScoresQueryDto } from './dto/score-query.dto';
import { ScoreTrendQueryDto } from './dto/score-trend-query.dto';
import {
  isRestrictedFromDigitalMarketing,
  isDigitalMarketingDepartment,
} from '../../common/helpers/department-restriction.helper';

/** Roles that may read somebody else's numbers. Everyone can read their own. */
const SCORE_VIEWER_ROLES = [
  role_enum.MD,
  role_enum.EA,
  role_enum.PA,
  role_enum.DEPARTMENT_CONTROLLER,
  role_enum.HOD,
];

const DEFAULT_TREND_MONTHS = 6;

/**
 * Employee scores over HTTP.
 *
 * Every number here is unbounded points from `performance_scores`, on a
 * different scale to the 0-100 HOD score in `/hod-score`. The two are not
 * comparable and averaging them produces nonsense. See docs/src/p1_scoring.md.
 *
 * The `me` routes carry no `@Roles`, so any authenticated user reaches their own
 * score. Identity comes from the JWT and is never read from the query string.
 * Everything else is limited to `SCORE_VIEWER_ROLES` and, for a named
 * department, re-checked against the caller's department scope.
 *
 * This controller injects the request-scoped `DepartmentScopeService`, which
 * makes it request-scoped. `ScoringService` stays a singleton so `ScoringCron`
 * keeps running.
 */
@Controller('scoring')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScoringController {
  constructor(
    private readonly scoringService: ScoringService,
    private readonly departmentScopeService: DepartmentScopeService,
  ) {}

  /** Own score for a month: the three stored counts and the points total. */
  @Get('me')
  getMyScore(@Query() query: ScoreQueryDto, @CurrentUser() user: JwtPayload) {
    const { month, year } = resolvePeriod(query);
    return this.scoringService.getEmployeeScoreSummary(user.sub, month, year);
  }

  /** Own history, oldest month first, gaps included. */
  @Get('me/trend')
  getMyTrend(@Query() query: ScoreTrendQueryDto, @CurrentUser() user: JwtPayload) {
    return this.scoringService.getEmployeeScoreTrend(
      user.sub,
      resolvePeriod(query),
      query.months ?? DEFAULT_TREND_MONTHS,
    );
  }

  /** Complete AT and PS profile with subcomponent breakdown for the logged-in user. */
  @Get('profile')
  getMyProfile(@Query() query: ScoreQueryDto, @CurrentUser() user: JwtPayload) {
    const { month, year } = resolvePeriod(query);
    return this.scoringService.getDetailedScoreProfile(user.sub, month, year, user);
  }

  /** Complete AT and PS profile with subcomponent breakdown for an employee in scope. */
  @Get('profile/:userId')
  @Roles(...SCORE_VIEWER_ROLES)
  async getUserProfile(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Query() query: ScoreQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const scope = await this.departmentScopeService.resolveDepartmentScope(user);
    if (isRestrictedFromDigitalMarketing(user.role)) {
      const subject = await this.scoringService['prisma'].users.findUnique({
        where: { id: userId },
        select: { department_id: true, departments: { select: { name: true } } },
      });
      if (isDigitalMarketingDepartment(subject?.departments?.name)) {
        throw new ForbiddenException('Outside your department scope');
      }
    }
    if (!scope.unrestricted) {
      const subject = await this.scoringService['prisma'].users.findUnique({
        where: { id: userId },
        select: { department_id: true },
      });
      if (!subject?.department_id || !scope.departmentIds.includes(subject.department_id)) {
        throw new ForbiddenException('Outside your department scope');
      }
    }
    const { month, year } = resolvePeriod(query);
    return this.scoringService.getDetailedScoreProfile(userId, month, year, user);
  }

  /** Centralized Management Scores Overview for EA, PA, MD and HODs. */
  @Get('overview')
  @Roles(...SCORE_VIEWER_ROLES)
  async getOverview(@Query() query: ManagementScoresQueryDto, @CurrentUser() user: JwtPayload) {
    const scope = await this.departmentScopeService.resolveDepartmentScope(user);
    return this.scoringService.getManagementScoresOverview(query, scope, user);
  }

  /** Export all matching scores to Excel for EA, PA, MD and HOD. */
  @Get('export')
  @Roles(...SCORE_VIEWER_ROLES)
  async exportScores(
    @Query() query: ManagementScoresQueryDto,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ): Promise<void> {
    const scope = await this.departmentScopeService.resolveDepartmentScope(user);
    const { buffer, filename } = await this.scoringService.exportScoresToExcel(query, scope, user);

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.send(buffer);
  }

  /** Department Execution and Employee list for HODs (Section A + Section B). */
  @Get('department/:departmentId/overview')
  @Roles(...SCORE_VIEWER_ROLES)
  async getDepartmentOverview(
    @Param('departmentId', new ParseUUIDPipe()) departmentId: string,
    @Query() query: ScoreQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.assertVisible(user, departmentId);
    const { month, year } = resolvePeriod(query);
    return this.scoringService.getDepartmentExecutionOverview(departmentId, month, year, user);
  }

  /** Top 10 by points for a month. Management only; it names other people. */
  @Get('leaderboard')
  @Roles(...SCORE_VIEWER_ROLES)
  async getLeaderboard(@Query() query: ScoreQueryDto, @CurrentUser() user: JwtPayload) {
    const { month, year } = resolvePeriod(query);
    const rows = await this.scoringService.getLeaderboard(month, year, user.role);

    return {
      month,
      year,
      entries: rows.map((row) => ({
        userId: row.users.id,
        fullName: row.users.full_name,
        role: row.users.role,
        department: row.users.departments?.name ?? null,
        points: Number(row.final_score ?? 0),
      })),
    };
  }

  /** Average points across a department for one month. */
  @Get('department/:departmentId')
  @Roles(...SCORE_VIEWER_ROLES)
  async getDepartmentScore(
    @Param('departmentId', new ParseUUIDPipe()) departmentId: string,
    @Query() query: ScoreQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.assertVisible(user, departmentId);

    const { month, year } = resolvePeriod(query);
    const result = await this.scoringService.getDepartmentScore(departmentId, month, year);

    return {
      departmentId,
      month,
      year,
      hasScore: result !== null,
      averagePoints: result?.score ?? null,
    };
  }

  /** Department history plus one series per member, for MD and HOD. */
  @Get('department/:departmentId/trend')
  @Roles(...SCORE_VIEWER_ROLES)
  async getDepartmentTrend(
    @Param('departmentId', new ParseUUIDPipe()) departmentId: string,
    @Query() query: ScoreTrendQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.assertVisible(user, departmentId);

    return this.scoringService.getDepartmentScoreTrend(
      departmentId,
      resolvePeriod(query),
      query.months ?? DEFAULT_TREND_MONTHS,
    );
  }

  private async assertVisible(user: JwtPayload, departmentId: string): Promise<void> {
    const scope = await this.departmentScopeService.resolveDepartmentScope(user);
    await this.scoringService.assertDepartmentVisible(scope, departmentId, user.role);
  }
}

/** Both query fields are optional; an omitted period means the current month. */
function resolvePeriod(query: ScoreQueryDto): { month: number; year: number } {
  const now = new Date();
  return {
    month: query.month ?? now.getMonth() + 1,
    year: query.year ?? now.getFullYear(),
  };
}
