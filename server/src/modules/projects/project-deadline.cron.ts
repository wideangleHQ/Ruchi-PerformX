import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  project_health_enum,
  project_status_enum,
  role_enum,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotifyInput } from '../notifications/notification-channels.constants';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days before the deadline that the Lead and Co-Lead hear about it. */
const REMINDER_DAYS = [7, 1, 0];

/** A project past this point has nothing left to remind anybody about. */
const FINISHED_STATUSES = [
  project_status_enum.COMPLETED,
  project_status_enum.CANCELLED,
  project_status_enum.ARCHIVED,
];

/** Fraction of the checklist that has to be done to survive the final week. */
const LATE_STAGE_COMPLETION = 0.8;

/** Whole calendar days from `now` to `target`, so a deadline today is 0. */
function daysUntil(now: Date, target: Date): number {
  const midnight = (d: Date) =>
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((midnight(target) - midnight(now)) / DAY_MS);
}

export interface HealthInputs {
  deadline: Date | null;
  now: Date;
  checklistDone: number;
  checklistTotal: number;
  overdueItems: number;
  overdueMilestones: number;
}

/**
 * The stored value of `projects.health`.
 *
 * DELAYED means one thing only: the deadline is in the past. That keeps the
 * badge honest — a project with no deadline has nothing to be late for, however
 * many of its checklist items have slipped, so it can never reach DELAYED.
 *
 * AT_RISK is the warning band. Anything overdue inside the project puts it
 * there, and so does arriving in the last week with the checklist still behind,
 * which is the case that a count of overdue items misses entirely: items due on
 * the deadline itself are not overdue yet and there are twelve of them.
 *
 * Pure on purpose. The sweep supplies the counts; this decides nothing about
 * where they came from.
 */
export function deriveHealth({
  deadline,
  now,
  checklistDone,
  checklistTotal,
  overdueItems,
  overdueMilestones,
}: HealthInputs): project_health_enum {
  const daysLeft = deadline ? daysUntil(now, deadline) : null;

  if (daysLeft !== null && daysLeft < 0) {
    return project_health_enum.DELAYED;
  }

  if (overdueItems + overdueMilestones > 0) {
    return project_health_enum.AT_RISK;
  }

  const completion = checklistTotal === 0 ? 1 : checklistDone / checklistTotal;
  if (daysLeft !== null && daysLeft <= 7 && completion < LATE_STAGE_COMPLETION) {
    return project_health_enum.AT_RISK;
  }

  return project_health_enum.ON_TRACK;
}

function countByProject(
  rows: { project_id: string | null; _count: { _all: number } }[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.project_id) {
      counts.set(row.project_id, row._count._all);
    }
  }
  return counts;
}

/**
 * Daily sweep over projects with a deadline. Reminds the Lead and Co-Lead as
 * the date approaches, escalates to the MD once it passes with no closure
 * report, and recomputes projects.health while it is already walking the rows.
 *
 * health is a stored, indexed column that the directory filters on, so it is
 * recomputed here rather than at read time, where the filter and the index
 * would be querying stale rows.
 */
@Injectable()
export class ProjectDeadlineCron {
  private readonly logger = new Logger(ProjectDeadlineCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Recomputes health for every open project and sends the day's deadline
   * notifications in one batch.
   *
   * Throws nothing. A project that fails is logged and skipped, because the
   * alternative is the rest of the directory sitting on yesterday's health.
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async sweep(): Promise<void> {
    const now = new Date();

    // Every open project, not only the ones with a deadline: overdue checklist
    // items and milestones move health on their own, and a project without a
    // deadline still has both.
    const projects = await this.prisma.projects.findMany({
      where: { deleted_at: null, status: { notIn: FINISHED_STATUSES } },
      select: {
        id: true,
        title: true,
        deadline: true,
        health: true,
        lead_id: true,
        co_lead_id: true,
      },
    });
    if (projects.length === 0) {
      return;
    }

    const ids = projects.map((p) => p.id);
    const [checklist, lateItems, lateMilestones, reports, mds] =
      await Promise.all([
        this.prisma.project_checklist_items.groupBy({
          by: ['project_id', 'is_done'],
          where: { project_id: { in: ids } },
          _count: { _all: true },
        }),
        this.prisma.project_checklist_items.groupBy({
          by: ['project_id'],
          where: {
            project_id: { in: ids },
            is_done: false,
            due_date: { lt: now },
          },
          _count: { _all: true },
        }),
        this.prisma.project_milestones.groupBy({
          by: ['project_id'],
          where: {
            project_id: { in: ids },
            due_date: { lt: now },
            status: { notIn: ['COMPLETED', 'CANCELLED'] },
          },
          _count: { _all: true },
        }),
        this.prisma.project_closure_reports.findMany({
          where: { project_id: { in: ids } },
          select: { project_id: true },
        }),
        this.prisma.users.findMany({
          where: { role: role_enum.MD, is_active: true },
          select: { id: true },
        }),
      ]);

    const done = new Map<string, number>();
    const total = new Map<string, number>();
    for (const row of checklist) {
      if (!row.project_id) continue;
      const n = row._count._all;
      total.set(row.project_id, (total.get(row.project_id) ?? 0) + n);
      if (row.is_done) {
        done.set(row.project_id, (done.get(row.project_id) ?? 0) + n);
      }
    }
    const overdueItems = countByProject(lateItems);
    const overdueMilestones = countByProject(lateMilestones);
    const closed = new Set(reports.map((r) => r.project_id));

    const notifications: NotifyInput[] = [];
    let rewritten = 0;

    for (const project of projects) {
      try {
        const health = deriveHealth({
          deadline: project.deadline,
          now,
          checklistDone: done.get(project.id) ?? 0,
          checklistTotal: total.get(project.id) ?? 0,
          overdueItems: overdueItems.get(project.id) ?? 0,
          overdueMilestones: overdueMilestones.get(project.id) ?? 0,
        });

        if (health !== project.health) {
          // ponytail: one UPDATE per project that actually moved, which on a
          // normal day is a handful. Batch into one updateMany per health value
          // if the directory ever grows past a few thousand projects.
          await this.prisma.projects.update({
            where: { id: project.id },
            data: { health },
          });
          rewritten += 1;
        }

        if (!project.deadline) continue;
        const daysLeft = daysUntil(now, project.deadline);

        if (REMINDER_DAYS.includes(daysLeft)) {
          const when =
            daysLeft === 0 ? 'today' : `in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`;
          const owners = new Set(
            [project.lead_id, project.co_lead_id].filter(
              (id): id is string => id !== null,
            ),
          );
          for (const recipientId of owners) {
            notifications.push({
              recipientId,
              type: 'PROJECT_DEADLINE_NEAR',
              title: 'Project deadline approaching',
              message: `"${project.title}" is due ${when}.`,
              entityType: 'project',
              entityId: project.id,
            });
          }
          continue;
        }

        if (daysLeft < 0 && !closed.has(project.id)) {
          // ponytail: re-sent every day the project stays overdue, the same way
          // the task escalation sweep re-sends. Gate it on `-daysLeft % 7` if
          // the MD asks for less.
          const late = -daysLeft;
          for (const md of mds) {
            notifications.push({
              recipientId: md.id,
              type: 'PROJECT_OVERDUE_NO_CLOSURE',
              title: 'Project overdue with no closure report',
              message: `"${project.title}" passed its deadline ${late} day${late === 1 ? '' : 's'} ago and has no closure report.`,
              entityType: 'project',
              entityId: project.id,
            });
          }
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        this.logger.error(`Skipped project ${project.id} in the sweep: ${reason}`);
      }
    }

    await this.notifications.notifyMany(notifications);

    this.logger.log(
      `Project deadline sweep: ${projects.length} open, ${rewritten} health changes, ${notifications.length} notifications`,
    );
  }
}
