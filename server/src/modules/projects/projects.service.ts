import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  project_members,
  project_status_enum,
  projects,
  role_enum,
} from '@prisma/client';
import { attachUsers } from '../../common/helpers/user-lookup.helper';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectFilterDto } from './dto/project-filter.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

const S = project_status_enum;

/**
 * Every status a project may move to from the one it is in, transcribed from
 * the lifecycle diagram in docs/src/p2_projects.md. Same shape as the table in
 * `task-lifecycle.service.ts`, and here for the same reason: a PATCH that
 * accepts any enum value is not a lifecycle, it is a text field.
 *
 * ponytail: cancelling is reachable from ACTIVE only, exactly as the diagram
 * draws it. A DRAFT nobody wants gets deleted rather than cancelled. If the
 * client asks for DRAFT or PLANNED to CANCELLED, add the two entries here and
 * the two cases to project-lifecycle.spec.ts; nothing else needs to change.
 */
export const PROJECT_TRANSITIONS: Record<
  project_status_enum,
  project_status_enum[]
> = {
  [S.DRAFT]: [S.PLANNED],
  [S.PLANNED]: [S.ACTIVE],
  [S.ACTIVE]: [S.ON_HOLD, S.AT_RISK, S.COMPLETED, S.CANCELLED, S.ARCHIVED],
  [S.ON_HOLD]: [S.ACTIVE, S.ARCHIVED],
  [S.AT_RISK]: [S.ACTIVE, S.ARCHIVED],
  [S.COMPLETED]: [S.ARCHIVED],
  [S.CANCELLED]: [S.ARCHIVED],
  [S.ARCHIVED]: [],
};

/**
 * Whether a project in `from` may move to `to`.
 *
 * `hasClosureReport` gates COMPLETED and is ignored for every other target.
 * The unique constraint on `project_closure_reports.project_id` is what makes
 * the boolean trustworthy: there is at most one report per project, so its
 * existence is the whole question.
 *
 * Pure, so the table can be tested without a database. Returns false rather
 * than throwing; the caller decides what the refusal means.
 */
export function canTransition(
  from: project_status_enum,
  to: project_status_enum,
  hasClosureReport: boolean,
): boolean {
  if (!PROJECT_TRANSITIONS[from].includes(to)) return false;
  if (to === S.COMPLETED) return hasClosureReport;
  return true;
}

/** Roles on `project_members` that may write to a project. */
const LEADERSHIP = ['PROJECT_LEAD', 'CO_LEAD'];

/** Statuses where a passed deadline still means the project is late. */
const OPEN_STATUSES: project_status_enum[] = [
  S.DRAFT,
  S.PLANNED,
  S.ACTIVE,
  S.ON_HOLD,
  S.AT_RISK,
];

const describeDate = (value: Date | null) =>
  value ? value.toISOString() : 'none';

type ActivityAction =
  | 'PROJECT_CREATED'
  | 'PROJECT_DELETED'
  | 'STATUS_CHANGED'
  | 'DEADLINE_CHANGED'
  | 'MEMBER_ADDED'
  | 'MEMBER_REMOVED'
  | 'LEAD_CHANGED';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // -------------------------------------------------------------- access

  /**
   * The project, if it exists and has not been soft deleted.
   *
   * This is the whole read check. Project visibility is company wide: any
   * internal user may open any project and read its checklist, milestones,
   * outcomes, and activity. Participation is the part that is restricted, and
   * that is what the two asserts below are for.
   *
   * Vendors are excluded by the `@Roles` list on the controller, not here,
   * because a vendor's scope comes from `vendor_assignments` and lives in the
   * vendor portal namespace.
   *
   * @throws NotFoundException when the project is missing or deleted.
   */
  async assertVisible(projectId: string): Promise<projects> {
    const project = await this.prisma.projects.findFirst({
      where: { id: projectId, deleted_at: null },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  /**
   * The caller's `project_members` row, proving they are on the project.
   *
   * Callers that gate writing must also reject `role === 'OBSERVER'`: an
   * observer is a member for every read and for none of the writes. The row is
   * returned rather than a boolean precisely so that check is one comparison
   * at the call site instead of a second query.
   *
   * @throws NotFoundException when the project is missing or deleted.
   * @throws ForbiddenException when the user is not a member.
   */
  async assertMember(
    projectId: string,
    userId: string,
  ): Promise<project_members> {
    await this.assertVisible(projectId);

    const member = await this.prisma.project_members.findUnique({
      where: { project_id_user_id: { project_id: projectId, user_id: userId } },
    });
    if (!member) {
      throw new ForbiddenException('You are not a member of this project');
    }
    return member;
  }

  /**
   * The caller's `project_members` row, proving they lead the project.
   *
   * `RolesGuard` cannot express this. It sees the role on the JWT and nothing
   * about which projects that person leads, so every endpoint the spec gives
   * to "Lead, Co-Lead" calls this first.
   *
   * @throws NotFoundException when the project is missing or deleted.
   * @throws ForbiddenException when the user is not the Lead or Co-Lead.
   */
  async assertLeadOrCoLead(
    projectId: string,
    userId: string,
  ): Promise<project_members> {
    const member = await this.assertMember(projectId, userId);
    if (!LEADERSHIP.includes(member.role)) {
      throw new ForbiddenException(
        'Only the project Lead or Co-Lead can do this',
      );
    }
    return member;
  }

  // -------------------------------------------------------------- commands

  /**
   * Creates a project, seeds its member list, and logs the creation.
   *
   * The lead defaults to the caller. Lead and Co-Lead get their member rows
   * here rather than through the invite endpoint, so a project is never
   * briefly leaderless. Both are notified unless they created it themselves.
   *
   * @throws BadRequestException when the lead and co-lead are the same person,
   *   or either is not an active internal user.
   */
  async create(dto: CreateProjectDto, user: JwtPayload) {
    const leadId = dto.lead_id ?? user.sub;
    const coLeadId = dto.co_lead_id ?? null;
    if (coLeadId && coLeadId === leadId) {
      throw new BadRequestException('The co-lead cannot also be the lead');
    }

    await this.assertAssignable([leadId, coLeadId]);

    const project = await this.withCodeRetry(() =>
      this.prisma.$transaction(async (tx) => {
        const created = await tx.projects.create({
          data: {
            project_code: await this.nextProjectCode(tx),
            title: dto.title,
            objective: dto.objective,
            description: dto.description,
            project_type: dto.project_type ?? null,
            category: dto.category ?? null,
            priority: dto.priority ?? 'MEDIUM',
            tags: dto.tags ?? [],
            lead_id: leadId,
            co_lead_id: coLeadId,
            created_by_id: user.sub,
            department_id: dto.department_id ?? user.departmentId,
            start_date: dto.start_date ? new Date(dto.start_date) : null,
            deadline: dto.deadline ? new Date(dto.deadline) : null,
            is_rnd: dto.is_rnd ?? false,
            rnd_category: dto.rnd_category ?? null,
          },
        });

        await tx.project_members.createMany({
          data: [
            { project_id: created.id, user_id: leadId, role: 'PROJECT_LEAD' },
            ...(coLeadId
              ? [{ project_id: created.id, user_id: coLeadId, role: 'CO_LEAD' }]
              : []),
          ],
        });

        await this.logActivity(
          tx,
          created.id,
          user.sub,
          'PROJECT_CREATED',
          `Created project ${created.project_code}`,
        );

        return created;
      }),
    );

    const invited = [leadId, coLeadId].filter(
      (id): id is string => !!id && id !== user.sub,
    );
    if (invited.length > 0) {
      await this.notifications.notifyMany(
        invited.map((id) => this.invitation(id, project)),
      );
    }

    return project;
  }

  /**
   * Applies an edit from the Lead or Co-Lead.
   *
   * `project_code` is not on the DTO and is never written here. A `status` in
   * the payload goes through `canTransition`, so a legal enum value is still
   * refused when it is not a legal move for this project. Status, deadline,
   * and leadership changes each leave an activity row.
   *
   * Changing `lead_id` or `co_lead_id` rewrites the matching `project_members`
   * rows in the same transaction: the outgoing leader stays on the project as
   * a plain MEMBER rather than being dropped from it.
   *
   * @throws NotFoundException when the project is missing or deleted.
   * @throws ForbiddenException when the caller is not the Lead or Co-Lead.
   * @throws BadRequestException on an illegal transition, on COMPLETED without
   *   a closure report, or when the lead and co-lead would be the same person.
   */
  async update(id: string, dto: UpdateProjectDto, user: JwtPayload) {
    const project = await this.assertVisible(id);
    await this.assertLeadOrCoLead(id, user.sub);

    const nextLead = dto.lead_id ?? project.lead_id;
    const nextCoLead =
      dto.co_lead_id === undefined ? project.co_lead_id : dto.co_lead_id;
    if (nextCoLead && nextCoLead === nextLead) {
      throw new BadRequestException('The co-lead cannot also be the lead');
    }
    await this.assertAssignable([
      dto.lead_id ?? null,
      dto.co_lead_id ?? null,
    ]);

    const data: Prisma.projectsUncheckedUpdateInput = { updated_at: new Date() };
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.objective !== undefined) data.objective = dto.objective;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.project_type !== undefined) data.project_type = dto.project_type;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.tags !== undefined) data.tags = dto.tags;
    if (dto.department_id !== undefined) data.department_id = dto.department_id;
    if (dto.is_rnd !== undefined) data.is_rnd = dto.is_rnd;
    if (dto.rnd_category !== undefined) data.rnd_category = dto.rnd_category;
    if (dto.start_date !== undefined) {
      data.start_date = dto.start_date ? new Date(dto.start_date) : null;
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.deadline !== undefined) {
        const deadline = dto.deadline ? new Date(dto.deadline) : null;
        if (deadline?.getTime() !== project.deadline?.getTime()) {
          data.deadline = deadline;
          await this.logActivity(
            tx,
            id,
            user.sub,
            'DEADLINE_CHANGED',
            `Deadline changed from ${describeDate(project.deadline)} to ${describeDate(deadline)}`,
          );
        }
      }

      if (dto.status !== undefined && dto.status !== project.status) {
        const hasClosureReport =
          dto.status === S.COMPLETED
            ? (await tx.project_closure_reports.count({
                where: { project_id: id },
              })) > 0
            : false;

        if (!canTransition(project.status, dto.status, hasClosureReport)) {
          throw new BadRequestException(
            dto.status === S.COMPLETED && !hasClosureReport
              ? 'A closure report is required before a project can be completed'
              : `Invalid transition: ${project.status} to ${dto.status}`,
          );
        }

        data.status = dto.status;
        if (dto.status === S.COMPLETED) data.closed_at = new Date();
        await this.logActivity(
          tx,
          id,
          user.sub,
          'STATUS_CHANGED',
          `Status changed from ${project.status} to ${dto.status}`,
        );
      }

      if (dto.lead_id !== undefined && dto.lead_id !== project.lead_id) {
        data.lead_id = dto.lead_id;
        await this.setMemberRole(tx, id, project.lead_id, 'MEMBER');
        await this.setMemberRole(tx, id, dto.lead_id, 'PROJECT_LEAD');
        await this.logActivity(
          tx,
          id,
          user.sub,
          'LEAD_CHANGED',
          'Project Lead changed',
        );
      }

      if (dto.co_lead_id !== undefined && dto.co_lead_id !== project.co_lead_id) {
        data.co_lead_id = dto.co_lead_id;
        if (project.co_lead_id) {
          await this.setMemberRole(tx, id, project.co_lead_id, 'MEMBER');
        }
        if (dto.co_lead_id) {
          await this.setMemberRole(tx, id, dto.co_lead_id, 'CO_LEAD');
        }
        await this.logActivity(
          tx,
          id,
          user.sub,
          'LEAD_CHANGED',
          'Project Co-Lead changed',
        );
      }

      return tx.projects.update({ where: { id }, data });
    });
  }

  /**
   * Soft deletes a project by stamping `deleted_at`.
   *
   * The Lead or the MD, per the spec. Not the Co-Lead: deleting is the one
   * project action that is not shared leadership. Rows stay for the audit
   * history and every list query already filters `deleted_at: null`.
   *
   * @throws NotFoundException when the project is missing or already deleted.
   * @throws ForbiddenException when the caller is neither the Lead nor the MD.
   */
  async remove(id: string, user: JwtPayload) {
    const project = await this.assertVisible(id);
    if (project.lead_id !== user.sub && user.role !== role_enum.MD) {
      throw new ForbiddenException(
        'Only the project Lead or the MD can delete a project',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await this.logActivity(
        tx,
        id,
        user.sub,
        'PROJECT_DELETED',
        `Deleted project ${project.project_code}`,
      );
      return tx.projects.update({
        where: { id },
        data: { deleted_at: new Date(), updated_at: new Date() },
      });
    });
  }

  /**
   * Adds a MEMBER or an OBSERVER and notifies them.
   *
   * The picker behind this endpoint lists every active internal user, not the
   * caller's department, because cross-departmental membership is the point of
   * the module. Leadership is assigned through PATCH instead, so this endpoint
   * cannot produce a project with two leads.
   *
   * @throws NotFoundException when the project is missing or deleted.
   * @throws ForbiddenException when the caller is not the Lead or Co-Lead.
   * @throws BadRequestException when the user is already on the project or is
   *   not an active internal user.
   */
  async addMember(id: string, dto: AddProjectMemberDto, user: JwtPayload) {
    const project = await this.assertVisible(id);
    await this.assertLeadOrCoLead(id, user.sub);
    await this.assertAssignable([dto.user_id]);

    const existing = await this.prisma.project_members.findUnique({
      where: { project_id_user_id: { project_id: id, user_id: dto.user_id } },
    });
    if (existing) {
      throw new BadRequestException('That user is already on this project');
    }

    const member = await this.prisma.$transaction(async (tx) => {
      const row = await tx.project_members.create({
        data: {
          project_id: id,
          user_id: dto.user_id,
          role: dto.role ?? 'MEMBER',
        },
      });
      await this.logActivity(
        tx,
        id,
        user.sub,
        'MEMBER_ADDED',
        `Added a ${row.role} to the project`,
      );
      return row;
    });

    await this.notifications.notify(this.invitation(dto.user_id, project));

    return member;
  }

  /**
   * Removes a member from a project.
   *
   * The Lead cannot be removed: `projects.lead_id` is not nullable and a
   * project without a lead has nobody who can close it. Reassign the lead
   * through PATCH first. Removing the Co-Lead clears `projects.co_lead_id` in
   * the same transaction so the column and the member list cannot disagree.
   *
   * @throws NotFoundException when the project or the membership is missing.
   * @throws ForbiddenException when the caller is not the Lead or Co-Lead.
   * @throws BadRequestException when the target is the project Lead.
   */
  async removeMember(id: string, userId: string, user: JwtPayload) {
    const project = await this.assertVisible(id);
    await this.assertLeadOrCoLead(id, user.sub);

    const member = await this.prisma.project_members.findUnique({
      where: { project_id_user_id: { project_id: id, user_id: userId } },
    });
    if (!member) throw new NotFoundException('That user is not on this project');
    if (userId === project.lead_id) {
      throw new BadRequestException(
        'Reassign the Project Lead before removing them',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.project_members.delete({ where: { id: member.id } });
      if (userId === project.co_lead_id) {
        await tx.projects.update({
          where: { id },
          data: { co_lead_id: null, updated_at: new Date() },
        });
      }
      await this.logActivity(
        tx,
        id,
        user.sub,
        'MEMBER_REMOVED',
        `Removed a ${member.role} from the project`,
      );
    });

    return { removed: true };
  }

  // -------------------------------------------------------------- queries

  /**
   * The project directory, filtered and paginated.
   *
   * Every clause is additive, so the filters compose. Soft deleted projects
   * are excluded here and in every other read on this service.
   *
   * Lead, Co-Lead, and creator are resolved through `attachUsers`, because
   * these tables carry plain FK columns and no Prisma relations.
   */
  async findAll(filter: ProjectFilterDto, user: JwtPayload) {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const clauses: Prisma.projectsWhereInput[] = [{ deleted_at: null }];

    if (filter.search) {
      clauses.push({
        OR: [
          { title: { contains: filter.search, mode: 'insensitive' } },
          { project_code: { contains: filter.search, mode: 'insensitive' } },
          { objective: { contains: filter.search, mode: 'insensitive' } },
          { description: { contains: filter.search, mode: 'insensitive' } },
        ],
      });
    }
    if (filter.status) clauses.push({ status: filter.status });
    if (filter.health) clauses.push({ health: filter.health });
    if (filter.priority) clauses.push({ priority: filter.priority });
    if (filter.category) clauses.push({ category: filter.category });
    if (filter.departmentId) clauses.push({ department_id: filter.departmentId });
    if (filter.leadId) clauses.push({ lead_id: filter.leadId });

    if (filter.dateFrom || filter.dateTo) {
      clauses.push({
        created_at: {
          ...(filter.dateFrom ? { gte: new Date(filter.dateFrom) } : {}),
          ...(filter.dateTo ? { lte: new Date(filter.dateTo) } : {}),
        },
      });
    }

    if (filter.mine) {
      const memberships = await this.prisma.project_members.findMany({
        where: { user_id: user.sub },
        select: { project_id: true },
      });
      clauses.push({ id: { in: memberships.map((m) => m.project_id) } });
    }

    const now = new Date();
    if (filter.overdue) {
      clauses.push({ deadline: { lt: now }, status: { in: OPEN_STATUSES } });
    }
    if (filter.dueThisWeek) {
      const inAWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      clauses.push({ deadline: { gte: now, lte: inAWeek } });
    }

    const where: Prisma.projectsWhereInput = { AND: clauses };

    const [rows, total] = await Promise.all([
      this.prisma.projects.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.projects.count({ where }),
    ]);

    return {
      data: await attachUsers(this.prisma, rows, [
        'lead_id',
        'co_lead_id',
        'created_by_id',
      ]),
      total,
      page,
      limit,
    };
  }

  /** The directory narrowed to projects the caller is a member of. */
  async findMine(filter: ProjectFilterDto, user: JwtPayload) {
    return this.findAll({ ...filter, mine: true }, user);
  }

  /**
   * One project with its member list, for the detail page header.
   *
   * Readable by any internal user. The checklist, milestones, KPIs, messages,
   * and outcomes have their own endpoints on the sibling controllers.
   *
   * @throws NotFoundException when the project is missing or deleted.
   */
  async findOne(id: string) {
    const project = await this.assertVisible(id);

    const members = await this.prisma.project_members.findMany({
      where: { project_id: id },
      orderBy: { joined_at: 'asc' },
    });

    const [withPeople] = await attachUsers(this.prisma, [project], [
      'lead_id',
      'co_lead_id',
      'created_by_id',
    ]);

    return {
      ...withPeople,
      members: await attachUsers(this.prisma, members, ['user_id']),
    };
  }

  /**
   * The project's activity history, newest first.
   *
   * Readable by any internal user, and insert only: there is no update or
   * delete path to `project_activity_logs` anywhere in this module, which is
   * what makes it answer "who changed the deadline and when".
   *
   * ponytail: latest 200 rows, no pagination. A project that outgrows that
   * needs a cursor on `created_at`, which the index already supports.
   *
   * @throws NotFoundException when the project is missing or deleted.
   */
  async findActivity(id: string) {
    await this.assertVisible(id);

    const rows = await this.prisma.project_activity_logs.findMany({
      where: { project_id: id },
      orderBy: { created_at: 'desc' },
      take: 200,
    });

    return attachUsers(this.prisma, rows, ['actor_id']);
  }

  // -------------------------------------------------------------- internals

  /**
   * Runs a create, retrying up to three times when two callers read the same
   * highest `project_code` and the unique constraint rejected the second.
   * Anything else, including a P2002 on another column, is rethrown untouched.
   */
  private async withCodeRetry<T>(run: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await run();
      } catch (error) {
        const collided =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          String(error.meta?.['target'] ?? '').includes('project_code');
        if (!collided || attempt === 3) throw error;
      }
    }
  }

  /**
   * Next `PRJ-0001` style code: highest existing code plus one.
   *
   * ponytail: no Postgres sequence, and the sort is lexical, so this holds to
   * PRJ-9999 and stops advancing after it. A real sequence is the upgrade for
   * that and for the collision `withCodeRetry` currently absorbs.
   */
  private async nextProjectCode(tx: Prisma.TransactionClient): Promise<string> {
    const latest = await tx.projects.findFirst({
      where: { project_code: { startsWith: 'PRJ-' } },
      orderBy: { project_code: 'desc' },
      select: { project_code: true },
    });

    const previous = Number(latest?.project_code.slice(4));
    const next = Number.isFinite(previous) ? previous + 1 : 1;
    return `PRJ-${String(next).padStart(4, '0')}`;
  }

  /**
   * Rejects a lead, co-lead, or invitee who cannot hold the role.
   *
   * Nulls are skipped, so callers pass the optional fields straight in.
   *
   * @throws BadRequestException when an id is unknown, inactive, soft deleted,
   *   or belongs to a vendor. Vendors reach projects through
   *   `vendor_assignments` and the vendor portal, never through membership.
   */
  private async assertAssignable(ids: (string | null)[]): Promise<void> {
    const wanted = [...new Set(ids.filter((id): id is string => !!id))];
    if (wanted.length === 0) return;

    const found = await this.prisma.users.count({
      where: {
        id: { in: wanted },
        deleted_at: null,
        is_active: true,
        role: { not: role_enum.VENDOR },
      },
    });
    if (found !== wanted.length) {
      throw new BadRequestException(
        'One of those users is not an active internal user',
      );
    }
  }

  /** Upserts a member row at the given project role. */
  private async setMemberRole(
    tx: Prisma.TransactionClient,
    projectId: string,
    userId: string,
    role: string,
  ) {
    return tx.project_members.upsert({
      where: { project_id_user_id: { project_id: projectId, user_id: userId } },
      create: { project_id: projectId, user_id: userId, role },
      update: { role },
    });
  }

  /** Appends one immutable activity row. The only write path to that table. */
  private async logActivity(
    tx: Prisma.TransactionClient,
    projectId: string,
    actorId: string,
    action: ActivityAction,
    description: string,
  ) {
    return tx.project_activity_logs.create({
      data: {
        project_id: projectId,
        actor_id: actorId,
        action_type: action,
        description,
      },
    });
  }

  /** The PROJECT_INVITED payload for one recipient. */
  private invitation(recipientId: string, project: projects) {
    return {
      recipientId,
      type: 'PROJECT_INVITED' as const,
      title: 'Added to a project',
      message: `You were added to ${project.project_code} ${project.title}`,
      entityType: 'project' as const,
      entityId: project.id,
    };
  }
}
