import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskLifecycleService } from './task-lifecycle.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskFilterDto } from './dto/task-filter.dto';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { Prisma, task_status_enum, role_enum, notification_type_enum, task_type_enum } from '@prisma/client';
import { AttachmentsService } from '../attachments/attachments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UploadedFile } from '../../common/types/uploaded-file.type';

const ASSISTANT_ROLES: role_enum[] = [role_enum.EA, role_enum.PA, role_enum.DEPARTMENT_CONTROLLER];
const DEPARTMENT_SCOPED_ROLES: role_enum[] = [role_enum.HOD, role_enum.PURCHASE_HEAD, ...ASSISTANT_ROLES];

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: TaskLifecycleService,
    private readonly attachmentsService: AttachmentsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private mappedDepts(user: JwtPayload): string[] {
    return user.departmentIds?.length
      ? user.departmentIds
      : user.departmentId
        ? [user.departmentId]
        : [];
  }

  async create(dto: CreateTaskDto, user: JwtPayload, attachments: UploadedFile[] = []) {
    try {
      const tasks = await this.prisma.$transaction(async (tx) => this.createTaskRecords(tx, dto, user));
      const createdAttachmentIds: string[] = [];

      try {
        if (attachments.length) {
          for (const task of tasks) {
            const uploadedAttachments = await this.attachmentsService.uploadTaskAttachments(task.id, attachments, user);
            createdAttachmentIds.push(...uploadedAttachments.map((attachment) => attachment.id));
          }
        }
      } catch (error) {
        for (const attachmentId of createdAttachmentIds.reverse()) {
          try {
            await this.attachmentsService.remove(attachmentId, user);
          } catch {
            // Best-effort cleanup; task deletion below removes any remaining DB rows.
          }
        }
        await this.prisma.tasks.deleteMany({ where: { id: { in: tasks.map((task) => task.id) } } });
        throw error;
      }

      const createdTask = tasks[0];
      if (!createdTask) {
        throw new BadRequestException('Failed to create task');
      }

      return this.findOne(createdTask.id, user);
    } catch (error: any) {
      throw error;
    }
  }

  async createInTransaction(dto: CreateTaskDto, user: JwtPayload, tx: any) {
    const tasks = await this.createTaskRecords(tx, dto, user);
    return tasks[0];
  }

  async findAll(filters: TaskFilterDto, user: JwtPayload) {
    const baseWhere = this.buildWhereFromFilters(filters);
    const conditions: Prisma.tasksWhereInput[] = [baseWhere];

    if (user.role === role_enum.MD || user.role === role_enum.ADMIN) {
      // no-op
    } else if (DEPARTMENT_SCOPED_ROLES.includes(user.role)) {
      conditions.push(this.departmentVisibility(this.mappedDepts(user)));
    } else {
      conditions.push({
        OR: [
          { assigned_to_id: user.sub },
          { assigned_by_id: user.sub },
        ],
      });
      if (user.departmentId) {
        conditions.push(this.departmentVisibility([user.departmentId]));
      }
    }

    const where: Prisma.tasksWhereInput = { AND: conditions };

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const [data, total] = await Promise.all([
      this.prisma.tasks.findMany({
        where,
        include: this.taskInclude(),
        orderBy: { due_date: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.tasks.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      hasMore: page * limit < total,
    };
  }

  async findOne(id: string, user: JwtPayload) {
    const task = await this.prisma.tasks.findFirst({
      where: { id, deleted_at: null },
      include: {
        ...this.taskInclude(),
        task_comments: {
          include: { users: { select: { id: true, full_name: true, role: true } } },
          orderBy: { created_at: 'asc' },
        },
        task_status_logs: {
          include: { users: { select: { id: true, full_name: true } } },
          orderBy: { created_at: 'asc' },
        },
        task_attachments: {
          select: {
            id: true,
            task_id: true,
            request_id: true,
            comment_id: true,
            self_action_id: true,
            self_action_comment_id: true,
            file_name: true,
            file_url: true,
            storage_path: true,
            file_type: true,
            file_size_kb: true,
            uploaded_by_id: true,
            created_at: true,
          },
        },
        task_escalations: true,
      },
    });

    if (!task) throw new NotFoundException('Task not found');
    this.assertAccess(task, user);
    task.task_attachments = await this.attachmentsService.decorateTaskAttachments(task.task_attachments);
    return task;
  }

  async update(id: string, dto: UpdateTaskDto, user: JwtPayload) {
    const task = await this.getTaskOrFail(id);
    this.assertAccess(task, user);

    if (user.role === role_enum.EMPLOYEE) {
      throw new ForbiddenException('Employees are not authorized to update tasks');
    }

    const updateData: Record<string, any> = { ...dto };
    if (dto.dueDate) {
      updateData.due_date = new Date(dto.dueDate);
      delete updateData.dueDate;
    }
    if (dto.assignedToId !== undefined) {
      if (dto.assignedToId !== null) {
        await this.assertAssigneeAccess(dto.assignedToId, this.taskDepartmentIds(task));
      }
      updateData.assigned_to_id = dto.assignedToId;
      delete updateData.assignedToId;
    }

    return this.prisma.tasks.update({
      where: { id },
      data: updateData,
      include: this.taskInclude(),
    });
  }

  async remove(id: string, user: JwtPayload, reason: string) {
    const task = await this.getTaskOrFail(id);

    if (user.role === role_enum.EMPLOYEE) {
      throw new ForbiddenException('Employees are not authorized to delete tasks');
    }
    if (!reason?.trim()) {
      throw new ForbiddenException('Delete reason is required');
    }

    if (DEPARTMENT_SCOPED_ROLES.includes(user.role) && !this.hasDepartmentAccess(task, this.mappedDepts(user))) {
      throw new ForbiddenException();
    }

    const deletedAt = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.tasks.update({
        where: { id },
        data: {
          deleted_at: deletedAt,
          deleted_by_id: user.sub,
          delete_reason: reason,
        } as any,
      } as any);

      await tx.audit_logs.create({
        data: {
          user_id: user.sub,
          action: 'TASK_DELETED',
          entity: 'tasks',
          entity_id: task.id,
          old_value: JSON.stringify({
            taskId: task.id,
            taskTitle: task.title,
            taskDescription: task.description,
            assignedToId: task.assigned_to_id,
            departmentId: task.department_id,
          }),
          new_value: JSON.stringify({
            deletedBy: user.sub,
            deletedAt: deletedAt.toISOString(),
            deleteReason: reason,
          }),
        },
      });

      return result;
    });

    if (task.assigned_to_id) {
      await this.notificationsService.createNotification({
        recipientId: task.assigned_to_id,
        type: 'TASK_REJECTED' as any,
        title: 'Task Deleted',
        message: `Task "${task.title}" has been deleted.`,
      });
    }

    return updated;
  }

  async transition(
    id: string,
    toStatus: task_status_enum,
    user: JwtPayload,
    reason?: string,
  ) {
    const task = await this.getTaskOrFail(id);

    if (DEPARTMENT_SCOPED_ROLES.includes(user.role) && !this.hasDepartmentAccess(task, this.mappedDepts(user))) {
      throw new ForbiddenException('Cannot act on tasks outside mapped departments');
    }

    if (
      user.role === role_enum.EMPLOYEE &&
      !this.hasDepartmentAccess(task, user.departmentId ? [user.departmentId] : [])
    ) {
      throw new ForbiddenException('You can only update tasks in your department');
    }

    if (user.role === role_enum.EMPLOYEE && task.assigned_to_id !== user.sub) {
      throw new ForbiddenException('You can only update your own task status');
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

  async getPending(user: JwtPayload) {
    const baseWhere: Prisma.tasksWhereInput = { status: task_status_enum.REVIEWED, deleted_at: null };
    const conditions: Prisma.tasksWhereInput[] = [baseWhere];

    if (DEPARTMENT_SCOPED_ROLES.includes(user.role)) {
      conditions.push(this.departmentVisibility(this.mappedDepts(user)));
    } else if (user.role === role_enum.EMPLOYEE) {
      conditions.push({
        OR: [
          { assigned_to_id: user.sub },
          { assigned_by_id: user.sub },
        ],
      });
      if (user.departmentId) {
        conditions.push(this.departmentVisibility([user.departmentId]));
      }
    }

    const where: Prisma.tasksWhereInput = { AND: conditions };

    return this.prisma.tasks.findMany({
      where,
      include: this.taskInclude(),
      orderBy: { due_date: 'asc' },
    });
  }

  async getOverdue(user: JwtPayload) {
    const terminalStatuses = [
      task_status_enum.COMPLETED,
      task_status_enum.REVIEWED,
      task_status_enum.CLOSED,
      task_status_enum.REJECTED,
    ];

    const baseWhere: Prisma.tasksWhereInput = {
      due_date: { lt: new Date() },
      status: { notIn: terminalStatuses },
      deleted_at: null,
    };
    const conditions: Prisma.tasksWhereInput[] = [baseWhere];

    if (user.role === role_enum.MD || user.role === role_enum.ADMIN) {
      // no-op
    } else if (DEPARTMENT_SCOPED_ROLES.includes(user.role)) {
      conditions.push(this.departmentVisibility(this.mappedDepts(user)));
    } else if (user.role === role_enum.EMPLOYEE) {
      conditions.push({
        OR: [
          { assigned_to_id: user.sub },
          { assigned_by_id: user.sub },
        ],
      });
      if (user.departmentId) {
        conditions.push(this.departmentVisibility([user.departmentId]));
      }
    }

    const where: Prisma.tasksWhereInput = { AND: conditions };

    return this.prisma.tasks.findMany({
      where,
      include: this.taskInclude(),
      orderBy: { due_date: 'asc' },
    });
  }

  async getDepartments(user: JwtPayload) {
    return this.prisma.departments.findMany({
      where: {
        is_active: true,
        ...(user.role === role_enum.HOD
          ? { hod_departments: { some: { hod_id: user.sub } } }
          : user.role === role_enum.PURCHASE_HEAD
            ? { name: { in: ['Purchase Agro', 'Purchase Non Agro'] } }
            : DEPARTMENT_SCOPED_ROLES.includes(user.role)
              ? { id: { in: this.mappedDepts(user) } }
              : {}),
      },
      select: { id: true, name: true, description: true, is_active: true },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    });
  }

  async getAssignees(departmentIdsParam: string | string[] | undefined, user: JwtPayload) {
    const departmentIds = this.resolveQueryDepartmentIds(departmentIdsParam);
    if (!departmentIds.length) return [];

    await this.assertCreateAccess(departmentIds, user);

    const users = await this.prisma.users.findMany({
      where: {
        role: role_enum.EMPLOYEE,
        is_active: true,
        deleted_at: null,
        pending_approval: false,
        department_id: { in: departmentIds },
      },
      select: {
        id: true,
        username: true,
        full_name: true,
        email: true,
        role: true,
        department_id: true,
        departments: { select: { id: true, name: true } },
      },
      orderBy: { full_name: 'asc' },
    });

    return users.map((assignee) => ({
      id: assignee.id,
      username: assignee.username,
      fullName: assignee.full_name,
      email: assignee.email,
      role: assignee.role,
      departmentId: assignee.department_id,
      department: assignee.departments,
    }));
  }

  async getEmployeeSharedAssignees(departmentId: string, excludeUserId: string) {
    const users = await this.prisma.users.findMany({
      where: {
        role: role_enum.EMPLOYEE,
        is_active: true,
        deleted_at: null,
        pending_approval: false,
        department_id: departmentId,
        id: { not: excludeUserId },
      },
      select: {
        id: true,
        username: true,
        full_name: true,
        email: true,
        role: true,
        department_id: true,
        departments: { select: { id: true, name: true } },
      },
      orderBy: { full_name: 'asc' },
    });

    return users.map((assignee) => ({
      id: assignee.id,
      username: assignee.username,
      fullName: assignee.full_name,
      email: assignee.email,
      role: assignee.role,
      departmentId: assignee.department_id,
      department: assignee.departments,
    }));
  }

  private async getTaskOrFail(id: string) {
    const task = await this.prisma.tasks.findFirst({
      where: { id, deleted_at: null } as any,
      include: { task_departments: { select: { department_id: true } } },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  private assertAccess(task: any, user: JwtPayload) {
    if (user.role === role_enum.MD || user.role === role_enum.ADMIN) return;
    if (DEPARTMENT_SCOPED_ROLES.includes(user.role) && this.hasDepartmentAccess(task, this.mappedDepts(user))) return;
    
    if (user.role === role_enum.EMPLOYEE) {
      const isOwner = task.assigned_to_id === user.sub || task.assigned_by_id === user.sub;
      if (isOwner && this.hasDepartmentAccess(task, user.departmentId ? [user.departmentId] : [])) return;
    }
    
    throw new ForbiddenException('Access denied to this task');
  }

  private buildWhereFromFilters(filters: TaskFilterDto): Prisma.tasksWhereInput {
    const where: any = { deleted_at: null };
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.taskType) where.task_type = filters.taskType;
    if (filters.title) where.title = { contains: filters.title, mode: 'insensitive' };
    if (filters.assignedToId) where.assigned_to_id = filters.assignedToId;
    if (filters.departmentId) {
      Object.assign(where, this.departmentVisibility([filters.departmentId]));
    }
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
      case task_status_enum.IN_PROGRESS: return { accepted_at: now };
      case task_status_enum.COMPLETED: return { completed_at: now };
      case task_status_enum.REVIEWED: return { completed_at: now };
      case task_status_enum.CLOSED: return { reviewed_at: now };
      case task_status_enum.REJECTED: return { closed_at: now };
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
    if (to === task_status_enum.HOD_VERIFIED_PENDING) {
      await this.notificationsService.createNotification({
        recipientId: assignedById,
        type: 'TASK_VERIFICATION_PENDING' as any,
        title: 'Task Verification Required',
        message: `Task "${task.title}" has been completed and is awaiting your verification.`,
      });
    }
  }

  private resolveDepartmentIds(dto: CreateTaskDto) {
    const departmentIds = dto.departmentIds?.length ? dto.departmentIds : dto.departmentId ? [dto.departmentId] : [];
    if (!departmentIds.length) {
      throw new ForbiddenException('Department is required');
    }
    return [...new Set(departmentIds)];
  }

  private async assertCreateAccess(departmentIds: string[], user: JwtPayload, taskType: task_type_enum = task_type_enum.OFFICIAL) {
    const activeDepartments = await this.prisma.departments.count({
      where: { id: { in: departmentIds }, is_active: true },
    });

    if (activeDepartments !== departmentIds.length) {
      throw new ForbiddenException('Invalid department selection');
    }

    if (taskType === task_type_enum.EMPLOYEE_SHARED) {
      if (user.role !== role_enum.EMPLOYEE) {
        throw new ForbiddenException('Only employees can create Employee Shared Tasks');
      }
      if (departmentIds.length > 1 || !user.departmentId || departmentIds[0] !== user.departmentId) {
        throw new ForbiddenException('Cross-department assignment is not allowed for Employee Shared Tasks');
      }
      return;
    }

    if (user.role === role_enum.EMPLOYEE) {
      throw new ForbiddenException('Employees are not allowed to create tasks directly');
    }

    if (user.role === role_enum.HOD) {
      const allowed = await this.prisma.hod_departments.count({
        where: {
          hod_id: user.sub,
          department_id: { in: departmentIds },
          departments: { is_active: true },
        },
      });

      if (allowed !== departmentIds.length) {
        throw new ForbiddenException('Cannot assign tasks outside mapped departments');
      }
    }

    if (ASSISTANT_ROLES.includes(user.role)) {
      const allowed = await this.prisma.assistant_departments.count({
        where: {
          assistant_id: user.sub,
          department_id: { in: departmentIds },
          departments: { is_active: true },
        },
      });

      if (allowed !== departmentIds.length) {
        throw new ForbiddenException('Cannot assign tasks outside mapped departments');
      }
    }

    if (user.role === role_enum.PURCHASE_HEAD) {
      const allowed = await this.prisma.departments.count({
        where: {
          id: { in: departmentIds },
          is_active: true,
          name: { in: ['Purchase Agro', 'Purchase Non Agro'] },
        },
      });

      if (allowed !== departmentIds.length) {
        throw new ForbiddenException('Cannot assign tasks outside mapped departments');
      }
    }
  }

  private async resolveAssigneeIds(dto: CreateTaskDto, departmentIds: string[]) {
    const assigneeIds = [...new Set([
      ...(dto.assignedToIds ?? []),
      dto.assignedToId ?? '',
    ].filter(Boolean))];

    if (!assigneeIds.length) {
      return [];
    }

    const employees = await this.prisma.users.findMany({
      where: {
        id: { in: assigneeIds },
        role: role_enum.EMPLOYEE,
        is_active: true,
        deleted_at: null,
        pending_approval: false,
        department_id: { in: departmentIds },
      },
      select: { id: true },
    });

    if (employees.length !== assigneeIds.length) {
      throw new ForbiddenException('Assignee must belong to a selected department');
    }

    return employees.map((employee) => employee.id);
  }

  private async assertAssigneeAccess(assignedToId: string, departmentIds: string[]) {
    const employee = await this.prisma.users.findFirst({
      where: {
        id: assignedToId,
        role: role_enum.EMPLOYEE,
        is_active: true,
        deleted_at: null,
        pending_approval: false,
        department_id: { in: departmentIds },
      },
      select: { id: true },
    });

    if (!employee) {
      throw new ForbiddenException('Assignee must belong to a selected department');
    }
  }

  private async resolveAllEmployeeIds(departmentIds: string[]) {
    const employees = await this.prisma.users.findMany({
      where: {
        role: role_enum.EMPLOYEE,
        is_active: true,
        deleted_at: null,
        pending_approval: false,
        department_id: { in: departmentIds },
      },
      select: { id: true },
      orderBy: { full_name: 'asc' },
    });

    if (!employees.length) {
      throw new BadRequestException('No active employees found for selected departments');
    }

    return employees.map((employee) => employee.id);
  }

  private departmentVisibility(departmentIds: string[]): Prisma.tasksWhereInput {
    if (!departmentIds.length) return { id: { in: [] } };
    return {
      OR: [
        { department_id: { in: departmentIds } },
        { task_departments: { some: { department_id: { in: departmentIds } } } },
      ],
    };
  }

  private hasDepartmentAccess(task: any, departmentIds: string[]) {
    return this.taskDepartmentIds(task).some((departmentId) => departmentIds.includes(departmentId));
  }

  private taskDepartmentIds(task: any) {
    const taskDepartmentIds = task.task_departments?.map((item: { department_id: string }) => item.department_id) ?? [];
    return [...new Set([task.department_id, ...taskDepartmentIds].filter(Boolean))];
  }

  private resolveQueryDepartmentIds(value: string | string[] | undefined) {
    const raw = Array.isArray(value) ? value : value ? value.split(',') : [];
    return [...new Set(raw.map((id) => id.trim()).filter(Boolean))];
  }

  private taskInclude() {
    return {
      users_tasks_assigned_to_idTousers: { select: { id: true, full_name: true, role: true } },
      users_tasks_assigned_by_idTousers: { select: { id: true, full_name: true, role: true } },
      departments: { select: { id: true, name: true } },
      task_departments: {
        include: {
          departments: { select: { id: true, name: true } },
        },
      },
    };
  }

  private async createTaskRecords(db: any, dto: CreateTaskDto, user: JwtPayload) {
    const departmentIds = this.resolveDepartmentIds(dto);
    const taskType = dto.taskType ?? task_type_enum.OFFICIAL;
    await this.assertCreateAccess(departmentIds, user, taskType);

    const assigneeIds = dto.assignAllEmployees
      ? await this.resolveAllEmployeeIds(departmentIds)
      : await this.resolveAssigneeIds(dto, departmentIds);

    const createdTasks: Array<{ id: string }> = [];

    if (assigneeIds.length) {
      for (const assigneeId of assigneeIds) {
        const created = await db.tasks.create({
          data: {
            title: dto.title,
            description: dto.description,
            priority: dto.priority,
            due_date: new Date(dto.dueDate),
            assigned_to_id: assigneeId,
            assigned_by_id: user.sub,
            department_id: departmentIds[0]!,
            parent_task_id: dto.parentTaskId ?? null,
            status: task_status_enum.CREATED,
            task_type: taskType,
          },
        });

        await db.task_departments.createMany({
          data: departmentIds.map((department_id) => ({
            task_id: created.id,
            department_id,
          })),
          skipDuplicates: true,
        });

        await db.task_status_logs.create({
          data: {
            task_id: created.id,
            from_status: null,
            to_status: task_status_enum.CREATED,
            changed_by_id: user.sub,
          },
        });

        await db.audit_logs.create({
          data: {
            user_id: user.sub,
            action: 'TASK_CREATED',
            entity: 'tasks',
            entity_id: created.id,
            old_value: null,
            new_value: JSON.stringify({
              taskId: created.id,
              title: dto.title,
              description: dto.description,
              assignedToId: assigneeId,
              departmentIds,
              taskType,
            }),
          },
        });

        await db.notifications.create({
          data: {
            user_id: assigneeId,
            type: notification_type_enum.TASK_ASSIGNED,
            title: 'New Task Assigned',
            message: `You have been assigned task "${dto.title}".`,
          },
        });

        createdTasks.push(created);
      }
    } else {
      const created = await db.tasks.create({
        data: {
          title: dto.title,
          description: dto.description,
          priority: dto.priority,
          due_date: new Date(dto.dueDate),
          assigned_to_id: null,
          assigned_by_id: user.sub,
          department_id: departmentIds[0]!,
          parent_task_id: dto.parentTaskId ?? null,
          status: task_status_enum.CREATED,
          task_type: taskType,
        },
      });

      await db.task_departments.createMany({
        data: departmentIds.map((department_id) => ({
          task_id: created.id,
          department_id,
        })),
        skipDuplicates: true,
      });

      await db.task_status_logs.create({
        data: {
          task_id: created.id,
          from_status: null,
          to_status: task_status_enum.CREATED,
          changed_by_id: user.sub,
        },
      });

      await db.audit_logs.create({
        data: {
          user_id: user.sub,
          action: 'TASK_CREATED',
          entity: 'tasks',
          entity_id: created.id,
          old_value: null,
          new_value: JSON.stringify({
            taskId: created.id,
            title: dto.title,
            description: dto.description,
            departmentIds,
            taskType,
          }),
        },
      });

      createdTasks.push(created);
    }

    return createdTasks;
  }
}
