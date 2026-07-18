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
import { DepartmentScopeService } from '../../common/services/department-scope.service';
import { DepartmentQueryHelper } from '../../common/helpers/department-query.helper';

type PendingTaskNotification = {
  recipientId: string;
  type: notification_type_enum;
  title: string;
  message: string;
};

type CreatedTaskRecord = {
  id: string;
  notifications?: PendingTaskNotification[];
};

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: TaskLifecycleService,
    private readonly attachmentsService: AttachmentsService,
    private readonly notificationsService: NotificationsService,
    private readonly departmentScopeService: DepartmentScopeService,
  ) {}

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

      if (!tasks.length) {
        throw new BadRequestException('Failed to create task');
      }

      await this.dispatchTaskNotifications(tasks);

      if (tasks.length > 1) {
        const firstTask = await this.findOne(tasks[0]!.id, user);
        return {
          ...firstTask,
          _multiAssignment: {
            tasksCreated: tasks.length,
            taskIds: tasks.map((t) => t.id),
          },
        };
      }

      return this.findOne(tasks[0]!.id, user);
    } catch (error: any) {
      throw error;
    }
  }

  async createInTransaction(dto: CreateTaskDto, user: JwtPayload, tx: any) {
    const tasks = await this.createTaskRecords(tx, dto, user);
    await this.createTaskNotificationsInTransaction(tx, tasks);
    return tasks[0];
  }

  async findAll(filters: TaskFilterDto, user: JwtPayload) {
    // Resolve department scope once
    const scope = await this.departmentScopeService.resolveDepartmentScope(user);
    
    const baseWhere = this.buildWhereFromFilters(filters);
    const departmentFilter = DepartmentQueryHelper.buildTaskDepartmentFilter(scope);
    
    // For employees, add ownership filter
    const ownershipFilter: Prisma.tasksWhereInput = user.role === role_enum.EMPLOYEE
      ? {
          OR: [
            { assigned_to_id: user.sub },
            { assigned_by_id: user.sub },
          ],
        }
      : {};

    const where: Prisma.tasksWhereInput = {
      AND: [
        baseWhere,
        departmentFilter,
        ownershipFilter,
      ].filter(obj => Object.keys(obj).length > 0),
    };

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
    await this.assertAccess(task, user);

    if (user.role === role_enum.EMPLOYEE) {
      throw new ForbiddenException('Employees are not authorized to delete tasks');
    }
    if (!reason?.trim()) {
      throw new ForbiddenException('Delete reason is required');
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
    await this.assertAccess(task, user);

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
    const scope = await this.departmentScopeService.resolveDepartmentScope(user);
    
    const baseWhere: Prisma.tasksWhereInput = { status: task_status_enum.REVIEWED, deleted_at: null };
    const departmentFilter = DepartmentQueryHelper.buildTaskDepartmentFilter(scope);
    
    const ownershipFilter: Prisma.tasksWhereInput = user.role === role_enum.EMPLOYEE
      ? {
          OR: [
            { assigned_to_id: user.sub },
            { assigned_by_id: user.sub },
          ],
        }
      : {};

    const where: Prisma.tasksWhereInput = {
      AND: [
        baseWhere,
        departmentFilter,
        ownershipFilter,
      ].filter(obj => Object.keys(obj).length > 0),
    };

    return this.prisma.tasks.findMany({
      where,
      include: this.taskInclude(),
      orderBy: { due_date: 'asc' },
    });
  }

  async getOverdue(user: JwtPayload) {
    const scope = await this.departmentScopeService.resolveDepartmentScope(user);
    
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
    
    const departmentFilter = DepartmentQueryHelper.buildTaskDepartmentFilter(scope);
    
    const ownershipFilter: Prisma.tasksWhereInput = user.role === role_enum.EMPLOYEE
      ? {
          OR: [
            { assigned_to_id: user.sub },
            { assigned_by_id: user.sub },
          ],
        }
      : {};

    const where: Prisma.tasksWhereInput = {
      AND: [
        baseWhere,
        departmentFilter,
        ownershipFilter,
      ].filter(obj => Object.keys(obj).length > 0),
    };

    return this.prisma.tasks.findMany({
      where,
      include: this.taskInclude(),
      orderBy: { due_date: 'asc' },
    });
  }

  async getDepartments(user: JwtPayload) {
    const scope = await this.departmentScopeService.resolveDepartmentScope(user);
    
    const where: Prisma.departmentsWhereInput = {
      is_active: true,
      ...(scope.unrestricted ? {} : { id: { in: scope.departmentIds } }),
    };

    return this.prisma.departments.findMany({
      where,
      select: { id: true, name: true, description: true, is_active: true },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    });
  }

  async getEmployeeSharingDepartments() {
    return this.prisma.departments.findMany({
      where: { is_active: true },
      select: { id: true, name: true, description: true, is_active: true },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    });
  }

  async getDelegationDepartments(user: JwtPayload) {
    const scope = await this.departmentScopeService.resolveDepartmentScope(user);
    if (user.role !== role_enum.HOD || scope.unrestricted) {
      throw new ForbiddenException('Only HOD users can delegate tasks to another department');
    }

    const departments = await this.prisma.departments.findMany({
      where: {
        is_active: true,
        id: { notIn: scope.departmentIds },
        hod_departments: {
          some: {
            users: {
              role: role_enum.HOD,
              is_active: true,
              deleted_at: null,
              pending_approval: false,
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
        is_active: true,
        hod_departments: {
          where: {
            users: {
              role: role_enum.HOD,
              is_active: true,
              deleted_at: null,
              pending_approval: false,
            },
          },
          select: {
            users: { select: { id: true, full_name: true } },
          },
          take: 1,
        },
      },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    });

    return departments.map((department) => ({
      id: department.id,
      name: department.name,
      description: department.description,
      is_active: department.is_active,
      hod: department.hod_departments[0]?.users
        ? {
            id: department.hod_departments[0].users.id,
            fullName: department.hod_departments[0].users.full_name,
          }
        : null,
    }));
  }

  async getDelegatedOut(user: JwtPayload) {
    const scope = await this.departmentScopeService.resolveDepartmentScope(user);
    if (user.role !== role_enum.HOD || scope.unrestricted) {
      throw new ForbiddenException('Only HOD users can view delegated tasks');
    }

    const transfers = await this.prisma.task_transfers.findMany({
      where: {
        initiated_by_id: user.sub,
        from_dept_id: { in: scope.departmentIds },
        tasks: {
          deleted_at: null,
          department_id: { notIn: scope.departmentIds },
        },
      },
      select: {
        id: true,
        status: true,
        reason: true,
        rejection_reason: true,
        created_at: true,
        updated_at: true,
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,
            due_date: true,
            departments: { select: { id: true, name: true } },
            task_status_logs: {
              select: {
                from_status: true,
                to_status: true,
                reason: true,
                created_at: true,
                users: { select: { id: true, full_name: true } },
              },
              orderBy: { created_at: 'asc' },
            },
          },
        },
        departments_task_transfers_to_dept_idTodepartments: {
          select: {
            id: true,
            name: true,
            hod_departments: {
              where: {
                users: {
                  role: role_enum.HOD,
                  is_active: true,
                  deleted_at: null,
                  pending_approval: false,
                },
              },
              select: {
                users: { select: { id: true, full_name: true } },
              },
              take: 1,
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return transfers.map((transfer) => {
      const currentDepartment = transfer.tasks.departments;
      const targetDepartment = transfer.departments_task_transfers_to_dept_idTodepartments;
      const assignedHod = targetDepartment.hod_departments[0]?.users ?? null;

      return {
        task: {
          id: transfer.tasks.id,
          title: transfer.tasks.title,
          status: transfer.tasks.status,
          dueDate: transfer.tasks.due_date,
        },
        status: transfer.tasks.status,
        currentDepartment,
        transferStatus: transfer.status,
        assignedHod: assignedHod
          ? { id: assignedHod.id, fullName: assignedHod.full_name }
          : null,
        timeline: [
          {
            type: 'TRANSFER_REQUESTED',
            status: transfer.status,
            reason: transfer.reason,
            createdAt: transfer.created_at,
          },
          ...transfer.tasks.task_status_logs.map((log) => ({
            type: 'STATUS_CHANGE',
            fromStatus: log.from_status,
            toStatus: log.to_status,
            reason: log.reason,
            createdAt: log.created_at,
            actor: log.users ? { id: log.users.id, fullName: log.users.full_name } : null,
          })),
        ],
      };
    });
  }

  async getAssignees(departmentIdsParam: string | string[] | undefined, user: JwtPayload) {
    const departmentIds = this.resolveQueryDepartmentIds(departmentIdsParam);
    if (!departmentIds.length) return [];

    // Validate department access
    const isValid = await this.departmentScopeService.validateDepartmentAccess(user, departmentIds);
    if (!isValid) {
      throw new ForbiddenException('You do not have access to the specified departments');
    }

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
    const [department, users] = await Promise.all([
      this.prisma.departments.findFirst({
        where: { id: departmentId, is_active: true },
        select: { id: true },
      }),
      this.prisma.users.findMany({
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
      }),
    ]);

    if (!department) {
      throw new ForbiddenException('Invalid department selection');
    }

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

  private async assertAccess(task: any, user: JwtPayload) {
    const scope = await this.departmentScopeService.resolveDepartmentScope(user);
    
    // Unrestricted roles have full access
    if (scope.unrestricted) return;
    
    // Check department access
    const taskDeptIds = this.taskDepartmentIds(task);
    const hasDeptAccess = taskDeptIds.some((deptId) => scope.departmentIds.includes(deptId));
    
    if (hasDeptAccess) {
      // Department-scoped roles with access
      if (user.role !== role_enum.EMPLOYEE) return;
      
      // Employees need department access AND ownership
      const isOwner = task.assigned_to_id === user.sub || task.assigned_by_id === user.sub;
      if (isOwner) return;
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
      where.task_departments = { some: { department_id: filters.departmentId } };
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

  private async assertCreateAccess(
    departmentIds: string[],
    user: JwtPayload,
    taskType: task_type_enum = task_type_enum.OFFICIAL,
    delegateDepartmentId?: string,
  ) {
    // Validate departments exist and are active
    const submittedDepartmentIds = [...new Set([...departmentIds, delegateDepartmentId].filter(Boolean) as string[])];
    const activeDepartments = await this.prisma.departments.count({
      where: { id: { in: submittedDepartmentIds }, is_active: true },
    });

    if (activeDepartments !== submittedDepartmentIds.length) {
      throw new ForbiddenException('Invalid department selection');
    }

    // Employee Shared Task validation
    if (taskType === task_type_enum.EMPLOYEE_SHARED) {
      if (user.role !== role_enum.EMPLOYEE) {
        throw new ForbiddenException('Only employees can create Employee Shared Tasks');
      }
      
      const scope = await this.departmentScopeService.resolveDepartmentScope(user);
      if (!user.departmentId || !scope.departmentIds.includes(user.departmentId)) {
        throw new ForbiddenException('Creator department is not available for Employee Shared Tasks');
      }
      if (departmentIds.length !== 1) {
        throw new ForbiddenException('Select one target department for Employee Shared Tasks');
      }
      return;
    }

    if (delegateDepartmentId) {
      if (user.role !== role_enum.HOD) {
        throw new ForbiddenException('Only HOD users can delegate Official Tasks to another department');
      }
      if (departmentIds.includes(delegateDepartmentId)) {
        throw new BadRequestException('Delegation department must be different from source department');
      }
    }

    // Employees cannot create official tasks
    if (user.role === role_enum.EMPLOYEE) {
      throw new ForbiddenException('Employees are not allowed to create tasks directly');
    }

    // Validate user has access to all specified departments
    const isValid = await this.departmentScopeService.validateDepartmentAccess(user, departmentIds);
    if (!isValid) {
      throw new ForbiddenException('Cannot assign tasks outside your accessible departments');
    }
  }

  private async resolveAssignees(dto: CreateTaskDto, departmentIds: string[], user: JwtPayload, taskType: task_type_enum) {
    const assigneeIds = [...new Set([
      ...(dto.assignedToIds ?? []),
      dto.assignedToId ?? '',
    ].filter(Boolean))];

    if (taskType === task_type_enum.EMPLOYEE_SHARED) {
      if (!assigneeIds.length) {
        throw new BadRequestException('Select at least one employee for an Employee Shared Task');
      }
      const MAX_SHARED_ASSIGNEES = 50;
      if (assigneeIds.length > MAX_SHARED_ASSIGNEES) {
        throw new BadRequestException(`Cannot assign to more than ${MAX_SHARED_ASSIGNEES} employees at once`);
      }
    }

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
        ...(taskType === task_type_enum.EMPLOYEE_SHARED ? { id: { in: assigneeIds, not: user.sub } } : {}),
      },
      select: { id: true, department_id: true },
    });

    if (employees.length !== assigneeIds.length) {
      throw new ForbiddenException(
        taskType === task_type_enum.EMPLOYEE_SHARED
          ? 'Assignee must be an active employee in the selected department and cannot be the creator'
          : 'Assignee must belong to a selected department',
      );
    }

    return employees;
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

  private async resolveAllEmployees(departmentIds: string[]) {
    const employees = await this.prisma.users.findMany({
      where: {
        role: role_enum.EMPLOYEE,
        is_active: true,
        deleted_at: null,
        pending_approval: false,
        department_id: { in: departmentIds },
      },
      select: { id: true, department_id: true },
      orderBy: { full_name: 'asc' },
    });

    if (!employees.length) {
      throw new BadRequestException('No active employees found for selected departments');
    }

    return employees;
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

  private async createTaskRecords(db: any, dto: CreateTaskDto, user: JwtPayload): Promise<CreatedTaskRecord[]> {
    const departmentIds = this.resolveDepartmentIds(dto);
    const taskType = dto.taskType ?? task_type_enum.OFFICIAL;
    await this.assertCreateAccess(departmentIds, user, taskType, dto.delegateDepartmentId);

    if (dto.delegateDepartmentId) {
      return this.createDelegatedOfficialTask(db, dto, user, departmentIds[0]!, dto.delegateDepartmentId);
    }

    if (taskType === task_type_enum.EMPLOYEE_SHARED && dto.assignAllEmployees) {
      throw new BadRequestException('Employee Shared Tasks cannot use "assign all employees"');
    }

    const assignees = dto.assignAllEmployees
      ? await this.resolveAllEmployees(departmentIds)
      : await this.resolveAssignees(dto, departmentIds, user, taskType);

    const createdTasks: CreatedTaskRecord[] = [];

    if (assignees.length) {
      const employeeSharedHods = taskType === task_type_enum.EMPLOYEE_SHARED
        ? await this.resolveHodIdsForDepartments([...new Set([user.departmentId!, ...departmentIds])])
        : new Map<string, string[]>();

      for (const assignee of assignees) {
        const taskDepartmentIds = taskType === task_type_enum.EMPLOYEE_SHARED
          ? [...new Set([user.departmentId!, assignee.department_id].filter(Boolean) as string[])]
          : departmentIds;

        const created = await db.tasks.create({
          data: {
            title: dto.title,
            description: dto.description,
            priority: dto.priority,
            due_date: new Date(dto.dueDate),
            assigned_to_id: assignee.id,
            assigned_by_id: user.sub,
            department_id: taskType === task_type_enum.EMPLOYEE_SHARED ? assignee.department_id! : departmentIds[0]!,
            parent_task_id: dto.parentTaskId ?? null,
            status: task_status_enum.CREATED,
            task_type: taskType,
          },
        });

        await db.task_departments.createMany({
          data: taskDepartmentIds.map((department_id) => ({
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
              assignedToId: assignee.id,
              departmentIds: taskDepartmentIds,
              taskType,
            }),
          },
        });

        createdTasks.push({
          id: created.id,
          notifications: this.taskCreatedNotifications({
            taskTitle: dto.title,
            taskType,
            assigneeId: assignee.id,
            creatorId: user.sub,
            creatorDepartmentId: user.departmentId,
            targetDepartmentId: assignee.department_id,
            hodIdsByDepartment: employeeSharedHods,
            totalAssignees: assignees.length,
          }),
        });
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

      createdTasks.push({ id: created.id });
    }

    return createdTasks;
  }

  private async createDelegatedOfficialTask(
    db: any,
    dto: CreateTaskDto,
    user: JwtPayload,
    sourceDepartmentId: string,
    targetDepartmentId: string,
  ): Promise<CreatedTaskRecord[]> {
    if (dto.assignedToId || dto.assignedToIds?.length || dto.assignAllEmployees) {
      throw new BadRequestException('Delegated Official Tasks must be sent to the target department HOD');
    }

    const targetHodIds = await this.resolveHodIdsForDepartment(targetDepartmentId);
    if (!targetHodIds.length) {
      throw new BadRequestException('Target department does not have an active HOD');
    }

    const created = await db.tasks.create({
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        due_date: new Date(dto.dueDate),
        assigned_to_id: null,
        assigned_by_id: user.sub,
        department_id: sourceDepartmentId,
        parent_task_id: dto.parentTaskId ?? null,
        status: task_status_enum.CREATED,
        task_type: task_type_enum.OFFICIAL,
      },
    });

    await db.task_departments.createMany({
      data: [{ task_id: created.id, department_id: sourceDepartmentId }],
      skipDuplicates: true,
    });

    await db.task_transfers.create({
      data: {
        task_id: created.id,
        from_dept_id: sourceDepartmentId,
        to_dept_id: targetDepartmentId,
        initiated_by_id: user.sub,
        reason: 'Initial cross-department delegation',
      },
    });

    await db.task_status_logs.create({
      data: {
        task_id: created.id,
        from_status: null,
        to_status: task_status_enum.CREATED,
        changed_by_id: user.sub,
      },
    });

    await db.audit_logs.createMany({
      data: [
        {
          user_id: user.sub,
          action: 'TASK_CREATED',
          entity: 'tasks',
          entity_id: created.id,
          old_value: null,
          new_value: JSON.stringify({
            taskId: created.id,
            title: dto.title,
            description: dto.description,
            departmentIds: [sourceDepartmentId],
            taskType: task_type_enum.OFFICIAL,
          }),
        },
        {
          user_id: user.sub,
          action: 'TASK_DELEGATED',
          entity: 'tasks',
          entity_id: created.id,
          old_value: JSON.stringify({ departmentId: sourceDepartmentId }),
          new_value: JSON.stringify({
            taskId: created.id,
            fromDepartmentId: sourceDepartmentId,
            toDepartmentId: targetDepartmentId,
          }),
        },
      ],
    });

    return [{
      id: created.id,
      notifications: targetHodIds.map((hodId) => ({
        recipientId: hodId,
        type: notification_type_enum.TRANSFER_REQUESTED,
        title: 'Department Task Delegation',
        message: `Task "${dto.title}" has been delegated to your department for review.`,
      })),
    }];
  }

  private taskCreatedNotifications(input: {
    taskTitle: string;
    taskType: task_type_enum;
    assigneeId: string;
    creatorId: string;
    creatorDepartmentId: string | null;
    targetDepartmentId: string | null;
    hodIdsByDepartment: Map<string, string[]>;
    totalAssignees?: number;
  }): PendingTaskNotification[] {
    const notifications: PendingTaskNotification[] = [
      {
        recipientId: input.assigneeId,
        type: notification_type_enum.TASK_ASSIGNED,
        title: 'New Task Assigned',
        message: `You have been assigned task "${input.taskTitle}".`,
      },
    ];

    if (input.taskType === task_type_enum.EMPLOYEE_SHARED) {
      notifications.push({
        recipientId: input.creatorId,
        type: notification_type_enum.TASK_ASSIGNED,
        title: 'Shared Task Created',
        message: input.totalAssignees && input.totalAssignees > 1
          ? `Your shared task "${input.taskTitle}" has been created and assigned to ${input.totalAssignees} employees.`
          : `Your shared task "${input.taskTitle}" has been created.`,
      });

      const hodIds = [
        ...(input.creatorDepartmentId ? input.hodIdsByDepartment.get(input.creatorDepartmentId) ?? [] : []),
        ...(input.targetDepartmentId ? input.hodIdsByDepartment.get(input.targetDepartmentId) ?? [] : []),
      ];

      for (const hodId of hodIds) {
        notifications.push({
          recipientId: hodId,
          type: notification_type_enum.TASK_ASSIGNED,
          title: 'Employee Shared Task',
          message: `Employee shared task "${input.taskTitle}" is visible for your department.`,
        });
      }
    }

    return this.dedupeNotifications(notifications);
  }

  private async resolveHodIdsForDepartment(departmentId: string) {
    const records = await this.prisma.hod_departments.findMany({
      where: {
        department_id: departmentId,
        users: {
          role: role_enum.HOD,
          is_active: true,
          deleted_at: null,
          pending_approval: false,
        },
      },
      select: { hod_id: true },
    });

    return records.map((record) => record.hod_id);
  }

  private async resolveHodIdsForDepartments(departmentIds: string[]) {
    const records = await this.prisma.hod_departments.findMany({
      where: {
        department_id: { in: departmentIds },
        users: {
          role: role_enum.HOD,
          is_active: true,
          deleted_at: null,
          pending_approval: false,
        },
      },
      select: { department_id: true, hod_id: true },
    });

    const byDepartment = new Map<string, string[]>();
    for (const record of records) {
      byDepartment.set(record.department_id, [...(byDepartment.get(record.department_id) ?? []), record.hod_id]);
    }
    return byDepartment;
  }

  private async dispatchTaskNotifications(tasks: CreatedTaskRecord[]) {
    const notifications = this.dedupeNotifications(tasks.flatMap((task) => task.notifications ?? []));
    if (!notifications.length) return;

    try {
      await Promise.all(notifications.map((notification) =>
        this.notificationsService.createNotification(notification),
      ));
    } catch (error) {
      console.warn('Task notification dispatch failed', error);
    }
  }

  private async createTaskNotificationsInTransaction(db: any, tasks: CreatedTaskRecord[]) {
    const notifications = this.dedupeNotifications(tasks.flatMap((task) => task.notifications ?? []));
    if (!notifications.length) return;

    await db.notifications.createMany({
      data: notifications.map((notification) => ({
        user_id: notification.recipientId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
      })),
      skipDuplicates: true,
    });
  }

  private dedupeNotifications(notifications: PendingTaskNotification[]) {
    const seen = new Set<string>();
    return notifications.filter((notification) => {
      const key = `${notification.recipientId}:${notification.type}:${notification.title}:${notification.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
