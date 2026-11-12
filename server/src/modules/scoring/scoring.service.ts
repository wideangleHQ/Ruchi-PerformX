// src/modules/scoring/scoring.service.ts

import { ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import {
  action_status_enum,
  role_enum,
  score_status_enum,
  task_status_enum,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DepartmentScope } from '../../common/types/department-scope.type';
import { KpiService } from '../kpi/kpi.service';
import {
  calculateEmployeeAtScore,
  calculateHodAtScore,
  getWorkingDaysInMonth,
  round2,
  type AtScoreResult,
  type DepartmentExecutionMetrics,
  type LeadershipMetrics,
  type ProjectMetrics,
  type SelfActionMetrics,
  type TaskMetrics,
} from './at-scoring';
import { ManagementScoresQueryDto } from './dto/score-query.dto';
import {
  isRestrictedFromDigitalMarketing,
  isDigitalMarketingDepartment,
} from '../../common/helpers/department-restriction.helper';
import {
  aggregateByPeriod,
  buildScoreTrend,
  trendPeriods,
  type ScorePeriod,
  type ScoreTrendPoint,
  type StoredScoreRow,
} from './score-trend';

/** Columns of `performance_scores` a trend or a summary reads. */
const SCORE_COLUMNS = {
  month: true,
  year: true,
  final_score: true,
  assigned_tasks_completed: true,
  self_actions_completed: true,
  overdue_tasks_count: true,
} as const;

type ScoreColumns = {
  month: number;
  year: number;
  final_score: Prisma.Decimal | null;
  assigned_tasks_completed: number | null;
  self_actions_completed: number | null;
  overdue_tasks_count: number | null;
};

/**
 * `final_score` is Decimal and every count is nullable in the schema. One
 * mapper so no caller has to remember either.
 */
function toStoredRow(row: ScoreColumns): StoredScoreRow {
  return {
    month: row.month,
    year: row.year,
    points: Number(row.final_score ?? 0),
    assignedTasksCompleted: row.assigned_tasks_completed ?? 0,
    selfActionsCompleted: row.self_actions_completed ?? 0,
    overdueTasksCount: row.overdue_tasks_count ?? 0,
  };
}

/** One month of an employee's stored score. `points` is unbounded, not a rate. */
export interface EmployeeScoreSummary extends ScorePeriod {
  userId: string;
  hasScore: boolean;
  points: number | null;
  assignedTasksCompleted: number;
  selfActionsCompleted: number;
  overdueTasksCount: number;
}

export interface EmployeeScoreTrend {
  userId: string;
  months: number;
  endMonth: number;
  endYear: number;
  trend: ScoreTrendPoint[];
}

export interface DepartmentMemberTrend {
  userId: string;
  fullName: string;
  trend: ScoreTrendPoint[];
}

export interface DepartmentScoreTrend {
  departmentId: string;
  months: number;
  endMonth: number;
  endYear: number;
  memberCount: number;
  trend: ScoreTrendPoint[];
  members: DepartmentMemberTrend[];
}

const POINTS = {
  TASK_COMPLETED: 10,
  SELF_ACTION_COMPLETED: 5,
  TASK_REVIEWED: 5,
  OVERDUE_PER_DAY: -2,
  ESCALATED: -10,
};

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly kpiService?: KpiService,
  ) {}

  async calculateEmployeeScore(userId: string, month: number, year: number): Promise<number> {
    return (await this.scoreComponents(userId, month, year)).score;
  }

  /**
   * The four independent reads one employee's score is built from, run in
   * parallel rather than four sequential awaits, plus the score itself.
   *
   * `completedTasks` and `selfActions` are also what `saveMonthlyScores`
   * persists as columns — computing them once here and having both callers
   * share the result removes what was a duplicate query per employee
   * (`saveMonthlyScores` used to re-run these same two counts itself after
   * `calculateEmployeeScore` had already run them for the score math).
   *
   * `overdueTasks` intentionally does not double as the persisted
   * `overdue_tasks_count` column: this query is scoped to the period
   * (`due_date >= start`) because the score only penalises overdue days
   * within the month, while the persisted count is all-time by design (or by
   * bug — see "`overdue_tasks_count` counts all time, not the month" in
   * Known gaps). Merging them would fix that mismatch as a side effect of a
   * performance change, which is exactly what this phase is not for.
   */
  private async scoreComponents(
    userId: string,
    month: number,
    year: number,
  ): Promise<{ score: number; completedTasks: number; selfActions: number }> {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    const now = new Date();

    const [completedTasks, reviewedTasks, selfActions, overdueTasks] = await Promise.all([
      // Tasks completed in period (by completed_at, not final status — avoids double-counting CLOSED)
      this.prisma.tasks.count({
        where: { assigned_to_id: userId, completed_at: { gte: start, lt: end } },
      }),
      // Tasks reviewed in period (reviewed_at; separate from completion bonus)
      this.prisma.tasks.count({
        where: { assigned_to_id: userId, reviewed_at: { gte: start, lt: end } },
      }),
      // Completed self actions in period
      this.prisma.self_actions.count({
        where: { created_by_id: userId, status: 'COMPLETED', completed_at: { gte: start, lt: end } },
      }),
      // Overdue tasks penalty (open tasks past due date, within this period)
      this.prisma.tasks.findMany({
        where: {
          assigned_to_id: userId,
          status: {
            notIn: [task_status_enum.COMPLETED, task_status_enum.REVIEWED, task_status_enum.CLOSED, task_status_enum.REJECTED],
          },
          due_date: { lt: now, gte: start },
        },
        select: { due_date: true },
      }),
    ]);

    let score = completedTasks * POINTS.TASK_COMPLETED + reviewedTasks * POINTS.TASK_REVIEWED + selfActions * POINTS.SELF_ACTION_COMPLETED;

    for (const task of overdueTasks) {
      const daysOverdue = Math.floor(
        (now.getTime() - new Date(task.due_date).getTime()) / (1000 * 60 * 60 * 24),
      );
      score += daysOverdue * POINTS.OVERDUE_PER_DAY;

      if (daysOverdue >= 5) {
        score += POINTS.ESCALATED;
      }
    }

    return { score: Math.max(0, score), completedTasks, selfActions };
  }

  async calculateDepartmentScore(departmentId: string, month: number, year: number): Promise<number> {
    const users = await this.prisma.users.findMany({
      where: { department_id: departmentId, is_active: true },
      select: { id: true },
    });

    if (!users.length) return 0;

    const scores = await Promise.all(
      users.map((u) => this.calculateEmployeeScore(u.id, month, year)),
    );

    const total = scores.reduce((sum, s) => sum + s, 0);
    return Math.round(total / users.length);
  }

  /**
   * How many employees' scores are computed and written concurrently. Each
   * employee is 4 reads + 1 write (down from the previous 7 reads + 1 write,
   * counting the duplicate queries this removed) — bounded so a company with
   * a few hundred employees doesn't fire that many queries at the Supabase
   * pooler at once. Not tuned against a measured pool limit; a conservative
   * default for a nightly job with no user waiting on it.
   */
  private static readonly SCORING_BATCH_SIZE = 10;

  async saveMonthlyScores(month: number, year: number): Promise<void> {
    const users = await this.prisma.users.findMany({
      where: { is_active: true, role: { not: role_enum.ADMIN } },
      select: { id: true },
    });

    for (let i = 0; i < users.length; i += ScoringService.SCORING_BATCH_SIZE) {
      const batch = users.slice(i, i + ScoringService.SCORING_BATCH_SIZE);
      await Promise.all(batch.map((user) => this.saveOneMonthlyScore(user.id, month, year)));
    }

    this.logger.log(`Scores saved for ${month}/${year} (${users.length} employees)`);
  }

  private async saveOneMonthlyScore(userId: string, month: number, year: number): Promise<void> {
    // `overdue_tasks_count` is deliberately a separate, all-time query — see
    // the comment on scoreComponents() for why it isn't merged with the
    // period-scoped overdue read the score itself uses.
    const [{ score, completedTasks, selfActions }, overdueCount] = await Promise.all([
      this.scoreComponents(userId, month, year),
      this.prisma.tasks.count({
        where: {
          assigned_to_id: userId,
          status: {
            notIn: [
              task_status_enum.COMPLETED,
              task_status_enum.REVIEWED,
              task_status_enum.CLOSED,
              task_status_enum.REJECTED,
            ],
          },
          due_date: { lt: new Date() },
        },
      }),
    ]);

    const finalScore = new Prisma.Decimal(score);

    await this.prisma.performance_scores.upsert({
      where: {
        user_id_month_year: {
          user_id: userId,
          month,
          year,
        },
      },
      update: {
        final_score: finalScore,
        assigned_task_score: finalScore,
        assigned_tasks_completed: completedTasks,
        self_actions_completed: selfActions,
        overdue_tasks_count: overdueCount,
        assigned_score_status: score_status_enum.CALCULATED,
        is_finalized: true,
        updated_at: new Date(),
      },
      create: {
        user_id: userId,
        month,
        year,
        final_score: finalScore,
        assigned_task_score: finalScore,
        assigned_tasks_completed: completedTasks,
        self_actions_completed: selfActions,
        overdue_tasks_count: overdueCount,
        assigned_score_status: score_status_enum.CALCULATED,
        is_finalized: true,
      },
    });
  }

  /** The stored row for one user and month, or null if the cron never wrote one. */
  async getEmployeeScore(userId: string, month: number, year: number) {
    return this.prisma.performance_scores.findUnique({
      where: { user_id_month_year: { user_id: userId, month, year } },
    });
  }

  /**
   * `getEmployeeScore` in the shape the API returns: the three stored counts and
   * the points total, with Decimal and the nullable count columns resolved.
   *
   * A month with no stored row comes back as `hasScore: false` and null points,
   * never as a zero, because a zero is a real score somebody earned.
   */
  async getEmployeeScoreSummary(
    userId: string,
    month: number,
    year: number,
  ): Promise<EmployeeScoreSummary> {
    const row = await this.getEmployeeScore(userId, month, year);

    if (!row) {
      return {
        userId,
        month,
        year,
        hasScore: false,
        points: null,
        assignedTasksCompleted: 0,
        selfActionsCompleted: 0,
        overdueTasksCount: 0,
      };
    }

    const stored = toStoredRow(row);
    return { userId, ...stored, hasScore: true };
  }

  /**
   * One user's stored scores over the `months` periods ending at month/year,
   * oldest first. A user who has never been scored gets an empty series.
   */
  async getEmployeeScoreTrend(
    userId: string,
    end: ScorePeriod,
    months: number,
  ): Promise<EmployeeScoreTrend> {
    const periods = trendPeriods(end, months);

    const rows = await this.prisma.performance_scores.findMany({
      where: { user_id: userId, OR: periods },
      select: SCORE_COLUMNS,
    });

    return {
      userId,
      months,
      endMonth: end.month,
      endYear: end.year,
      trend: buildScoreTrend(rows.map(toStoredRow), end, months),
    };
  }

  /**
   * A department's stored scores over the same window, as the monthly
   * department average and as one series per member.
   *
   * Membership follows `users.department_id`, matching `getDepartmentScore`.
   * That column does not describe the four multi-department roles, which is why
   * it is never used for authorization - who may call this is decided by
   * `assertDepartmentVisible` against `DepartmentScopeService`.
   */
  async getDepartmentScoreTrend(
    departmentId: string,
    end: ScorePeriod,
    months: number,
  ): Promise<DepartmentScoreTrend> {
    const periods = trendPeriods(end, months);

    const rows = await this.prisma.performance_scores.findMany({
      where: {
        users: { department_id: departmentId, is_active: true, deleted_at: null },
        OR: periods,
      },
      select: {
        ...SCORE_COLUMNS,
        user_id: true,
        users: { select: { full_name: true } },
      },
      orderBy: { users: { full_name: 'asc' } },
    });

    const byUser = new Map<string, { fullName: string; rows: StoredScoreRow[] }>();

    for (const row of rows) {
      const member = byUser.get(row.user_id) ?? {
        fullName: row.users.full_name,
        rows: [],
      };
      member.rows.push(toStoredRow(row));
      byUser.set(row.user_id, member);
    }

    return {
      departmentId,
      months,
      endMonth: end.month,
      endYear: end.year,
      memberCount: byUser.size,
      trend: buildScoreTrend(aggregateByPeriod(rows.map(toStoredRow)), end, months),
      members: [...byUser.entries()].map(([userId, member]) => ({
        userId,
        fullName: member.fullName,
        trend: buildScoreTrend(member.rows, end, months),
      })),
    };
  }

  /**
   * Throw unless the caller's department scope covers `departmentId`.
   *
   * The scope is resolved by the controller rather than injected here, because
   * `DepartmentScopeService` is request-scoped and injecting it would make this
   * service request-scoped too, which would stop `ScoringCron` from running.
   *
   * @throws ForbiddenException when the department is outside the scope.
   */
  async assertDepartmentVisible(scope: DepartmentScope, departmentId: string, callerRole?: string): Promise<void> {
    if (isRestrictedFromDigitalMarketing(callerRole)) {
      const dept = await this.prisma.departments.findUnique({
        where: { id: departmentId },
        select: { name: true },
      });
      if (isDigitalMarketingDepartment(dept?.name)) {
        throw new ForbiddenException('Outside your department scope');
      }
    }
    if (scope.unrestricted) return;
    if (scope.departmentIds.includes(departmentId)) return;

    throw new ForbiddenException('Department not accessible');
  }

  /** Average of the stored `final_score` rows for a department, or null if none. */
  async getDepartmentScore(departmentId: string, month: number, year: number) {
    const rows = await this.prisma.performance_scores.findMany({
      where: {
        month,
        year,
        users: { department_id: departmentId, is_active: true },
      },
      select: { final_score: true },
    });

    if (!rows.length) return null;

    const total = rows.reduce((sum, r) => sum + Number(r.final_score ?? 0), 0);
    return {
      department_id: departmentId,
      month,
      year,
      score: Math.round(total / rows.length),
    };
  }

  /**
   * Complete AT Score calculation for Employee, EA, PA, or HOD.
   * Returns normalized 0-100 score and subcomponent breakdown.
   */
  async calculateStandardAtScore(userId: string, month: number, year: number): Promise<AtScoreResult> {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    const now = new Date();

    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, role: true, department_id: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const workingDays = getWorkingDaysInMonth(year, month);

    const [selfActionsInPeriod, completedSelfActions, assignedTasks, completedTasks, overdueTasks, memberships, ledProjects, checklistItems] = await Promise.all([
      this.prisma.self_actions.findMany({
        where: {
          created_by_id: userId,
          deleted_at: null,
          created_at: { lt: end },
          OR: [
            { completed_at: { gte: start, lt: end } },
            { status: { not: 'COMPLETED' } },
          ],
        },
        select: { id: true, completed_at: true, status: true },
      }),
      this.prisma.self_actions.findMany({
        where: {
          created_by_id: userId,
          deleted_at: null,
          status: 'COMPLETED',
          completed_at: { gte: start, lt: end },
        },
        select: { id: true, completed_at: true },
      }),
      this.prisma.tasks.findMany({
        where: {
          assigned_to_id: userId,
          deleted_at: null,
          due_date: { gte: start, lt: end },
        },
        select: { id: true, due_date: true, completed_at: true, reviewed_at: true, status: true },
      }),
      this.prisma.tasks.findMany({
        where: {
          assigned_to_id: userId,
          deleted_at: null,
          completed_at: { gte: start, lt: end },
        },
        select: { id: true, due_date: true, completed_at: true, reviewed_at: true, status: true },
      }),
      this.prisma.tasks.findMany({
        where: {
          assigned_to_id: userId,
          status: {
            notIn: [
              task_status_enum.COMPLETED,
              task_status_enum.REVIEWED,
              task_status_enum.CLOSED,
              task_status_enum.REJECTED,
            ],
          },
          due_date: { lt: now, gte: start },
        },
        select: { id: true, due_date: true },
      }),
      this.prisma.project_members.findMany({
        where: { user_id: userId },
        select: { project_id: true },
      }),
      this.prisma.projects.findMany({
        where: {
          OR: [{ lead_id: userId }, { co_lead_id: userId }],
          deleted_at: null,
        },
        select: { id: true, health: true },
      }),
      this.prisma.project_checklist_items.findMany({
        where: { assigned_to_id: userId },
        select: { id: true, is_done: true, completed_at: true, due_date: true },
      }),
    ]);

    // Self actions metrics
    const activeDaysSet = new Set<string>();
    for (const sa of completedSelfActions) {
      if (sa.completed_at) {
        activeDaysSet.add(sa.completed_at.toISOString().slice(0, 10));
      }
    }

    const selfActionMetrics: SelfActionMetrics = {
      total: Math.max(selfActionsInPeriod.length, completedSelfActions.length),
      completed: completedSelfActions.length,
      activeDays: activeDaysSet.size,
      workingDays,
      onTimeCompleted: completedSelfActions.length,
      reviewedAccepted: completedSelfActions.length,
      totalReviewed: completedSelfActions.length,
    };

    // Task metrics
    let onTime = 0;
    let late1to2 = 0;
    let late3to5 = 0;
    let lateOver5 = 0;
    let reviewedAccepted = 0;
    let reviewedRework = 0;
    let totalReviewed = 0;

    for (const t of completedTasks) {
      if (t.completed_at && t.due_date) {
        const diffMs = t.completed_at.getTime() - t.due_date.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) onTime++;
        else if (diffDays <= 2) late1to2++;
        else if (diffDays <= 5) late3to5++;
        else lateOver5++;
      } else {
        onTime++;
      }

      if (t.reviewed_at) {
        totalReviewed++;
        if (t.status === 'REVIEWED' || t.status === 'CLOSED') {
          reviewedAccepted++;
        } else {
          reviewedRework++;
        }
      }
    }

    const taskMetrics: TaskMetrics = {
      total: Math.max(assignedTasks.length, completedTasks.length),
      completed: completedTasks.length,
      onTimeCompleted: onTime,
      late1to2Days: late1to2,
      late3to5Days: late3to5,
      lateOver5Days: lateOver5,
      reviewedAccepted,
      reviewedRework,
      totalReviewed,
      overdueCount: overdueTasks.length,
      escalatedCount: overdueTasks.filter((t) => {
        const d = Math.floor((now.getTime() - new Date(t.due_date).getTime()) / (1000 * 60 * 60 * 24));
        return d >= 5;
      }).length,
    };

    // Project metrics
    const hasProjects = memberships.length > 0 || ledProjects.length > 0 || checklistItems.length > 0;
    const completedChecklist = checklistItems.filter(
      (c) => c.is_done && c.completed_at && c.completed_at >= start && c.completed_at < end,
    );
    const onTimeChecklist = completedChecklist.filter(
      (c) => !c.due_date || (c.completed_at && c.completed_at <= c.due_date),
    );

    const projectMetrics: ProjectMetrics = {
      hasProjects,
      totalItems: checklistItems.length,
      completedItems: completedChecklist.length,
      onTimeItems: onTimeChecklist.length,
      qualityScore: 90,
      outcomeScore: 85,
    };

    const personalAt = calculateEmployeeAtScore(selfActionMetrics, taskMetrics, projectMetrics);

    if (user.role === role_enum.HOD) {
      const hodDepts = await this.prisma.hod_departments.findMany({
        where: { hod_id: userId },
        select: { department_id: true },
      });
      const deptIds = hodDepts.map((d) => d.department_id);
      if (user.department_id && !deptIds.includes(user.department_id)) {
        deptIds.push(user.department_id);
      }

      const [deptTasks, deptCompletedTasks, deptOverdueTasks, reviewedByHod, requestsHandled] = await Promise.all([
        this.prisma.tasks.findMany({
          where: { department_id: { in: deptIds }, deleted_at: null, due_date: { gte: start, lt: end } },
          select: { id: true, due_date: true },
        }),
        this.prisma.tasks.findMany({
          where: { department_id: { in: deptIds }, deleted_at: null, completed_at: { gte: start, lt: end } },
          select: { id: true, due_date: true, completed_at: true },
        }),
        this.prisma.tasks.count({
          where: {
            department_id: { in: deptIds },
            deleted_at: null,
            due_date: { lt: now, gte: start },
            status: { notIn: [task_status_enum.COMPLETED, task_status_enum.REVIEWED, task_status_enum.CLOSED, task_status_enum.REJECTED] },
          },
        }),
        this.prisma.tasks.findMany({
          where: { department_id: { in: deptIds }, reviewed_at: { gte: start, lt: end } },
          select: { completed_at: true, reviewed_at: true },
        }),
        this.prisma.task_requests.count({
          where: { reviewed_by_id: userId, reviewed_at: { gte: start, lt: end } },
        }),
      ]);

      const deptOnTime = deptCompletedTasks.filter((t) => t.completed_at && t.due_date && t.completed_at <= t.due_date).length;

      let totalReviewHours = 0;
      let reviewCount = 0;
      for (const r of reviewedByHod) {
        if (r.completed_at && r.reviewed_at) {
          const hours = (r.reviewed_at.getTime() - r.completed_at.getTime()) / (1000 * 60 * 60);
          if (hours >= 0) {
            totalReviewHours += hours;
            reviewCount++;
          }
        }
      }

      const deptMetrics: DepartmentExecutionMetrics = {
        totalTasks: Math.max(deptTasks.length, deptCompletedTasks.length),
        completedTasks: deptCompletedTasks.length,
        onTimeTasks: deptOnTime,
        pendingTasks: Math.max(0, deptTasks.length - deptCompletedTasks.length),
        overdueTasks: deptOverdueTasks,
      };

      const leadershipMetrics: LeadershipMetrics = {
        avgReviewHours: reviewCount > 0 ? totalReviewHours / reviewCount : null,
        requestsHandled,
        totalRequests: Math.max(requestsHandled, 1),
      };

      return calculateHodAtScore(personalAt, deptMetrics, projectMetrics, leadershipMetrics);
    }

    return personalAt;
  }

  /**
   * Detailed AT score and PS score breakdown for an employee.
   */
  async getDetailedScoreProfile(userId: string, month: number, year: number, caller?: any) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        full_name: true,
        role: true,
        department_id: true,
        departments: { select: { id: true, name: true } },
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (caller?.role && isRestrictedFromDigitalMarketing(caller.role)) {
      if (isDigitalMarketingDepartment(user.departments?.name)) {
        throw new ForbiddenException('Outside your department scope');
      }
    }

    const [atScore, psScore] = await Promise.all([
      this.calculateStandardAtScore(userId, month, year),
      this.kpiService
        ? this.kpiService.psScoreFor(userId, { month, year }, caller || { sub: userId, role: user.role })
        : { ps_score: 0, counted_weight: 0, declared_weight: 0, kpis: [] },
    ]);

    return {
      user: {
        id: user.id,
        fullName: user.full_name,
        role: user.role,
        department: user.departments?.name ?? 'Unknown',
        departmentId: user.department_id,
      },
      period: { month, year },
      atScore,
      psScore,
    };
  }

  /**
   * Centralized Management Scores Overview for EA, PA, MD and HODs.
   */
  async getManagementScoresOverview(query: ManagementScoresQueryDto, scope: DepartmentScope, caller: any) {
    const now = new Date();
    const month = query.month ?? now.getMonth() + 1;
    const year = query.year ?? now.getFullYear();

    const userWhere: Prisma.usersWhereInput = {
      is_active: true,
      deleted_at: null,
      role: { not: role_enum.ADMIN },
    };

    if (!scope.unrestricted) {
      userWhere.department_id = { in: scope.departmentIds };
    }

    if (query.department_id) {
      userWhere.department_id = query.department_id;
    }

    if (caller?.role && isRestrictedFromDigitalMarketing(caller.role)) {
      const dmDepts = await this.prisma.departments.findMany({
        where: { name: { contains: 'Digital Marketing', mode: 'insensitive' } },
        select: { id: true },
      });
      const dmIds = dmDepts.map((d) => d.id);
      if (dmIds.length > 0) {
        if (query.department_id && dmIds.includes(query.department_id)) {
          throw new ForbiddenException('Outside your department scope');
        }
        userWhere.department_id = { notIn: dmIds };
      }
    }

    if (query.role) {
      userWhere.role = query.role as role_enum;
    }

    const q = query.q?.trim();
    if (q) {
      userWhere.OR = [
        { full_name: { contains: q, mode: 'insensitive' } },
        { username: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [allUsersInScope, total, departments] = await Promise.all([
      this.prisma.users.findMany({
        where: userWhere,
        select: {
          id: true,
          full_name: true,
          role: true,
          department_id: true,
          departments: { select: { id: true, name: true } },
        },
        orderBy: [{ departments: { name: 'asc' } }, { full_name: 'asc' }],
      }),
      this.prisma.users.count({ where: userWhere }),
      this.prisma.departments.findMany({
        where: scope.unrestricted ? {} : { id: { in: scope.departmentIds } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const isEaPaMd = caller?.role ? isRestrictedFromDigitalMarketing(caller.role) : false;

    // Compute AT scores for all users in scope so global sorting by AT score works correctly
    const scoredUsers = await Promise.all(
      allUsersInScope.map(async (u) => {
        const atResult = await this.calculateStandardAtScore(u.id, month, year);
        return {
          user: u,
          atResult,
        };
      }),
    );

    let filteredScoredUsers = scoredUsers;
    if (query.minAt !== undefined) {
      filteredScoredUsers = filteredScoredUsers.filter((s) => s.atResult.score >= query.minAt!);
    }
    if (query.maxAt !== undefined) {
      filteredScoredUsers = filteredScoredUsers.filter((s) => s.atResult.score <= query.maxAt!);
    }

    if (isEaPaMd) {
      // Sort in descending order as per the AT Score for EA, PA, and MD
      filteredScoredUsers.sort((a, b) => b.atResult.score - a.atResult.score);
    }

    const paginatedScoredUsers = filteredScoredUsers.slice((page - 1) * limit, page * limit);

    // Compute or fetch PS scores for users on this page
    const items = await Promise.all(
      paginatedScoredUsers.map(async ({ user: u, atResult }) => {
        let psResult = { ps_score: 0, counted_weight: 0, declared_weight: 0 };
        if (this.kpiService) {
          try {
            psResult = await this.kpiService.psScoreFor(u.id, { month, year }, caller);
          } catch {
            // Safe fallback
          }
        }
        return {
          id: u.id,
          fullName: u.full_name,
          role: u.role,
          department: u.departments?.name ?? 'General',
          departmentId: u.department_id,
          atScore: atResult.score,
          psScore: psResult.ps_score,
          atStatus: atResult.status,
          isNormalized: atResult.isNormalized,
          period: `${month}/${year}`,
        };
      }),
    );

    // Filter by min/max PS if specified
    const filteredItems = items.filter((item) => {
      if (query.minPs !== undefined && item.psScore < query.minPs) return false;
      if (query.maxPs !== undefined && item.psScore > query.maxPs) return false;
      return true;
    });

    const totalEmployees = allUsersInScope.length;
    let sumAt = 0;
    let completedCount = 0;

    for (const s of scoredUsers) {
      sumAt += s.atResult.score;
      if (s.atResult.score > 0) completedCount++;
    }

    let sumPs = 0;
    for (const item of items) {
      sumPs += item.psScore;
    }

    const avgAtScore = totalEmployees > 0 ? Math.round((sumAt / totalEmployees) * 10) / 10 : 0;
    const avgPsScore = items.length > 0 ? Math.round((sumPs / items.length) * 10) / 10 : 0;

    return {
      summary: {
        totalEmployees,
        avgAtScore,
        avgPsScore,
        completedCalculations: completedCount,
        pendingCalculations: Math.max(0, totalEmployees - completedCount),
      },
      items: filteredItems,
      departments: departments.filter((d) => {
        if (caller?.role && isRestrictedFromDigitalMarketing(caller.role)) {
          return !isDigitalMarketingDepartment(d.name);
        }
        return true;
      }),
      pagination: {
        page,
        limit,
        total: filteredScoredUsers.length,
        totalPages: Math.max(1, Math.ceil(filteredScoredUsers.length / limit)),
      },
    };
  }

  /**
   * Section A & B for HOD Department Scoring View.
   */
  async getDepartmentExecutionOverview(departmentId: string, month: number, year: number, caller: any) {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    const now = new Date();

    const dept = await this.prisma.departments.findUnique({
      where: { id: departmentId },
      select: { id: true, name: true },
    });
    if (!dept) throw new NotFoundException('Department not found');

    if (caller?.role && isRestrictedFromDigitalMarketing(caller.role)) {
      if (isDigitalMarketingDepartment(dept.name)) {
        throw new ForbiddenException('Outside your department scope');
      }
    }

    const [users, deptTasks, deptCompletedTasks, deptOverdueTasks] = await Promise.all([
      this.prisma.users.findMany({
        where: { department_id: departmentId, is_active: true, deleted_at: null },
        select: { id: true, full_name: true, role: true },
        orderBy: { full_name: 'asc' },
      }),
      this.prisma.tasks.findMany({
        where: { department_id: departmentId, deleted_at: null, due_date: { gte: start, lt: end } },
        select: { id: true, due_date: true },
      }),
      this.prisma.tasks.findMany({
        where: { department_id: departmentId, deleted_at: null, completed_at: { gte: start, lt: end } },
        select: { id: true, due_date: true, completed_at: true },
      }),
      this.prisma.tasks.count({
        where: {
          department_id: departmentId,
          deleted_at: null,
          due_date: { lt: now, gte: start },
          status: { notIn: [task_status_enum.COMPLETED, task_status_enum.REVIEWED, task_status_enum.CLOSED, task_status_enum.REJECTED] },
        },
      }),
    ]);

    const totalTasks = Math.max(deptTasks.length, deptCompletedTasks.length);
    const completedCount = deptCompletedTasks.length;
    const onTimeCount = deptCompletedTasks.filter((t) => t.completed_at && t.due_date && t.completed_at <= t.due_date).length;

    const completionRate = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 100;
    const onTimeRate = completedCount > 0 ? (onTimeCount / completedCount) * 100 : 100;
    const overdueRate = totalTasks > 0 ? (deptOverdueTasks / totalTasks) * 100 : 0;
    const healthRate = Math.max(0, 100 - overdueRate);

    const departmentAtExecutionScore = Math.round(
      completionRate * 0.50 +
      onTimeRate * 0.30 +
      healthRate * 0.20
    );

    // Employee scores for section B
    const employeeScores = await Promise.all(
      users.map(async (u) => {
        const atResult = await this.calculateStandardAtScore(u.id, month, year);
        let psResult = { ps_score: 0 };
        if (this.kpiService) {
          try {
            psResult = await this.kpiService.psScoreFor(u.id, { month, year }, caller);
          } catch {
            // Safe fallback
          }
        }
        return {
          id: u.id,
          fullName: u.full_name,
          role: u.role,
          atScore: atResult.score,
          psScore: psResult.ps_score,
          period: `${month}/${year}`,
        };
      }),
    );

    if (caller?.role && isRestrictedFromDigitalMarketing(caller.role)) {
      // Sort descending by AT score for EA, PA, MD
      employeeScores.sort((a, b) => b.atScore - a.atScore);
    }

    return {
      department: {
        id: dept.id,
        name: dept.name,
        totalActiveEmployees: users.length,
        departmentAtExecutionScore,
        departmentPsScore: null,
        completedTasks: completedCount,
        pendingTasks: Math.max(0, totalTasks - completedCount),
        overdueTasks: deptOverdueTasks,
        period: `${month}/${year}`,
      },
      employees: employeeScores,
    };
  }

  /** Top 10 by stored points for a month. */
  async getLeaderboard(month: number, year: number, callerRole?: string) {
    const rows = await this.prisma.performance_scores.findMany({
      where: { month, year },
      orderBy: { final_score: 'desc' },
      take: 20,
      select: {
        final_score: true,
        users: {
          select: {
            id: true,
            full_name: true,
            role: true,
            departments: { select: { name: true } },
          },
        },
      },
    });

    if (isRestrictedFromDigitalMarketing(callerRole)) {
      return rows
        .filter((r) => !isDigitalMarketingDepartment(r.users.departments?.name))
        .slice(0, 10);
    }

    return rows.slice(0, 10);
  }

  /**
   * Export scores to Excel for EA, PA, MD, HOD, and controllers.
   * Exports all scoped records matching filters in a single file named Scores_YYYY-MM-DD.xlsx.
   */
  async exportScoresToExcel(query: ManagementScoresQueryDto, scope: DepartmentScope, caller: any) {
    const now = new Date();
    const month = query.month ?? now.getMonth() + 1;
    const year = query.year ?? now.getFullYear();

    const userWhere: Prisma.usersWhereInput = {
      is_active: true,
      deleted_at: null,
      role: { not: role_enum.ADMIN },
    };

    if (!scope.unrestricted) {
      userWhere.department_id = { in: scope.departmentIds };
    }

    if (query.department_id) {
      userWhere.department_id = query.department_id;
    }

    const isEaPaMd = caller?.role ? isRestrictedFromDigitalMarketing(caller.role) : false;

    if (isEaPaMd) {
      const dmDepts = await this.prisma.departments.findMany({
        where: { name: { contains: 'Digital Marketing', mode: 'insensitive' } },
        select: { id: true },
      });
      const dmIds = dmDepts.map((d) => d.id);
      if (dmIds.length > 0) {
        if (query.department_id && dmIds.includes(query.department_id)) {
          throw new ForbiddenException('Outside your department scope');
        }
        userWhere.department_id = { notIn: dmIds };
      }
    }

    if (query.role) {
      userWhere.role = query.role as role_enum;
    }

    const q = query.q?.trim();
    if (q) {
      userWhere.OR = [
        { full_name: { contains: q, mode: 'insensitive' } },
        { username: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    const users = await this.prisma.users.findMany({
      where: userWhere,
      select: {
        id: true,
        full_name: true,
        username: true,
        email: true,
        role: true,
        department_id: true,
        departments: { select: { id: true, name: true } },
      },
      orderBy: [{ departments: { name: 'asc' } }, { full_name: 'asc' }],
    });

    if (!users.length) {
      throw new NotFoundException('No employee records found for the selected filters.');
    }

    // Compute AT and PS scores for all users
    const evaluatedRows = await Promise.all(
      users.map(async (u) => {
        const atResult = await this.calculateStandardAtScore(u.id, month, year);
        let psResult = { ps_score: 0, counted_weight: 0, declared_weight: 0, kpis: [] as any[] };
        if (this.kpiService) {
          try {
            psResult = (await this.kpiService.psScoreFor(u.id, { month, year }, caller)) as any;
          } catch {
            // fallback
          }
        }
        return {
          user: u,
          atResult,
          psResult,
        };
      }),
    );

    let filtered = evaluatedRows;
    if (query.minAt !== undefined) {
      filtered = filtered.filter((r) => r.atResult.score >= query.minAt!);
    }
    if (query.maxAt !== undefined) {
      filtered = filtered.filter((r) => r.atResult.score <= query.maxAt!);
    }
    if (query.minPs !== undefined) {
      filtered = filtered.filter((r) => r.psResult.ps_score >= query.minPs!);
    }
    if (query.maxPs !== undefined) {
      filtered = filtered.filter((r) => r.psResult.ps_score <= query.maxPs!);
    }

    // Descending order as per the AT Score for EA, PA, and MD
    if (isEaPaMd) {
      filtered.sort((a, b) => b.atResult.score - a.atResult.score);
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RUCHI PerformX';
    workbook.created = now;

    const sheet = workbook.addWorksheet('Scores');
    sheet.columns = [
      { header: 'Employee Name', key: 'name', width: 26 },
      { header: 'Username / Email', key: 'identifier', width: 28 },
      { header: 'Department', key: 'department', width: 24 },
      { header: 'Role / Designation', key: 'role', width: 22 },
      { header: 'Period', key: 'period', width: 14 },
      { header: 'AT Score (Execution)', key: 'atScore', width: 22 },
      { header: 'PS Score (KPI Outcome)', key: 'psScore', width: 24 },
      { header: 'Self Actions Score', key: 'selfActionsScore', width: 20 },
      { header: 'Assigned Tasks Score', key: 'assignedTasksScore', width: 22 },
      { header: 'Projects Score', key: 'projectScore', width: 18 },
      { header: 'KPIs Evaluated', key: 'kpiCount', width: 16 },
      { header: 'Score Normalization', key: 'isNormalized', width: 20 },
    ];

    // Style Header Row (PerformX brand green)
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF15803D' }, // Green-700
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 24;

    for (const r of filtered) {
      const u = r.user;
      const comps = r.atResult.components;
      const selfActionScore = comps.selfAction ? round2(comps.selfAction.score) : 0;
      const assignedTaskScore = comps.assignedTask ? round2(comps.assignedTask.score) : 0;
      const projectScore = comps.project ? round2(comps.project.score) : 0;

      const sanitize = (val: unknown) => {
        if (val == null) return '';
        const str = String(val);
        return /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
      };

      const row = sheet.addRow({
        name: sanitize(u.full_name),
        identifier: sanitize(u.email || u.username),
        department: sanitize(u.departments?.name ?? 'General'),
        role: sanitize(u.role),
        period: `${month}/${year}`,
        atScore: r.atResult.score,
        psScore: r.psResult.ps_score,
        selfActionsScore: selfActionScore,
        assignedTasksScore: assignedTaskScore,
        projectScore: projectScore,
        kpiCount: r.psResult.kpis?.length ?? 0,
        isNormalized: r.atResult.isNormalized ? 'Yes (Project normalized)' : 'Standard (100%)',
      });

      row.alignment = { vertical: 'middle' };
      row.getCell('atScore').alignment = { horizontal: 'right' };
      row.getCell('psScore').alignment = { horizontal: 'right' };
      row.getCell('selfActionsScore').alignment = { horizontal: 'right' };
      row.getCell('assignedTasksScore').alignment = { horizontal: 'right' };
      row.getCell('projectScore').alignment = { horizontal: 'right' };
      row.getCell('kpiCount').alignment = { horizontal: 'center' };
      row.getCell('period').alignment = { horizontal: 'center' };
    }

    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const filename = `Scores_${dateStamp}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(buffer),
      filename,
    };
  }
}
