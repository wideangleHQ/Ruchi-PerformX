// src/modules/scoring/scoring.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  action_status_enum,
  role_enum,
  score_status_enum,
  task_status_enum,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

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

  async getEmployeeScore(userId: string, month: number, year: number) {
    return this.prisma.performance_scores.findUnique({
      where: { user_id_month_year: { user_id: userId, month, year } },
    });
  }


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
