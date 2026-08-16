import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, deliverable_status_enum, role_enum, task_status_enum } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { NotificationsService } from '../notifications/notifications.service';
import { TaskLifecycleService } from '../tasks/task-lifecycle.service';
import { VendorScopeService } from '../vendors/vendor-scope.service';

import {
  SubmitDeliverableDto,
  VendorMessageDto,
  VendorTaskFilterDto,
  VendorTaskStatusDto,
} from './dto/vendor-portal.dto';

/**
 * Columns a vendor is allowed to see on a task. `department_id`,
 * `assigned_to_id`, `assigned_by_id`, and the delete fields are absent on
 * purpose: the vendor portal shows the work, never who inside RUCHI is doing
 * what with it. Widening this select is a data disclosure change, not a tweak.
 */
const VENDOR_TASK_SELECT = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  due_date: true,
  accepted_at: true,
  completed_at: true,
  created_at: true,
} satisfies Prisma.tasksSelect;

/** Same rule for projects: no lead, no co-lead, no department, no internal health notes. */
const VENDOR_PROJECT_SELECT = {
  id: true,
  project_code: true,
  title: true,
  objective: true,
  description: true,
  status: true,
  priority: true,
  start_date: true,
  deadline: true,
} satisfies Prisma.projectsSelect;

/**
 * Every read and write an external vendor can perform.
 *
 * Each method resolves the vendor with `VendorScopeService.vendorIdForUser`
 * first, then either merges `vendorFilter` into the `where` of a list or calls
 * `assertVendorAccess` before touching a single record. Neither step has a safe
 * default: an unfiltered list query reachable from here returns the whole
 * company's tasks.
 */
@Injectable()
export class VendorPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: VendorScopeService,
    private readonly lifecycle: TaskLifecycleService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Portal landing payload: assigned tasks grouped by status, assigned
   * projects, own deliverables, and the shared message thread's unread-ish
   * count. Nothing about other vendors, employees, or company totals.
   *
   * Throws ForbiddenException when the account carries no `vendor_id`.
   */
  async dashboard(user: JwtPayload) {
    const vendorId = await this.scope.vendorIdForUser(user.sub);

    const [tasks, projects, deliverables, messages] = await Promise.all([
      this.prisma.tasks.findMany({
        where: { ...(await this.scope.vendorFilter(vendorId, 'task')), deleted_at: null },
        select: VENDOR_TASK_SELECT,
        orderBy: { due_date: 'asc' },
      }),
      this.prisma.projects.findMany({
        where: { ...(await this.scope.vendorFilter(vendorId, 'project')), deleted_at: null },
        select: VENDOR_PROJECT_SELECT,
        orderBy: { deadline: 'asc' },
      }),
      this.prisma.vendor_deliverables.findMany({
        where: { vendor_id: vendorId },
        orderBy: { due_date: 'asc' },
      }),
      this.sharedThread(vendorId),
    ]);

    const tasksByStatus: Record<string, typeof tasks> = {};
    for (const task of tasks) {
      const key = task.status ?? task_status_enum.CREATED;
      (tasksByStatus[key] ??= []).push(task);
    }

    return {
      tasksByStatus,
      projects,
      deliverables,
      messages: messages.slice(0, 5),
      counts: {
        tasks: tasks.length,
        projects: projects.length,
        deliverables: deliverables.length,
        deliverablesPending: deliverables.filter(
          (d) => d.status === deliverable_status_enum.PENDING || d.status === deliverable_status_enum.IN_PROGRESS,
        ).length,
        messages: messages.length,
      },
    };
  }

  /**
   * Assigned tasks only, optionally narrowed by status. The `vendorFilter`
   * merge is what makes this safe; without it the same query returns every
   * task in the company.
   */
  async tasks(user: JwtPayload, filters: VendorTaskFilterDto) {
    const vendorId = await this.scope.vendorIdForUser(user.sub);
    const scoped = await this.scope.vendorFilter(vendorId, 'task');

    return this.prisma.tasks.findMany({
      where: {
        ...scoped,
        deleted_at: null,
        ...(filters.status ? { status: filters.status } : {}),
      },
      select: VENDOR_TASK_SELECT,
      orderBy: { due_date: 'asc' },
    });
  }

  /**
   * One task plus its attachments and the shared message thread.
   *
   * Throws ForbiddenException when the vendor holds no ACTIVE assignment to
   * this task, NotFoundException when the task is gone or soft-deleted.
   */
  async task(user: JwtPayload, id: string) {
    const vendorId = await this.scope.vendorIdForUser(user.sub);
    await this.scope.assertVendorAccess(vendorId, 'task', id);

    const task = await this.prisma.tasks.findFirst({
      where: { id, deleted_at: null },
      select: VENDOR_TASK_SELECT,
    });
    if (!task) throw new NotFoundException('Task not found');

    const attachments = await this.prisma.task_attachments.findMany({
      where: { task_id: id },
      select: { id: true, file_name: true, file_url: true, file_type: true, file_size_kb: true, created_at: true },
      orderBy: { created_at: 'asc' },
    });

    return { ...task, attachments, messages: await this.sharedThread(vendorId) };
  }

  /**
   * Moves an assigned task through one of the four vendor transitions.
   *
   * `assertVendorAccess` gates the record, the DTO gates which status may be
   * named, and `TaskLifecycleService.validate` gates whether that status is
   * legal from the current one for a VENDOR. Notifies the assigning employee.
   *
   * Throws ForbiddenException when unassigned or when the transition is not a
   * vendor's to make, BadRequestException when the transition is invalid or a
   * rejection arrives with no reason.
   */
  async updateTaskStatus(user: JwtPayload, id: string, dto: VendorTaskStatusDto) {
    const vendorId = await this.scope.vendorIdForUser(user.sub);
    await this.scope.assertVendorAccess(vendorId, 'task', id);

    const task = await this.prisma.tasks.findFirst({
      where: { id, deleted_at: null },
      select: { id: true, title: true, status: true, assigned_by_id: true },
    });
    if (!task) throw new NotFoundException('Task not found');

    const from = task.status ?? task_status_enum.CREATED;
    this.lifecycle.validate(from, dto.status, user, dto.reason);

    const updated = await this.prisma.tasks.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.status === task_status_enum.ACCEPTED ? { accepted_at: new Date() } : {}),
        ...(dto.status === task_status_enum.COMPLETED ? { completed_at: new Date() } : {}),
      },
      select: VENDOR_TASK_SELECT,
    });

    await this.prisma.task_status_logs.create({
      data: {
        task_id: id,
        from_status: from,
        to_status: dto.status,
        changed_by_id: user.sub,
        reason: dto.reason ?? null,
      },
    });

    await this.notifications.notify({
      recipientId: task.assigned_by_id,
      type: 'VENDOR_TASK_UPDATED',
      title: `Vendor moved "${task.title}" to ${dto.status}`,
      message: dto.reason ?? `${user.fullName ?? user.username} set the task to ${dto.status}.`,
      entityType: 'task',
      entityId: id,
    });

    return updated;
  }

  /** Assigned projects only, same `vendorFilter` merge as the task list. */
  async projects(user: JwtPayload) {
    const vendorId = await this.scope.vendorIdForUser(user.sub);
    const scoped = await this.scope.vendorFilter(vendorId, 'project');

    return this.prisma.projects.findMany({
      where: { ...scoped, deleted_at: null },
      select: VENDOR_PROJECT_SELECT,
      orderBy: { deadline: 'asc' },
    });
  }

  /**
   * One assigned project. Throws ForbiddenException when unassigned,
   * NotFoundException when it is gone.
   */
  async project(user: JwtPayload, id: string) {
    const vendorId = await this.scope.vendorIdForUser(user.sub);
    await this.scope.assertVendorAccess(vendorId, 'project', id);

    const project = await this.prisma.projects.findFirst({
      where: { id, deleted_at: null },
      select: VENDOR_PROJECT_SELECT,
    });
    if (!project) throw new NotFoundException('Project not found');

    return project;
  }

  /** Deliverables belonging to this vendor. `vendor_id` is the ownership column. */
  async deliverables(user: JwtPayload) {
    const vendorId = await this.scope.vendorIdForUser(user.sub);

    return this.prisma.vendor_deliverables.findMany({
      where: { vendor_id: vendorId },
      orderBy: { due_date: 'asc' },
    });
  }

  /**
   * Marks one of the vendor's own deliverables SUBMITTED and stamps the date.
   *
   * The `vendor_id` in the `where` is the access check: a deliverable belonging
   * to another vendor simply is not found. Notifies the internal owner.
   *
   * Throws NotFoundException when the deliverable is not this vendor's.
   */
  async submitDeliverable(user: JwtPayload, id: string, dto: SubmitDeliverableDto) {
    const vendorId = await this.scope.vendorIdForUser(user.sub);

    const deliverable = await this.prisma.vendor_deliverables.findFirst({
      where: { id, vendor_id: vendorId },
      select: { id: true, name: true, owner_id: true },
    });
    if (!deliverable) throw new NotFoundException('Deliverable not found');

    const updated = await this.prisma.vendor_deliverables.update({
      where: { id },
      data: {
        status: deliverable_status_enum.SUBMITTED,
        submitted_date: new Date(),
        ...(dto.remarks ? { remarks: dto.remarks } : {}),
      },
    });

    // ponytail: reuses VENDOR_DELIVERABLE_DUE, the only deliverable type in
    // notification_type_enum and already routed to the internal owner with
    // email on. Add VENDOR_DELIVERABLE_SUBMITTED when the schema next moves;
    // the enum lives in the spine commit, not in this module.
    await this.notifications.notify({
      recipientId: deliverable.owner_id,
      type: 'VENDOR_DELIVERABLE_DUE',
      title: `Deliverable submitted: ${deliverable.name}`,
      message: dto.remarks ?? 'The vendor has submitted this deliverable for review.',
      entityType: 'vendor',
      entityId: vendorId,
    });

    return updated;
  }

  /** The shared vendor thread. Internal notes are unreachable from here. */
  async messages(user: JwtPayload) {
    const vendorId = await this.scope.vendorIdForUser(user.sub);
    return this.sharedThread(vendorId);
  }

  /**
   * Appends to the shared thread. `is_internal` is written as `false` here and
   * is not settable from the DTO, so a vendor cannot post into the RUCHI-only
   * thread. Notifies the vendor's internal owner, the side that did not send.
   */
  async postMessage(user: JwtPayload, dto: VendorMessageDto) {
    const vendorId = await this.scope.vendorIdForUser(user.sub);

    const note = await this.prisma.vendor_notes.create({
      data: {
        vendor_id: vendorId,
        author_id: user.sub,
        content: dto.content,
        is_internal: false,
      },
    });

    const vendor = await this.prisma.vendors.findUnique({
      where: { id: vendorId },
      select: { name: true, owner_id: true },
    });
    if (vendor) {
      await this.notifications.notify({
        recipientId: vendor.owner_id,
        type: 'VENDOR_MESSAGE',
        title: `Message from ${vendor.name}`,
        message: dto.content.slice(0, 200),
        entityType: 'vendor',
        entityId: vendorId,
      });
    }

    return note;
  }

  /**
   * Reads the vendor-facing half of `vendor_notes`.
   *
   * `is_internal: false` is hardcoded and there is no parameter to change it.
   * That is the point: section 12 of the vendor chapter makes the internal
   * thread RUCHI-only, and a flag argument here would be one typo away from
   * handing it over.
   */
  private async sharedThread(vendorId: string) {
    const notes = await this.prisma.vendor_notes.findMany({
      where: { vendor_id: vendorId, is_internal: false },
      orderBy: { created_at: 'desc' },
      take: 100,
    });

    const authors = await this.prisma.users.findMany({
      where: { id: { in: [...new Set(notes.map((n) => n.author_id))] } },
      select: { id: true, full_name: true, role: true },
    });
    const byId = new Map(authors.map((a) => [a.id, a]));

    return notes.map((note) => ({
      id: note.id,
      content: note.content,
      created_at: note.created_at,
      author_name: byId.get(note.author_id)?.full_name ?? 'RUCHI',
      from_vendor: byId.get(note.author_id)?.role === role_enum.VENDOR,
    }));
  }
}
