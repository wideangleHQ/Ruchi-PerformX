import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskLifecycleService } from './task-lifecycle.service';
//import { NotificationsService } from '../';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskFilterDto } from './dto/task-filter.dto';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { task_status_enum, role_enum } from '@prisma/client';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: TaskLifecycleService,
    // private readonly notifications: NotificationsService,
  ) {}

  // ─── Create ────────────────────────────────────────────────────

  async create(dto: CreateTaskDto, user: JwtPayload) {
    // HOD can only assign within their department
    if (
      user.role === role_enum.HOD &&
      dto.departmentId !== user.departmentId
    ) {
      throw new ForbiddenException('HOD can only assign tasks within their department');
    }

    const task = await this.prisma.tasks.create({
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        due_date: new Date(dto.dueDate),
        assigned_to_id: dto.assignedToId,
        assigned_by_id: user.sub,
        department_id: dto.departmentId,
        parent_task_id: dto.parentTaskId ?? null,
        status: task_status_enum.ASSIGNED,
      },
    });

    await this.prisma.task_status_logs.create({
      data: {
        task_id: task.id,
        from_status: null,
        to_status: task_status_enum.ASSIGNED,
        changed_by_id: user.sub,
      },
    });

    // Notification send skipped (NotificationsService unavailable)
    // await this.notifications.send({
    //   userId: dto.assignedToId,
    //   type: 'TASK_ASSIGNED',
    //   title: 'New Task Assigned',
    //   message: `You have been assigned: ${task.title}`,
    //   taskId: task.id,
    // });

    return task;
  }

  // ─── List (role-scoped) ────────────────────────────────────────

  async findAll(filters: TaskFilterDto, user: JwtPayload) {
    const where: any = { ...this.buildWhereFromFilters(filters) };

    if (user.role === role_enum.HOD) {
      where.department_id = user.departmentId;
    } else if (user.role === role_enum.EMPLOYEE) {
      where.assigned_to_id = user.sub;
    }
    // MD sees all — no extra filter

    return this.prisma.tasks.findMany({
      where,
      include: {
        users_tasks_assigned_to_idTousers: { select: { id: true, full_name: true } },
        users_tasks_assigned_by_idTousers: { select: { id: true, full_name: true } },
        departments: { select: { id: true, name: true } },
      },
      orderBy: { due_date: 'asc' },
    });
  }

  // ─── Find One ──────────────────────────────────────────────────

  async findOne(id: string, user: JwtPayload) {
    const task = await this.prisma.tasks.findUnique({
      where: { id },
      include: {
        users_tasks_assigned_to_idTousers: { select: { id: true, full_name: true } },
        users_tasks_assigned_by_idTousers: { select: { id: true, full_name: true } },
        departments: { select: { id: true, name: true } },
        task_comments: {
          include: { users: { select: { id: true, full_name: true, role: true } } },
          orderBy: { created_at: 'asc' },
        },
        task_status_logs: {
          include: { users: { select: { id: true, full_name: true } } },
          orderBy: { created_at: 'asc' },
        },
        task_attachments: true,
        task_escalations: true,
      },
    });

    if (!task) throw new NotFoundException('Task not found');

    this.assertAccess(task, user);

    return task;
  }

  // ─── Update fields ─────────────────────────────────────────────

  async update(id: string, dto: UpdateTaskDto, user: JwtPayload) {
    const task = await this.getTaskOrFail(id);
    this.assertAccess(task, user);

    const updateData: Record<string, any> = { ...dto };
    if (dto.dueDate) {
      updateData.due_date = new Date(dto.dueDate);
      delete updateData.dueDate;
    }

    return this.prisma.tasks.update({
      where: { id },
      data: updateData,
    });
  }

  // ─── Delete ────────────────────────────────────────────────────

  async remove(id: string, user: JwtPayload) {
    const task = await this.getTaskOrFail(id);

    if (user.role === role_enum.HOD && task.department_id !== user.departmentId) {
      throw new ForbiddenException();
    }

    return this.prisma.tasks.delete({ where: { id } });
  }

  // ─── State Transitions ─────────────────────────────────────────

  async transition(
    id: string,
    toStatus: task_status_enum,
    user: JwtPayload,
    reason?: string,
  ) {
    const task = await this.getTaskOrFail(id);

    // HOD scope check for department-bound transitions
    if (
      user.role === role_enum.HOD &&
      task.department_id !== user.departmentId
    ) {
      throw new ForbiddenException('HOD cannot act on tasks outside their department');
    }

    // Employee can only act on their own assigned task
    if (
      user.role === role_enum.EMPLOYEE &&
      task.assigned_to_id !== user.sub
    ) {
      throw new ForbiddenException('You can only update your own tasks');
    }

    this.lifecycle.validate(task.status ?? task_status_enum.CREATED, toStatus, user, reason);

    const timestamps = this.resolveTimestamps(toStatus);

    const updated = await this.prisma.tasks.update({
      where: { id },
      data: { status: toStatus, ...timestamps },
    });

    await this.prisma.task_status_logs.create({
      data: {
        task_id: id,
        from_status: task.status,
        to_status: toStatus,
        changed_by_id: user.sub,
        reason: reason ?? null,
      },
    });

    await this.sendTransitionNotification(updated, task.status ?? task_status_enum.CREATED, toStatus, user, task.assigned_by_id);

    return updated;
  }

  // ─── Pending Bar ───────────────────────────────────────────────

  async getPending(user: JwtPayload) {
    const where: any = { status: task_status_enum.PENDING };

    if (user.role === role_enum.HOD) where.department_id = user.departmentId;
    else if (user.role === role_enum.EMPLOYEE) where.assigned_to_id = user.sub;

    return this.prisma.tasks.findMany({
      where,
      include: {
        users_tasks_assigned_to_idTousers: { select: { id: true, full_name: true } },
      },
      orderBy: { due_date: 'asc' },
    });
  }

  // ─── Overdue ───────────────────────────────────────────────────

  async getOverdue(user: JwtPayload) {
    const terminalStatuses = [
      task_status_enum.COMPLETED,
      task_status_enum.REVIEWED,
      task_status_enum.CLOSED,
      task_status_enum.REJECTED,
    ];

    const where: any = {
      due_date: { lt: new Date() },
      status: { notIn: terminalStatuses },
    };

    if (user.role === role_enum.HOD) where.department_id = user.departmentId;

    return this.prisma.tasks.findMany({
      where,
      include: {
        users_tasks_assigned_to_idTousers: { select: { id: true, full_name: true } },
        departments: { select: { id: true, name: true } },
      },
      orderBy: { due_date: 'asc' },
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────

  private async getTaskOrFail(id: string) {
    const task = await this.prisma.tasks.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  private assertAccess(task: any, user: JwtPayload) {
    if (user.role === role_enum.MD) return;
    if (user.role === role_enum.HOD && task.department_id === user.departmentId) return;
    if (user.role === role_enum.EMPLOYEE && task.assigned_to_id === user.sub) return;
    throw new ForbiddenException('Access denied to this task');
  }

  private buildWhereFromFilters(filters: TaskFilterDto) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.assignedToId) where.assigned_to_id = filters.assignedToId;
    if (filters.departmentId) where.department_id = filters.departmentId;
    if (filters.dueBefore || filters.dueAfter) {
      where.due_date = {};
      if (filters.dueBefore) where.due_date.lt = new Date(filters.dueBefore);
      if (filters.dueAfter) where.due_date.gt = new Date(filters.dueAfter);
    }
    return where;
  }

  private resolveTimestamps(toStatus: task_status_enum): Record<string, Date | null> {
    const now = new Date();
    switch (toStatus) {
      case task_status_enum.ACCEPTED: return { accepted_at: now };
      case task_status_enum.COMPLETED: return { completed_at: now };
      case task_status_enum.REVIEWED: return { reviewed_at: now };
      case task_status_enum.CLOSED: return { closed_at: now };
      default: return {};
    }
  }

  private async sendTransitionNotification(
    task: any,
    from: task_status_enum,
    to: task_status_enum,
    actor: JwtPayload,
    assignedById: string,
  ) {
    // Notification send skipped (NotificationsService unavailable)
    // const notifyAssigner = (type: any, msg: string) =>
    //   this.notifications.send({ userId: assignedById, type, title: task.title, message: msg, taskId: task.id });
    //
    // const notifyAssignee = (type: any, msg: string) =>
    //   this.notifications.send({ userId: task.assigned_to_id, type, title: task.title, message: msg, taskId: task.id });
    //
    // switch (to) {
    //   case task_status_enum.ACCEPTED:
    //     return notifyAssigner('TASK_ACCEPTED', `Task accepted by assignee`);
    //   case task_status_enum.REJECTED:
    //     return notifyAssigner('TASK_REJECTED', `Task was rejected`);
    //   case task_status_enum.COMPLETED:
    //     return notifyAssigner('TASK_COMPLETED', `Task marked as completed — awaiting your review`);
    // }
  }
}