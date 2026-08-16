import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, project_health_enum } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { attachUsers } from '../../common/helpers/user-lookup.helper';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { NotificationsService } from '../notifications/notifications.service';
import { ProjectsService } from './projects.service';

import { CreateChecklistItemDto } from './dto/checklist/create-checklist-item.dto';
import { UpdateChecklistItemDto } from './dto/checklist/update-checklist-item.dto';
import { toMemberTick } from './dto/checklist/member-tick-checklist.dto';
import { CreateMilestoneDto } from './dto/milestone/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/milestone/update-milestone.dto';
import { CreateSuccessCriterionDto } from './dto/criteria/create-success-criterion.dto';
import { CreateKpiDto } from './dto/kpi/create-kpi.dto';
import { UpdateKpiDto } from './dto/kpi/update-kpi.dto';

/** done / total / percent, computed, never stored. */
export interface ProgressSummary {
  done: number;
  total: number;
  percent: number;
}

/**
 * Project progress, derived from checklist completion and nothing else.
 *
 * The only input is `is_done` per item. A caller cannot pass a progress number
 * in, because there is no parameter for one and no column to put it in; the
 * project detail screen reads this and the closure report quotes it. An empty
 * checklist is 0 percent rather than 100, because a project nobody has planned
 * yet is not a project that is finished.
 */
export function computeProgress(items: { is_done: boolean }[]): ProgressSummary {
  const total = items.length;
  const done = items.filter((item) => item.is_done).length;
  return {
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

/** How close to the deadline a project starts showing as AT_RISK. */
const HEALTH_WARNING_DAYS = 7;
/** How much of the checklist has to be done by then for it to stay ON_TRACK. */
const HEALTH_WARNING_PERCENT = 75;
const MS_PER_DAY = 86_400_000;

export interface HealthInputs {
  deadline: Date | null;
  progress: ProgressSummary;
  overdueItems: number;
  overdueMilestones: number;
}

/**
 * The stored `projects.health` value for one project.
 *
 * Pure so that the daily sweep and the inline recompute after a checklist tick
 * cannot drift apart. A finished checklist wins over a passed deadline: a
 * project delivered late is done, and leaving it DELAYED forever makes the
 * directory filter useless.
 *
 * @see project-deadline.cron.ts, which applies this to every project daily.
 */
export function deriveHealth(
  input: HealthInputs,
  now: Date = new Date(),
): project_health_enum {
  const { deadline, progress, overdueItems, overdueMilestones } = input;

  if (progress.total > 0 && progress.done === progress.total) return 'ON_TRACK';
  if (deadline && deadline.getTime() < now.getTime()) return 'DELAYED';
  if (overdueItems + overdueMilestones > 0) return 'DELAYED';

  if (deadline) {
    const daysLeft = (deadline.getTime() - now.getTime()) / MS_PER_DAY;
    if (
      daysLeft <= HEALTH_WARNING_DAYS &&
      progress.percent < HEALTH_WARNING_PERCENT
    ) {
      return 'AT_RISK';
    }
  }

  return 'ON_TRACK';
}

/** Past its due date and not finished. Returned to the client, not computed there. */
export function isChecklistOverdue(
  item: { is_done: boolean; due_date: Date | null },
  now: Date = new Date(),
): boolean {
  return (
    !item.is_done && item.due_date !== null && item.due_date.getTime() < now.getTime()
  );
}

/** Same rule as a checklist item, with `DONE` standing in for `is_done`. */
export function isMilestoneOverdue(
  milestone: { status: string; due_date: Date | null },
  now: Date = new Date(),
): boolean {
  return (
    milestone.status !== 'DONE' &&
    milestone.due_date !== null &&
    milestone.due_date.getTime() < now.getTime()
  );
}

/**
 * The membership checks this service borrows from `ProjectsService`.
 *
 * Typed locally so the two branches can land in either order; the real class is
 * still the injection token, so there is one implementation at runtime.
 *
 * depends on ProjectsService.assertMember / assertLeadOrCoLead, feat/projects-core
 */
interface ProjectMembership {
  /** Throws ForbiddenException when the user is not a participating member. */
  assertMember(projectId: string, userId: string): Promise<void>;
  /** Throws ForbiddenException when the user is neither Lead nor Co-Lead. */
  assertLeadOrCoLead(projectId: string, userId: string): Promise<void>;
}

/**
 * The execution half of a project: checklist, milestones, success criteria and
 * KPIs. Reads are company-wide, writes are Lead/Co-Lead except for a member
 * ticking an item assigned to them.
 */
@Injectable()
export class ProjectExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Inject(ProjectsService) private readonly projects: ProjectMembership,
  ) {}

  // ------------------------------------------------------------ checklist

  /**
   * The checklist plus its derived progress and per-item `is_overdue`.
   *
   * Progress ships with the list rather than as its own endpoint so the two can
   * never disagree on screen.
   *
   * @throws NotFoundException when the project does not exist or is deleted.
   */
  async listChecklist(projectId: string) {
    await this.getProject(projectId);

    const items = await this.prisma.project_checklist_items.findMany({
      where: { project_id: projectId },
      orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
    });

    const now = new Date();
    const rows = items.map((item) => ({
      ...item,
      is_overdue: isChecklistOverdue(item, now),
    }));

    return {
      items: await attachUsers(this.prisma, rows, ['assigned_to_id']),
      progress: computeProgress(items),
    };
  }

  /**
   * Adds a checklist item and notifies its assignee.
   *
   * @throws ForbiddenException when the caller is not the Lead or Co-Lead.
   * @throws NotFoundException when the project does not exist or is deleted.
   */
  async addChecklistItem(
    projectId: string,
    dto: CreateChecklistItemDto,
    user: JwtPayload,
  ) {
    const project = await this.getProject(projectId);
    await this.projects.assertLeadOrCoLead(projectId, user.sub);

    const item = await this.prisma.$transaction(async (tx) => {
      const created = await tx.project_checklist_items.create({
        data: {
          project_id: projectId,
          title: dto.title,
          description: dto.description ?? null,
          priority: dto.priority ?? null,
          assigned_to_id: dto.assigned_to_id ?? null,
          due_date: dto.due_date ? new Date(dto.due_date) : null,
          sort_order: dto.sort_order ?? 0,
        },
      });

      await this.logActivity(
        tx,
        projectId,
        user.sub,
        'CHECKLIST',
        `Added checklist item "${created.title}"`,
      );

      return created;
    });

    if (item.assigned_to_id && item.assigned_to_id !== user.sub) {
      await this.notifications.notify({
        recipientId: item.assigned_to_id,
        type: 'PROJECT_CHECKLIST_UPDATED',
        title: 'Checklist item assigned',
        message: `${project.title}: "${item.title}" is assigned to you`,
        entityType: 'project',
        entityId: projectId,
      });
    }

    return item;
  }

  /**
   * Updates a checklist item.
   *
   * The Lead and Co-Lead get the full field set. Anyone else gets `is_done` on
   * an item assigned to them and nothing else, whatever the body contained.
   * Completing the last open item recomputes `projects.health` for this one
   * project; the daily sweep does the rest.
   *
   * @throws ForbiddenException when a member ticks an item assigned elsewhere.
   * @throws NotFoundException when the project or the item does not exist.
   * @throws BadRequestException when a member's body carries no `is_done`.
   */
  async updateChecklistItem(
    projectId: string,
    itemId: string,
    dto: UpdateChecklistItemDto,
    user: JwtPayload,
  ) {
    const project = await this.getProject(projectId);
    const item = await this.prisma.project_checklist_items.findFirst({
      where: { id: itemId, project_id: projectId },
    });
    if (!item) throw new NotFoundException('Checklist item not found');

    const isLead = await this.isLeadOrCoLead(projectId, user.sub);

    let data: Prisma.project_checklist_itemsUpdateInput;
    let nextDone: boolean | undefined;
    if (isLead) {
      data = this.leadChecklistFields(dto);
      nextDone = dto.is_done;
    } else {
      await this.projects.assertMember(projectId, user.sub);
      if (item.assigned_to_id !== user.sub) {
        throw new ForbiddenException(
          'You can only tick checklist items assigned to you',
        );
      }
      const tick = toMemberTick(dto);
      data = { is_done: tick.is_done };
      nextDone = tick.is_done;
    }

    if (nextDone !== undefined && nextDone !== item.is_done) {
      data.completed_at = nextDone ? new Date() : null;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.project_checklist_items.update({
        where: { id: itemId },
        data,
      });

      const verb =
        row.is_done === item.is_done
          ? 'Updated'
          : row.is_done
            ? 'Completed'
            : 'Reopened';
      await this.logActivity(
        tx,
        projectId,
        user.sub,
        'CHECKLIST',
        `${verb} checklist item "${row.title}"`,
      );

      return row;
    });

    if (updated.is_done !== item.is_done) {
      await this.recomputeHealth(projectId);
    }

    await this.notifyChecklistChange(project, updated, isLead, user.sub);

    return updated;
  }

  /**
   * Deletes a checklist item outright. There is no soft delete on this table:
   * a removed item is a planning correction, and the activity log keeps the
   * record of it.
   *
   * @throws ForbiddenException when the caller is not the Lead or Co-Lead.
   * @throws NotFoundException when the project or the item does not exist.
   */
  async removeChecklistItem(projectId: string, itemId: string, user: JwtPayload) {
    await this.getProject(projectId);
    await this.projects.assertLeadOrCoLead(projectId, user.sub);

    const item = await this.prisma.project_checklist_items.findFirst({
      where: { id: itemId, project_id: projectId },
      select: { id: true, title: true },
    });
    if (!item) throw new NotFoundException('Checklist item not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.project_checklist_items.delete({ where: { id: itemId } });
      await this.logActivity(
        tx,
        projectId,
        user.sub,
        'CHECKLIST',
        `Removed checklist item "${item.title}"`,
      );
    });

    await this.recomputeHealth(projectId);

    return { id: itemId, deleted: true };
  }

  // ------------------------------------------------------------ milestones

  /**
   * Milestones in timeline order, each with `is_overdue` and its owner resolved.
   *
   * @throws NotFoundException when the project does not exist or is deleted.
   */
  async listMilestones(projectId: string) {
    await this.getProject(projectId);

    const milestones = await this.prisma.project_milestones.findMany({
      where: { project_id: projectId },
      orderBy: [{ due_date: 'asc' }, { created_at: 'asc' }],
    });

    const now = new Date();
    const rows = milestones.map((milestone) => ({
      ...milestone,
      is_overdue: isMilestoneOverdue(milestone, now),
    }));

    return attachUsers(this.prisma, rows, ['owner_id']);
  }

  /**
   * @throws ForbiddenException when the caller is not the Lead or Co-Lead.
   * @throws NotFoundException when the project does not exist or is deleted.
   */
  async addMilestone(
    projectId: string,
    dto: CreateMilestoneDto,
    user: JwtPayload,
  ) {
    await this.getProject(projectId);
    await this.projects.assertLeadOrCoLead(projectId, user.sub);

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.project_milestones.create({
        data: {
          project_id: projectId,
          name: dto.name,
          description: dto.description ?? null,
          owner_id: dto.owner_id ?? null,
          start_date: dto.start_date ? new Date(dto.start_date) : null,
          due_date: dto.due_date ? new Date(dto.due_date) : null,
          status: dto.status ?? 'PLANNED',
        },
      });

      await this.logActivity(
        tx,
        projectId,
        user.sub,
        'MILESTONE',
        `Added milestone "${created.name}"`,
      );

      return created;
    });
  }

  /**
   * @throws ForbiddenException when the caller is not the Lead or Co-Lead.
   * @throws NotFoundException when the project or the milestone does not exist.
   */
  async updateMilestone(
    projectId: string,
    milestoneId: string,
    dto: UpdateMilestoneDto,
    user: JwtPayload,
  ) {
    await this.getProject(projectId);
    await this.projects.assertLeadOrCoLead(projectId, user.sub);

    const milestone = await this.prisma.project_milestones.findFirst({
      where: { id: milestoneId, project_id: projectId },
      select: { id: true },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');

    const data: Prisma.project_milestonesUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.owner_id !== undefined) data.owner_id = dto.owner_id;
    if (dto.start_date !== undefined) data.start_date = new Date(dto.start_date);
    if (dto.due_date !== undefined) data.due_date = new Date(dto.due_date);
    if (dto.status !== undefined) data.status = dto.status;

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.project_milestones.update({
        where: { id: milestoneId },
        data,
      });
      await this.logActivity(
        tx,
        projectId,
        user.sub,
        'MILESTONE',
        `Updated milestone "${row.name}"`,
      );
      return row;
    });

    if (dto.status !== undefined || dto.due_date !== undefined) {
      await this.recomputeHealth(projectId);
    }

    return updated;
  }

  /**
   * @throws ForbiddenException when the caller is not the Lead or Co-Lead.
   * @throws NotFoundException when the project or the milestone does not exist.
   */
  async removeMilestone(
    projectId: string,
    milestoneId: string,
    user: JwtPayload,
  ) {
    await this.getProject(projectId);
    await this.projects.assertLeadOrCoLead(projectId, user.sub);

    const milestone = await this.prisma.project_milestones.findFirst({
      where: { id: milestoneId, project_id: projectId },
      select: { id: true, name: true },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.project_milestones.delete({ where: { id: milestoneId } });
      await this.logActivity(
        tx,
        projectId,
        user.sub,
        'MILESTONE',
        `Removed milestone "${milestone.name}"`,
      );
    });

    await this.recomputeHealth(projectId);

    return { id: milestoneId, deleted: true };
  }

  // ------------------------------------------------------ success criteria

  /**
   * @throws NotFoundException when the project does not exist or is deleted.
   */
  async listSuccessCriteria(projectId: string) {
    await this.getProject(projectId);

    return this.prisma.project_success_criteria.findMany({
      where: { project_id: projectId },
      orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
    });
  }

  /**
   * Adds one criterion. One row per call is the point: they get checked off
   * individually at closure, which a single paragraph on the project cannot do.
   *
   * @throws ForbiddenException when the caller is not the Lead or Co-Lead.
   * @throws NotFoundException when the project does not exist or is deleted.
   */
  async addSuccessCriterion(
    projectId: string,
    dto: CreateSuccessCriterionDto,
    user: JwtPayload,
  ) {
    await this.getProject(projectId);
    await this.projects.assertLeadOrCoLead(projectId, user.sub);

    return this.prisma.project_success_criteria.create({
      data: {
        project_id: projectId,
        criterion: dto.criterion,
        sort_order: dto.sort_order ?? 0,
      },
    });
  }

  /**
   * @throws ForbiddenException when the caller is not the Lead or Co-Lead.
   * @throws NotFoundException when the project or the criterion does not exist.
   */
  async removeSuccessCriterion(
    projectId: string,
    criterionId: string,
    user: JwtPayload,
  ) {
    await this.getProject(projectId);
    await this.projects.assertLeadOrCoLead(projectId, user.sub);

    const { count } = await this.prisma.project_success_criteria.deleteMany({
      where: { id: criterionId, project_id: projectId },
    });
    if (count === 0) throw new NotFoundException('Success criterion not found');

    return { id: criterionId, deleted: true };
  }

  // ------------------------------------------------------------------ KPIs

  /**
   * KPIs for a project. An empty array is a normal answer, not a missing setup
   * step; plenty of projects do not have numbers worth tracking.
   *
   * @throws NotFoundException when the project does not exist or is deleted.
   */
  async listKpis(projectId: string) {
    await this.getProject(projectId);

    return this.prisma.project_kpis.findMany({
      where: { project_id: projectId },
      orderBy: { created_at: 'asc' },
    });
  }

  /**
   * @throws ForbiddenException when the caller is not the Lead or Co-Lead.
   * @throws NotFoundException when the project does not exist or is deleted.
   */
  async addKpi(projectId: string, dto: CreateKpiDto, user: JwtPayload) {
    await this.getProject(projectId);
    await this.projects.assertLeadOrCoLead(projectId, user.sub);

    return this.prisma.project_kpis.create({
      data: {
        project_id: projectId,
        metric: dto.metric,
        target: dto.target ?? null,
        actual: dto.actual ?? null,
        status: dto.status ?? null,
      },
    });
  }

  /**
   * @throws ForbiddenException when the caller is not the Lead or Co-Lead.
   * @throws NotFoundException when the project or the KPI does not exist.
   */
  async updateKpi(
    projectId: string,
    kpiId: string,
    dto: UpdateKpiDto,
    user: JwtPayload,
  ) {
    await this.getProject(projectId);
    await this.projects.assertLeadOrCoLead(projectId, user.sub);

    const kpi = await this.prisma.project_kpis.findFirst({
      where: { id: kpiId, project_id: projectId },
      select: { id: true },
    });
    if (!kpi) throw new NotFoundException('KPI not found');

    const data: Prisma.project_kpisUpdateInput = {};
    if (dto.metric !== undefined) data.metric = dto.metric;
    if (dto.target !== undefined) data.target = dto.target;
    if (dto.actual !== undefined) data.actual = dto.actual;
    if (dto.status !== undefined) data.status = dto.status;

    return this.prisma.project_kpis.update({ where: { id: kpiId }, data });
  }

  // -------------------------------------------------------------- internals

  /**
   * The project row every method in here needs, with the deleted check in one
   * place.
   *
   * @throws NotFoundException when the project does not exist or is deleted.
   */
  private async getProject(projectId: string) {
    const project = await this.prisma.projects.findFirst({
      where: { id: projectId, deleted_at: null },
      select: {
        id: true,
        title: true,
        lead_id: true,
        co_lead_id: true,
        deadline: true,
        health: true,
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  /**
   * The boolean form of `assertLeadOrCoLead`, for the one route where being a
   * member and not a Lead is allowed rather than an error. Calling the shared
   * assertion and catching its Forbidden keeps the rule in one place; anything
   * else it throws is a real failure and is rethrown.
   */
  private async isLeadOrCoLead(
    projectId: string,
    userId: string,
  ): Promise<boolean> {
    try {
      await this.projects.assertLeadOrCoLead(projectId, userId);
      return true;
    } catch (err) {
      if (err instanceof ForbiddenException) return false;
      throw err;
    }
  }

  /** The field set a Lead or Co-Lead may write. Undefined keys are left alone. */
  private leadChecklistFields(
    dto: UpdateChecklistItemDto,
  ): Prisma.project_checklist_itemsUpdateInput {
    const data: Prisma.project_checklist_itemsUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.is_done !== undefined) data.is_done = dto.is_done;
    if (dto.assigned_to_id !== undefined) data.assigned_to_id = dto.assigned_to_id;
    if (dto.due_date !== undefined) data.due_date = new Date(dto.due_date);
    if (dto.sort_order !== undefined) data.sort_order = dto.sort_order;
    return data;
  }

  /** Insert-only. `project_activity_logs` has no update or delete path here. */
  private logActivity(
    tx: Prisma.TransactionClient,
    projectId: string,
    actorId: string,
    actionType: 'CHECKLIST' | 'MILESTONE',
    description: string,
  ) {
    return tx.project_activity_logs.create({
      data: {
        project_id: projectId,
        actor_id: actorId,
        action_type: actionType,
        description,
      },
    });
  }

  /**
   * A member's tick goes to the Lead and Co-Lead, because they are the ones
   * tracking the project. A Lead's edit goes to the assignee, because their
   * work just changed. Either way the actor is never notified of their own
   * action.
   */
  private async notifyChecklistChange(
    project: {
      id: string;
      title: string;
      lead_id: string;
      co_lead_id: string | null;
    },
    item: { title: string; is_done: boolean; assigned_to_id: string | null },
    byLead: boolean,
    actorId: string,
  ): Promise<void> {
    const recipients = new Set<string>();
    if (byLead) {
      if (item.assigned_to_id) recipients.add(item.assigned_to_id);
    } else {
      recipients.add(project.lead_id);
      if (project.co_lead_id) recipients.add(project.co_lead_id);
    }
    recipients.delete(actorId);
    if (recipients.size === 0) return;

    await this.notifications.notifyMany(
      [...recipients].map((recipientId) => ({
        recipientId,
        type: 'PROJECT_CHECKLIST_UPDATED' as const,
        title: 'Project checklist updated',
        message: `${project.title}: "${item.title}" was ${item.is_done ? 'completed' : 'updated'}`,
        entityType: 'project' as const,
        entityId: project.id,
      })),
    );
  }

  /**
   * Recomputes `projects.health` for one project after its inputs changed.
   *
   * `health` is a stored, indexed column the directory filters on, so it cannot
   * be derived at read time. The daily sweep covers deadline drift; this covers
   * the checklist tick that finishes the list at 3pm.
   *
   * @see project-deadline.cron.ts
   */
  private async recomputeHealth(projectId: string): Promise<void> {
    const project = await this.prisma.projects.findFirst({
      where: { id: projectId, deleted_at: null },
      select: { deadline: true, health: true },
    });
    if (!project) return;

    const [items, milestones] = await Promise.all([
      this.prisma.project_checklist_items.findMany({
        where: { project_id: projectId },
        select: { is_done: true, due_date: true },
      }),
      this.prisma.project_milestones.findMany({
        where: { project_id: projectId },
        select: { status: true, due_date: true },
      }),
    ]);

    const now = new Date();
    const health = deriveHealth(
      {
        deadline: project.deadline,
        progress: computeProgress(items),
        overdueItems: items.filter((i) => isChecklistOverdue(i, now)).length,
        overdueMilestones: milestones.filter((m) => isMilestoneOverdue(m, now))
          .length,
      },
      now,
    );

    if (health !== project.health) {
      await this.prisma.projects.update({
        where: { id: projectId },
        data: { health },
      });
    }
  }
}
