import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestStatusDto } from './dto/update-request-status.dto';
import { RequestFilterDto } from './dto/request-filter.dto';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { notification_type_enum, request_status_enum, role_enum, task_priority_enum, task_status_enum } from '@prisma/client';
import { TasksService } from '../tasks/tasks.service';
import { AttachmentsService } from '../attachments/attachments.service';

const ASSISTANT_ROLES: role_enum[] = [role_enum.EA, role_enum.PA, role_enum.DEPARTMENT_CONTROLLER];
const DEPARTMENT_SCOPED_ROLES: role_enum[] = [role_enum.HOD, role_enum.PURCHASE_HEAD, ...ASSISTANT_ROLES];

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly tasksService: TasksService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  async create(dto: CreateRequestDto, user: JwtPayload, attachments: any[] = []) {
    if (dto.type === 'TASK_REASSIGNMENT') return this.createTaskReassignment(dto, user);
    if (!dto.title?.trim() || !dto.description?.trim()) {
      throw new BadRequestException('Title and description are required');
    }
    if (!dto.departmentId) {
      throw new BadRequestException('Department is required');
    }
    if (!dto.priority) {
      throw new BadRequestException('Priority is required');
    }

    await this.assertRequestDepartmentAccess(dto.departmentId, user);
    await this.assertNoDuplicatePendingRequest(user.sub, dto.type, dto.departmentId, dto.title.trim());

    const request = await this.prisma.task_requests.create({
      data: {
        title: dto.title.trim(),
        description: dto.description.trim(),
        type: dto.type,
        priority: dto.priority,
        department_id: dto.departmentId,
        requested_by_id: user.sub,
        status: request_status_enum.PENDING,
        request_reason: dto.requestReason ?? null,
      },
      select: {
        id: true, title: true, description: true, type: true, status: true, priority: true,
        department_id: true, created_at: true, updated_at: true
      },
    });

    try {
      if (attachments.length) {
        await this.attachmentsService.uploadRequestAttachments(request.id, attachments, user);
      }
    } catch (error) {
      await this.prisma.task_attachments.deleteMany({ where: { request_id: request.id } });
      await this.prisma.task_requests.delete({ where: { id: request.id } });
      throw error;
    }

    await this.prisma.audit_logs.create({
      data: {
        user_id: user.sub,
        action: 'REQUEST_CREATED',
        entity: 'task_requests',
        entity_id: request.id,
        old_value: null,
        new_value: JSON.stringify({
          requestId: request.id,
          type: request.type,
          departmentId: request.department_id,
          priority: request.priority,
          title: request.title,
        }),
      },
    });

    await this.notifications.createNotification({
      recipientId: await this.resolvePrimaryReviewerId(request.department_id ?? user.departmentId ?? null, user.sub),
      type: notification_type_enum.REVIEW_REQUESTED,
      title: 'New Request Submitted',
      message: `A new request has been submitted: "${request.title}"`,
    });

    return this.findOne(request.id, user);
  }

  async findAll(filters: RequestFilterDto, user: JwtPayload) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type as any;
    if (filters.taskId) where.task_id = filters.taskId;

    if (user.role === role_enum.EMPLOYEE) {
      where.requested_by_id = user.sub;
    } else if (DEPARTMENT_SCOPED_ROLES.includes(user.role)) {
      const deptIds = this.getManagedDepartmentIds(user);
      if (!deptIds.length) {
        where.id = { in: [] };
      }
      where.OR = [
        { department_id: { in: deptIds } },
        { users_task_requests_requested_by_idTousers: { department_id: { in: deptIds } } },
        {
          task_id: { not: null },
          task: {
            OR: [
              { department_id: { in: deptIds } },
              { task_departments: { some: { department_id: { in: deptIds } } } },
            ],
          },
        },
      ];
    }

    const items = await this.prisma.task_requests.findMany({
      where,
      include: {
        departments: { select: { id: true, name: true } },
        task: {
          select: {
            id: true,
            title: true,
            description: true,
            department_id: true,
            status: true,
            task_departments: { select: { department_id: true } },
            users_tasks_assigned_to_idTousers: { select: { id: true, full_name: true, role: true } },
          },
        },
        request_attachments: {
          select: this.attachmentSelect(),
        },
        current_assignee: { select: { id: true, full_name: true } },
        requested_assignee: { select: { id: true, full_name: true } },
        users_task_requests_requested_by_idTousers: { select: { id: true, full_name: true, department_id: true } },
        users_task_requests_reviewed_by_idTousers: { select: { id: true, full_name: true } },
      },
      orderBy: { created_at: 'desc' },
    } as any);

    const decorated = await Promise.all(items.map((item: any) => this.decorateRequestAttachments(item)));
    return decorated.map((item: any) => this.mapRequest(item));
  }

  async findOne(id: string, user: JwtPayload) {
    let request = await this.prisma.task_requests.findUnique({
      where: { id },
      include: {
        departments: { select: { id: true, name: true } },
        task: {
          select: {
            id: true,
            title: true,
            description: true,
            department_id: true,
            status: true,
            task_departments: { select: { department_id: true } },
            users_tasks_assigned_to_idTousers: { select: { id: true, full_name: true, role: true } },
          },
        },
        request_attachments: { select: this.attachmentSelect() },
        current_assignee: { select: { id: true, full_name: true } },
        requested_assignee: { select: { id: true, full_name: true } },
        users_task_requests_requested_by_idTousers: { select: { id: true, full_name: true, department_id: true } },
        users_task_requests_reviewed_by_idTousers: { select: { id: true, full_name: true } },
      },
    } as any);

    if (!request) throw new NotFoundException('Request not found');
    request = await this.decorateRequestAttachments(request);
    this.assertAccess(request, user);
    return this.mapRequest(request);
  }

  async approve(id: string, dto: UpdateRequestStatusDto, user: JwtPayload) {
    const request = await this.getRequestOrFail(id);
    this.assertReviewAccess(request, user);

    if ((request.type as any) === 'TASK_REASSIGNMENT') {
      return this.approveTaskReassignment(request, dto, user);
    }

    const approvedAt = new Date();
    const taskDto = this.toTaskCreateDto(request, approvedAt);

    await this.prisma.$transaction(async (tx) => {
      const lock = await tx.task_requests.updateMany({
        where: { id, status: request_status_enum.PENDING, generated_task_id: null },
        data: {
          status: request_status_enum.ACCEPTED,
          reviewed_by_id: user.sub,
          reviewed_at: approvedAt,
        },
      });

      if (!lock.count) {
        throw new ConflictException('Request has already been reviewed');
      }

      const task = await this.tasksService.createInTransaction(taskDto, user, tx);
      if (!task) throw new InternalServerErrorException('Failed to create task');

      await tx.task_requests.update({
        where: { id },
        data: {
          generated_task_id: task.id,
          task_id: task.id,
          task_title: request.title,
          task_description: request.description,
        },
      });

      await tx.task_attachments.updateMany({
        where: { request_id: id },
        data: { task_id: task.id, request_id: null },
      });

      await tx.audit_logs.create({
        data: {
          user_id: user.sub,
          action: 'REQUEST_APPROVED',
          entity: 'task_requests',
          entity_id: id,
          old_value: JSON.stringify({
            requestId: id,
            status: request.status,
            type: request.type,
            departmentId: request.department_id,
          }),
          new_value: JSON.stringify({
            requestId: id,
            taskId: task.id,
            approvedBy: user.sub,
            approvedAt: approvedAt.toISOString(),
          }),
        },
      });
    });

    await this.notifications.createNotification({
      recipientId: request.requested_by_id,
      type: notification_type_enum.REQUEST_ACCEPTED,
      title: 'Request Approved',
      message: `Your request "${request.title}" has been approved.`,
    });

    return this.findOne(id, user);
  }

  async reject(id: string, dto: UpdateRequestStatusDto, user: JwtPayload) {
    const request = await this.getRequestOrFail(id);
    this.assertReviewAccess(request, user);

    if ((request.type as any) === 'TASK_REASSIGNMENT') {
      return this.rejectTaskReassignment(request, dto, user);
    }

    const rejectedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const lock = await tx.task_requests.updateMany({
        where: { id, status: request_status_enum.PENDING, generated_task_id: null },
        data: {
          status: request_status_enum.REJECTED,
          reviewed_by_id: user.sub,
          reviewed_at: rejectedAt,
          rejection_reason: dto.rejectionReason ?? null,
        },
      });

      if (!lock.count) {
        throw new ConflictException('Request has already been reviewed');
      }

      await tx.audit_logs.create({
        data: {
          user_id: user.sub,
          action: 'REQUEST_REJECTED',
          entity: 'task_requests',
          entity_id: id,
          old_value: JSON.stringify({
            requestId: id,
            status: request.status,
            type: request.type,
            departmentId: request.department_id,
          }),
          new_value: JSON.stringify({
            requestId: id,
            rejectedBy: user.sub,
            rejectedAt: rejectedAt.toISOString(),
            rejectionReason: dto.rejectionReason ?? null,
          }),
        },
      });
    });

    await this.notifications.createNotification({
      recipientId: request.requested_by_id,
      type: notification_type_enum.REQUEST_REJECTED,
      title: 'Request Rejected',
      message: `Your request "${request.title}" was rejected.${dto.rejectionReason ? ` Reason: ${dto.rejectionReason}` : ''}`,
    });

    return this.findOne(id, user);
  }

  private async getRequestOrFail(id: string) {
    const request = await this.prisma.task_requests.findUnique({
      where: { id },
      include: {
        departments: { select: { id: true, name: true } },
        task: {
          select: {
            id: true,
            title: true,
            description: true,
            department_id: true,
            status: true,
            assigned_to_id: true,
            task_departments: { select: { department_id: true } },
            users_tasks_assigned_to_idTousers: { select: { id: true, full_name: true, role: true } },
          },
        },
        request_attachments: { select: this.attachmentSelect() },
        current_assignee: { select: { id: true, full_name: true } },
        requested_assignee: { select: { id: true, full_name: true } },
        users_task_requests_requested_by_idTousers: { select: { id: true, full_name: true, department_id: true } },
        users_task_requests_reviewed_by_idTousers: { select: { id: true, full_name: true } },
      },
    } as any);
    if (!request) throw new NotFoundException('Request not found');
    return this.decorateRequestAttachments(request);
  }

  private assertAccess(request: any, user: JwtPayload) {
    if (user.role === role_enum.MD || ASSISTANT_ROLES.includes(user.role)) return;
    if (DEPARTMENT_SCOPED_ROLES.includes(user.role) && this.hasDepartmentAccess(request, this.getManagedDepartmentIds(user))) return;
    if (user.role === role_enum.EMPLOYEE && request.requested_by_id === user.sub) return;
    throw new ForbiddenException('Access denied');
  }

  private assertReviewAccess(request: any, user: JwtPayload) {
    if (request.status !== request_status_enum.PENDING) throw new ForbiddenException('Request has already been reviewed');
    if (user.role === role_enum.MD || ASSISTANT_ROLES.includes(user.role)) return;
    if (DEPARTMENT_SCOPED_ROLES.includes(user.role) && this.hasDepartmentAccess(request, this.getManagedDepartmentIds(user))) return;
    throw new ForbiddenException('Only HOD, MD, EA, PA, PURCHASE_HEAD, or DEPARTMENT_CONTROLLER can review requests');
  }

  private async createTaskReassignment(dto: CreateRequestDto, user: JwtPayload) {
    if (!dto.taskId || !dto.currentAssigneeId || !dto.requestReason) {
      throw new BadRequestException('Task reassignment request requires task and reason');
    }

    const task = await this.prisma.tasks.findUnique({
      where: { id: dto.taskId },
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        status: true,
        department_id: true,
        assigned_to_id: true,
        task_departments: { select: { department_id: true } },
      },
    });

    if (!task) throw new NotFoundException('Task not found');
    if (task.assigned_to_id !== user.sub || dto.currentAssigneeId !== user.sub) throw new ForbiddenException('You can only request reassignment for your own task');
    if (task.status === task_status_enum.COMPLETED || task.status === task_status_enum.REJECTED || task.status === task_status_enum.CLOSED || task.status === task_status_enum.REVIEWED) throw new ForbiddenException('Task is not active');

    const duplicate = await this.prisma.task_requests.findFirst({
      where: { type: 'TASK_REASSIGNMENT' as any, status: request_status_enum.PENDING, task_id: task.id },
    });
    if (duplicate) throw new ForbiddenException('A pending reassignment request already exists for this task');

    const request = await this.prisma.task_requests.create({
      data: {
        title: task.title,
        description: task.description,
        type: 'TASK_REASSIGNMENT' as any,
        priority: task.priority ?? null,
        department_id: task.department_id,
        status: request_status_enum.PENDING,
        requested_by_id: user.sub,
        task_id: task.id,
        task_title: task.title,
        task_description: task.description,
        current_assignee_id: user.sub,
        request_reason: dto.requestReason,
      },
      include: {
        task: { select: { id: true, title: true, description: true, department_id: true, status: true, users_tasks_assigned_to_idTousers: { select: { id: true, full_name: true, role: true } } } },
        current_assignee: { select: { id: true, full_name: true } },
        requested_assignee: { select: { id: true, full_name: true } },
        users_task_requests_requested_by_idTousers: { select: { id: true, full_name: true, department_id: true } },
        users_task_requests_reviewed_by_idTousers: { select: { id: true, full_name: true } },
      },
    } as any);

    const hods = await this.prisma.users.findMany({
      where: {
        role: { in: [role_enum.HOD, role_enum.PURCHASE_HEAD, role_enum.DEPARTMENT_CONTROLLER] },
        is_active: true,
        deleted_at: null,
        hod_departments: { some: { department_id: task.department_id } },
      },
      select: { id: true },
    });

    await Promise.all(hods.map((hod) =>
      this.notifications.createNotification({
        recipientId: hod.id,
        type: 'REVIEW_REQUESTED',
        title: 'Task Reassignment Request',
        message: `${user.username} requested reassignment for "${task.title}".`,
      }),
    ));

    return this.mapRequest(request);
  }

  private async approveTaskReassignment(request: any, dto: UpdateRequestStatusDto, user: JwtPayload) {
    if (!dto.newAssigneeId) throw new BadRequestException('New assignee is required');

    const task = await this.prisma.tasks.findUnique({
      where: { id: request.task_id },
      select: { id: true, title: true, department_id: true, assigned_to_id: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (DEPARTMENT_SCOPED_ROLES.includes(user.role) && !this.getManagedDepartmentIds(user).includes(task.department_id)) throw new ForbiddenException('Not authorized to review this task');
    if (request.current_assignee_id && task.assigned_to_id && task.assigned_to_id !== request.current_assignee_id) {
      throw new ConflictException('Task assignment has changed');
    }

    const requestedAssignee = await this.prisma.users.findFirst({
      where: { id: dto.newAssigneeId, role: role_enum.EMPLOYEE, is_active: true, deleted_at: null, pending_approval: false, department_id: task.department_id },
      select: { id: true, full_name: true },
    });
    if (!requestedAssignee) throw new BadRequestException('Requested assignee is no longer valid');

    const reviewedAt = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const lock = await tx.task_requests.updateMany({
        where: { id: request.id, status: request_status_enum.PENDING, generated_task_id: null },
        data: {
          status: request_status_enum.ACCEPTED,
          reviewed_by_id: user.sub,
          reviewed_at: reviewedAt,
          requested_assignee_id: requestedAssignee.id,
        },
      });

      if (!lock.count) {
        throw new ConflictException('Request has already been reviewed');
      }

      await tx.tasks.update({ where: { id: task.id }, data: { assigned_to_id: requestedAssignee.id } });
      await tx.audit_logs.create({
        data: {
          user_id: user.sub,
          action: 'TASK_ASSIGNEE_CHANGED',
          entity: 'tasks',
          entity_id: task.id,
          old_value: JSON.stringify({ previousAssigneeId: task.assigned_to_id, reason: request.request_reason }),
          new_value: JSON.stringify({ newAssigneeId: requestedAssignee.id, approvedBy: user.sub, approvedAt: reviewedAt.toISOString() }),
        },
      });
      return tx.task_requests.findUnique({ where: { id: request.id } });
    });

    await Promise.all([
      this.notifications.createNotification({
        recipientId: request.requested_by_id,
        type: 'REQUEST_ACCEPTED',
        title: 'Task Reassignment Approved',
        message: `Your reassignment request for "${task.title}" has been approved.`,
      }),
      this.notifications.createNotification({
        recipientId: request.current_assignee_id,
        type: 'TASK_ASSIGNED',
        title: 'Task Reassigned',
        message: `"${task.title}" was reassigned.`,
      }),
      this.notifications.createNotification({
        recipientId: requestedAssignee.id,
        type: 'TASK_ASSIGNED',
        title: 'Task Assigned',
        message: `You have been assigned "${task.title}".`,
      }),
    ]);

    return updated;
  }

  private async rejectTaskReassignment(request: any, dto: UpdateRequestStatusDto, user: JwtPayload) {
    const reviewedAt = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const lock = await tx.task_requests.updateMany({
        where: { id: request.id, status: request_status_enum.PENDING, generated_task_id: null },
        data: {
          status: request_status_enum.REJECTED,
          reviewed_by_id: user.sub,
          reviewed_at: reviewedAt,
          rejection_reason: dto.rejectionReason ?? null,
        },
      });

      if (!lock.count) {
        throw new ConflictException('Request has already been reviewed');
      }

      await tx.audit_logs.create({
        data: {
          user_id: user.sub,
          action: 'REQUEST_REJECTED',
          entity: 'task_requests',
          entity_id: request.id,
          old_value: JSON.stringify({
            requestId: request.id,
            status: request.status,
            type: request.type,
            departmentId: request.department_id,
          }),
          new_value: JSON.stringify({
            requestId: request.id,
            rejectedBy: user.sub,
            rejectedAt: reviewedAt.toISOString(),
            rejectionReason: dto.rejectionReason ?? null,
          }),
        },
      });

      return tx.task_requests.findUnique({ where: { id: request.id } });
    });

    await this.notifications.createNotification({
      recipientId: request.requested_by_id,
      type: 'REQUEST_REJECTED',
      title: 'Task Reassignment Rejected',
      message: `Your reassignment request for "${request.task_title ?? request.title}" was rejected.${dto.rejectionReason ? ` Reason: ${dto.rejectionReason}` : ''}`,
    });

    return updated;
  }

  private getManagedDepartmentIds(user: JwtPayload) {
    return user.departmentIds?.length ? user.departmentIds : user.departmentId ? [user.departmentId] : [];
  }

  private hasDepartmentAccess(request: any, departmentIds: string[]) {
    if (!departmentIds.length) return false;
    return this.requestDepartmentIds(request).some((departmentId) => departmentIds.includes(departmentId));
  }

  private requestDepartmentIds(request: any) {
    const taskDepartments = request.task?.task_departments?.map((item: { department_id: string }) => item.department_id) ?? [];
    return [...new Set([request.department_id, request.task?.department_id, request.users_task_requests_requested_by_idTousers?.department_id, ...taskDepartments].filter(Boolean))];
  }

  private mapRequest(request: any) {
    return {
      ...request,
      departmentId: request.department_id ?? null,
      priority: request.priority ?? null,
      taskTitle: request.task_title ?? request.task?.title ?? request.title,
      taskDescription: request.task_description ?? request.task?.description ?? request.description,
      requestReason: request.request_reason ?? request.reason ?? null,
      taskDepartmentId: request.task?.department_id ?? request.task?.task_departments?.[0]?.department_id ?? request.task_department_id ?? null,
      currentAssigneeName: request.current_assignee?.full_name ?? request.task?.users_tasks_assigned_to_idTousers?.full_name ?? null,
      requestedAssigneeName: request.requested_assignee?.full_name ?? null,
      requesterName: request.users_task_requests_requested_by_idTousers?.full_name ?? null,
      requesterDepartmentId: request.users_task_requests_requested_by_idTousers?.department_id ?? null,
      requestAttachments: request.request_attachments ?? [],
    };
  }

  private async decorateRequestAttachments(request: any) {
    if (!request.request_attachments?.length) {
      return request;
    }

    return {
      ...request,
      request_attachments: await this.attachmentsService.decorateTaskAttachments(request.request_attachments),
    };
  }

  private async assertRequestDepartmentAccess(departmentId: string, user: JwtPayload) {
    const department = await this.prisma.departments.findUnique({
      where: { id: departmentId },
      select: { id: true, is_active: true },
    });

    if (!department?.is_active) {
      throw new BadRequestException('Invalid department selection');
    }

    const allowedDepartments = this.getManagedDepartmentIds(user);

    if (user.role === role_enum.EMPLOYEE) {
      if (user.departmentId !== departmentId) {
        throw new ForbiddenException('You can only submit requests for your own department');
      }
      return;
    }

    if (DEPARTMENT_SCOPED_ROLES.includes(user.role) && allowedDepartments.length && !allowedDepartments.includes(departmentId)) {
      throw new ForbiddenException('You are not authorized for this department');
    }
  }

  private async assertNoDuplicatePendingRequest(requestedById: string, type: any, departmentId: string, title: string) {
    const duplicate = await this.prisma.task_requests.findFirst({
      where: {
        requested_by_id: requestedById,
        type,
        department_id: departmentId,
        title,
        status: request_status_enum.PENDING,
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictException('A similar pending request already exists');
    }
  }

  private async resolvePrimaryReviewerId(departmentId: string | null, requesterId?: string) {
    if (!departmentId) {
      const md = await this.prisma.users.findFirst({
        where: { role: role_enum.MD, is_active: true, deleted_at: null },
        select: { id: true },
      });
      if (!md) {
        throw new BadRequestException('No reviewer available for this request');
      }
      return md.id;
    }

    const department = await this.prisma.departments.findUnique({
      where: { id: departmentId },
      select: { name: true },
    });

    const hod = await this.prisma.users.findFirst({
      where: {
        role: role_enum.HOD,
        is_active: true,
        deleted_at: null,
        ...(requesterId ? { id: { not: requesterId } } : {}),
        hod_departments: { some: { department_id: departmentId } },
      },
      select: { id: true },
    });
    if (hod) return hod.id;

    const assistant = await this.prisma.users.findFirst({
      where: {
        role: { in: [role_enum.EA, role_enum.PA, role_enum.DEPARTMENT_CONTROLLER] },
        is_active: true,
        deleted_at: null,
        ...(requesterId ? { id: { not: requesterId } } : {}),
        assistant_departments: { some: { department_id: departmentId } },
      },
      select: { id: true },
    });
    if (assistant) return assistant.id;

    if (department?.name?.toLowerCase().includes('purchase')) {
      const purchaseHead = await this.prisma.users.findFirst({
        where: {
          role: role_enum.PURCHASE_HEAD,
          is_active: true,
          deleted_at: null,
          ...(requesterId ? { id: { not: requesterId } } : {}),
        },
        select: { id: true },
      });
      if (purchaseHead) return purchaseHead.id;
    }

    const md = await this.prisma.users.findFirst({
      where: { role: role_enum.MD, is_active: true, deleted_at: null },
      select: { id: true },
    });
    if (!md) {
      throw new BadRequestException('No reviewer available for this request');
    }
    return md.id;
  }

  private toTaskCreateDto(request: any, approvedAt: Date) {
    const priority = (request.priority ?? 'MEDIUM') as task_priority_enum;
    const departmentId = request.department_id ?? request.users_task_requests_requested_by_idTousers?.department_id ?? null;
    return {
      title: request.title,
      description: request.description,
      priority,
      dueDate: this.resolveDueDate(priority, approvedAt).toISOString(),
      departmentId,
      attachments: [],
    } as any;
  }

  private resolveDueDate(priority: task_priority_enum, approvedAt: Date) {
    const dueDays = {
      LOW: 7,
      MEDIUM: 5,
      HIGH: 3,
      CRITICAL: 1,
    } as const;
    const days = dueDays[priority] ?? 5;
    return new Date(approvedAt.getTime() + days * 24 * 60 * 60 * 1000);
  }

  private attachmentSelect() {
    return {
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
    };
  }

  private mapAttachment(attachment: any) {
    return {
      id: attachment.id,
      file_name: attachment.file_name,
      file_url: attachment.file_url,
      storage_path: attachment.storage_path,
      file_type: attachment.file_type,
      file_size_kb: attachment.file_size_kb,
      uploaded_by_id: attachment.uploaded_by_id,
      task_id: attachment.task_id,
      request_id: attachment.request_id,
      comment_id: attachment.comment_id,
      self_action_id: attachment.self_action_id,
      self_action_comment_id: attachment.self_action_comment_id,
      created_at: attachment.created_at,
    };
  }
}

