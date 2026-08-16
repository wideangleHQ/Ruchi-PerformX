// src/modules/scoring/scoring.service.ts

import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  action_status_enum,
  role_enum,
  score_status_enum,
  task_status_enum,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DepartmentScope } from '../../common/types/department-scope.type';
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

  constructor(private readonly prisma: PrismaService) {}

  async calculateEmployeeScore(userId: string, month: number, year: number): Promise<number> {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    let score = 0;

    // Tasks completed in period (by completed_at, not final status — avoids double-counting CLOSED)
    const completedTasks = await this.prisma.tasks.count({
      where: {
        assigned_to_id: userId,
        completed_at: { gte: start, lt: end },
      },
    });
    score += completedTasks * POINTS.TASK_COMPLETED;

    // Tasks reviewed in period (reviewed_at; separate from completion bonus)
    const reviewedTasks = await this.prisma.tasks.count({
      where: {
        assigned_to_id: userId,
        reviewed_at: { gte: start, lt: end },
      },
    });
    score += reviewedTasks * POINTS.TASK_REVIEWED;

    // Completed self actions in period
    const selfActions = await this.prisma.self_actions.count({
      where: {
        created_by_id: userId,
        status: 'COMPLETED',
        completed_at: { gte: start, lt: end },
      },
    });
    score += selfActions * POINTS.SELF_ACTION_COMPLETED;

    // Overdue tasks penalty (open tasks past due date)
    const now = new Date();
    const overdueTasks = await this.prisma.tasks.findMany({
      where: {
        assigned_to_id: userId,
        status: {
          notIn: [task_status_enum.COMPLETED, task_status_enum.REVIEWED, task_status_enum.CLOSED, task_status_enum.REJECTED],
        },
        due_date: { lt: now, gte: start },
      },
      select: { due_date: true },
    });

    for (const task of overdueTasks) {
      const daysOverdue = Math.floor(
        (now.getTime() - new Date(task.due_date).getTime()) / (1000 * 60 * 60 * 24),
      );
      score += daysOverdue * POINTS.OVERDUE_PER_DAY;

      if (daysOverdue >= 5) {
        score += POINTS.ESCALATED;
      }
    }

    return Math.max(0, score);
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

  async saveMonthlyScores(month: number, year: number): Promise<void> {
    const users = await this.prisma.users.findMany({
      where: { is_active: true, role: { not: role_enum.ADMIN } },
      select: { id: true },
    });

    for (const user of users) {
      const score = await this.calculateEmployeeScore(user.id, month, year);
      const finalScore = new Prisma.Decimal(score);

      const periodStart = new Date(year, month - 1, 1);
      const periodEnd = new Date(year, month, 1);

      const [completedTasks, selfActions, overdueCount] = await Promise.all([
        this.prisma.tasks.count({
          where: {
            assigned_to_id: user.id,
            completed_at: { gte: periodStart, lt: periodEnd },
          },
        }),
        this.prisma.self_actions.count({
          where: {
            created_by_id: user.id,
            status: 'COMPLETED',
            completed_at: { gte: periodStart, lt: periodEnd },
          },
        }),
        this.prisma.tasks.count({
          where: {
            assigned_to_id: user.id,
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

      await this.prisma.performance_scores.upsert({
        where: {
          user_id_month_year: {
            user_id: user.id,
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
          user_id: user.id,
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

    this.logger.log(`Scores saved for ${month}/${year}`);
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
  assertDepartmentVisible(scope: DepartmentScope, departmentId: string): void {
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

  /** Top 10 by stored points for a month. Unbounded points, not a percentage. */
  async getLeaderboard(month: number, year: number) {
    return this.prisma.performance_scores.findMany({
      where: { month, year },
      orderBy: { final_score: 'desc' },
      take: 10,
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
  }
}
