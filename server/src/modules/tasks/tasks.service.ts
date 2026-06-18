import {
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
import { Prisma, task_status_enum, role_enum } from '@prisma/client';
import { AttachmentsService } from '../attachments/attachments.service';
import { UploadedFile } from '../../common/types/uploaded-file.type';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: TaskLifecycleService,
    private readonly attachmentsService: AttachmentsService,
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
      const departmentIds = this.resolveDepartmentIds(dto);
      const departmentId = departmentIds[0]!;

      console.log('[CREATE TASK DEBUG] dto.departmentIds=', dto.departmentIds, 'dto.departmentId=', dto.departmentId);
      console.log('[CREATE TASK DEBUG] resolved departmentIds=', departmentIds, 'departmentId=', departmentId);
      console.log('[CREATE TASK DEBUG] user.sub=', user.sub, 'user.role=', user.role);

      await this.assertCreateAccess(departmentIds, dto.assignedToId, user);

      const task = await this.prisma.$transaction(async (tx) => {
        const created = await tx.tasks.create({
          data: {
            title: dto.title,
            description: dto.description,
            priority: dto.priority,
            due_date: new Date(dto.dueDate),
            assigned_to_id: dto.assignedToId ?? null,
            assigned_by_id: user.sub,
            department_id: departmentId,
            parent_task_id: dto.parentTaskId ?? null,
            status: dto.assignedToId ? task_status_enum.ASSIGNED : task_status_enum.CREATED,
          },
        });

        await tx.task_departments.createMany({
          data: departmentIds.map((department_id) => ({
            task_id: created.id,
            department_id,
          })),
          skipDuplicates: true,
        });

        await tx.task_status_logs.create({
          data: {
            task_id: created.id,
            from_status: null,
            to_status: dto.assignedToId ? task_status_enum.ASSIGNED : task_status_enum.CREATED,
            changed_by_id: user.sub,
          },
        });

        return created;
      });

      try {
        if (attachments.length) {
          await this.attachmentsService.uploadTaskAttachments(task.id, attachments, user);
        }
      } catch (error) {
        await this.prisma.tasks.delete({ where: { id: task.id } });
        throw error;
      }

      return this.findOne(task.id, user);
    } catch (error: any) {
      console.error('[CREATE TASK ERROR] message=', error?.message);
      console.error('[CREATE TASK ERROR] code=', error?.code);
      console.error('[CREATE TASK ERROR] meta=', error?.meta);
      console.error('[CREATE TASK ERROR] stack=', error?.stack);
      throw error;
    }
  }

  async findAll(filters: TaskFilterDto, user: JwtPayload) {
    const baseWhere = this.buildWhereFromFilters(filters);
    let where: Prisma.tasksWhereInput;

    if (user.role === role_enum.MD || user.role === role_enum.ADMIN) {
      where = baseWhere;
    } else if (user.role === role_enum.HOD || user.role === role_enum.EA || user.role === role_enum.PA) {
      where = {
        ...baseWhere,
        ...this.departmentVisibility(this.mappedDepts(user)),
      };
    } else {
      where = {
        ...baseWhere,
        assigned_to_id: user.sub,
        ...this.departmentVisibility(user.departmentId ? [user.departmentId] : []),
      };
    }

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
    const task = await this.prisma.tasks.findUnique({
      where: { id },
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

  async remove(id: string, user: JwtPayload) {
    const task = await this.getTaskOrFail(id);

    if (user.role === role_enum.EMPLOYEE) {
      throw new ForbiddenException('Employees are not authorized to delete tasks');
    }

    if ((user.role === role_enum.HOD || user.role === role_enum.EA || user.role === role_enum.PA) && !this.hasDepartmentAccess(task, this.mappedDepts(user))) {
      throw new ForbiddenException();
    }

    return this.prisma.tasks.delete({ where: { id } });
  }

  async transition(
    id: string,
    toStatus: task_status_enum,
    user: JwtPayload,
    reason?: string,
  ) {
    const task = await this.getTaskOrFail(id);

    if ((user.role === role_enum.HOD || user.role === role_enum.EA || user.role === role_enum.PA) && !this.hasDepartmentAccess(task, this.mappedDepts(user))) {
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
    const where: Prisma.tasksWhereInput = { status: task_status_enum.PENDING };

    if (user.role === role_enum.HOD || user.role === role_enum.EA || user.role === role_enum.PA) {
      Object.assign(where, this.departmentVisibility(this.mappedDepts(user)));
    } else if (user.role === role_enum.EMPLOYEE) {
      Object.assign(where, this.departmentVisibility(user.departmentId ? [user.departmentId] : []));
      where.assigned_to_id = user.sub;
    }

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

    const where: Prisma.tasksWhereInput = {
      due_date: { lt: new Date() },
      status: { notIn: terminalStatuses },
    };

    if (user.role === role_enum.HOD || user.role === role_enum.EA || user.role === role_enum.PA) {
      Object.assign(where, this.departmentVisibility(this.mappedDepts(user)));
    }

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
          : user.role === role_enum.EA || user.role === role_enum.PA
            ? { assistant_departments: { some: { assistant_id: user.sub } } }
            : {}),
      },
      select: { id: true, name: true, description: true, is_active: true },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    });
  }

  async getAssignees(departmentIdsParam: string | string[] | undefined, user: JwtPayload) {
    const departmentIds = this.resolveQueryDepartmentIds(departmentIdsParam);
    if (!departmentIds.length) return [];

    await this.assertCreateAccess(departmentIds, undefined, user);

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

  private async getTaskOrFail(id: string) {
    const task = await this.prisma.tasks.findUnique({
      where: { id },
      include: { task_departments: { select: { department_id: true } } },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  private assertAccess(task: any, user: JwtPayload) {
    if (user.role === role_enum.MD || user.role === role_enum.ADMIN) return;
    if ((user.role === role_enum.HOD || user.role === role_enum.EA || user.role === role_enum.PA) && this.hasDepartmentAccess(task, this.mappedDepts(user))) return;
    if (user.role === role_enum.EMPLOYEE && this.hasDepartmentAccess(task, user.departmentId ? [user.departmentId] : [])) return;
    throw new ForbiddenException('Access denied to this task');
  }

  private buildWhereFromFilters(filters: TaskFilterDto): Prisma.tasksWhereInput {
    const where: Prisma.tasksWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
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
  ) {}

  private resolveDepartmentIds(dto: CreateTaskDto) {
    const departmentIds = dto.departmentIds?.length ? dto.departmentIds : dto.departmentId ? [dto.departmentId] : [];
    if (!departmentIds.length) {
      throw new ForbiddenException('Department is required');
    }
    return [...new Set(departmentIds)];
  }

  private async assertCreateAccess(departmentIds: string[], assignedToId: string | undefined, user: JwtPayload) {
    const activeDepartments = await this.prisma.departments.count({
      where: { id: { in: departmentIds }, is_active: true },
    });

    if (activeDepartments !== departmentIds.length) {
      throw new ForbiddenException('Invalid department selection');
    }

    if (user.role === role_enum.EMPLOYEE) {
      const userDeptId = user.departmentId;
      if (!userDeptId || departmentIds.some((id) => id !== userDeptId)) {
        throw new ForbiddenException('You can only create tasks in your own department');
      }
    }

    if (user.role === role_enum.HOD || user.role === role_enum.EA || user.role === role_enum.PA) {
      const allowed = user.role === role_enum.HOD
        ? await this.prisma.hod_departments.count({
            where: {
              hod_id: user.sub,
              department_id: { in: departmentIds },
              departments: { is_active: true },
            },
          })
        : await this.prisma.assistant_departments.count({
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

    if (assignedToId) {
      await this.assertAssigneeAccess(assignedToId, departmentIds);
    }
  }

  private async assertAssigneeAccess(assignedToId: string, departmentIds: string[]) {
    const employee = await this.prisma.users.findFirst({
      where: {
        id: assignedToId,
        role: { in: [role_enum.EMPLOYEE, role_enum.HOD] },
        is_active: true,
        deleted_at: null,
        pending_approval: false,
        department_id: { in: departmentIds },
      },
    });

    if (!employee) {
      throw new ForbiddenException('Assignee must belong to a selected department');
    }
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
}