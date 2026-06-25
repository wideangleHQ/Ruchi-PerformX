import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestStatusDto } from './dto/update-request-status.dto';
import { RequestFilterDto } from './dto/request-filter.dto';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { Prisma, request_status_enum, role_enum, task_status_enum } from '@prisma/client';

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(dto: CreateRequestDto, user: JwtPayload) {
    if ((dto.type as any) === 'TASK_REASSIGNMENT') return this.createTaskReassignment(dto, user);
    if (!dto.title || !dto.description) {
      throw new BadRequestException('Title and description are required');
    }

    const request = await this.prisma.task_requests.create({
      data: {
        title: dto.title,
        description: dto.description,
        type: dto.type as any,
        requested_by_id: user.sub,
        status: request_status_enum.PENDING,
      },
    });

    const hod = await this.prisma.users.findFirst({
      where: { department_id: user.departmentId, role: role_enum.HOD, is_active: true },
    });

    if (hod) {
      await this.notifications.createNotification({
        recipientId: hod.id,
        type: 'TRANSFER_REQUESTED',
        title: 'New Request Submitted',
        message: `A new request has been submitted: "${request.title}"`,
      });
    }

    return request;
  }

  async findAll(filters: RequestFilterDto, user: JwtPayload) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type as any;
    if (filters.taskId) where.task_id = filters.taskId;

    if (user.role === role_enum.EMPLOYEE) {
      where.requested_by_id = user.sub;
    } else if (user.role === role_enum.HOD || user.role === role_enum.PURCHASE_HEAD) {
      const deptIds = this.getManagedDepartmentIds(user);
      if (!deptIds.length) {
        where.id = { in: [] };
      }
      where.OR = [
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
        current_assignee: { select: { id: true, full_name: true } },
        requested_assignee: { select: { id: true, full_name: true } },
        users_task_requests_requested_by_idTousers: { select: { id: true, full_name: true, department_id: true } },
        users_task_requests_reviewed_by_idTousers: { select: { id: true, full_name: true } },
      },
      orderBy: { created_at: 'desc' },
    } as any);

    return items.map((item: any) => this.mapRequest(item));
  }

  async findOne(id: string, user: JwtPayload) {
    const request = await this.prisma.task_requests.findUnique({
      where: { id },
      include: {
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
        current_assignee: { select: { id: true, full_name: true } },
        requested_assignee: { select: { id: true, full_name: true } },
        users_task_requests_requested_by_idTousers: { select: { id: true, full_name: true, department_id: true } },
        users_task_requests_reviewed_by_idTousers: { select: { id: true, full_name: true } },
      },
    } as any);

    if (!request) throw new NotFoundException('Request not found');
    this.assertAccess(request, user);
    return this.mapRequest(request);
  }

  async approve(id: string, dto: UpdateRequestStatusDto, user: JwtPayload) {
    const request = await this.getRequestOrFail(id);
    this.assertReviewAccess(request, user);

    if ((request.type as any) === 'TASK_REASSIGNMENT') {
      return this.approveTaskReassignment(request, dto, user);
    }

    const updated = await this.prisma.task_requests.update({
      where: { id },
      data: { status: request_status_enum.ACCEPTED, reviewed_by_id: user.sub, reviewed_at: new Date() },
    });

    await this.notifications.createNotification({
      recipientId: request.requested_by_id,
      type: 'REQUEST_ACCEPTED',
      title: 'Request Approved',
      message: `Your request "${request.title}" has been approved.`,
    });

    return updated;
  }

  async reject(id: string, dto: UpdateRequestStatusDto, user: JwtPayload) {
    const request = await this.getRequestOrFail(id);
    this.assertReviewAccess(request, user);

    if ((request.type as any) === 'TASK_REASSIGNMENT') {
      return this.rejectTaskReassignment(request, dto, user);
    }

    const updated = await this.prisma.task_requests.update({
      where: { id },
      data: {
        status: request_status_enum.REJECTED,
        reviewed_by_id: user.sub,
        reviewed_at: new Date(),
        rejection_reason: dto.rejectionReason ?? null,
      },
    });

    await this.notifications.createNotification({
      recipientId: request.requested_by_id,
      type: 'REQUEST_REJECTED',
      title: 'Request Rejected',
      message: `Your request "${request.title}" was rejected.${dto.rejectionReason ? ` Reason: ${dto.rejectionReason}` : ''}`,
    });

    return updated;
  }

  private async getRequestOrFail(id: string) {
    const request = await this.prisma.task_requests.findUnique({
      where: { id },
      include: {
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
        current_assignee: { select: { id: true, full_name: true } },
        requested_assignee: { select: { id: true, full_name: true } },
        users_task_requests_requested_by_idTousers: { select: { id: true, full_name: true, department_id: true } },
        users_task_requests_reviewed_by_idTousers: { select: { id: true, full_name: true } },
      },
    } as any);
    if (!request) throw new NotFoundException('Request not found');
    return request;
  }

  private assertAccess(request: any, user: JwtPayload) {
    if (user.role === role_enum.MD) return;
    if ((user.role === role_enum.HOD || user.role === role_enum.PURCHASE_HEAD) && this.hasDepartmentAccess(request, this.getManagedDepartmentIds(user))) return;
    if (user.role === role_enum.EMPLOYEE && request.requested_by_id === user.sub) return;
    throw new ForbiddenException('Access denied');
  }

  private assertReviewAccess(request: any, user: JwtPayload) {
    if (request.status !== request_status_enum.PENDING) throw new ForbiddenException('Request has already been reviewed');
    if (user.role === role_enum.MD) return;
    if ((user.role === role_enum.HOD || user.role === role_enum.PURCHASE_HEAD) && this.hasDepartmentAccess(request, this.getManagedDepartmentIds(user))) return;
    throw new ForbiddenException('Only HOD or MD can review requests');
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
        status: true,
        department_id: true,
        assigned_to_id: true,
        task_departments: { select: { department_id: true } },
      },
    });

    if (!task) throw new NotFoundException('Task not found');
    if (task.assigned_to_id !== user.sub || dto.currentAssigneeId !== user.sub) throw new ForbiddenException('You can only request reassignment for your own task');
    if (task.status === task_status_enum.COMPLETED || task.status === task_status_enum.CLOSED) throw new ForbiddenException('Task is not active');

    const duplicate = await this.prisma.task_requests.findFirst({
      where: { type: 'TASK_REASSIGNMENT' as any, status: request_status_enum.PENDING, task_id: task.id },
    });
    if (duplicate) throw new ForbiddenException('A pending reassignment request already exists for this task');

    const request = await this.prisma.task_requests.create({
      data: {
        title: task.title,
        description: task.description,
        type: 'TASK_REASSIGNMENT' as any,
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
        role: { in: [role_enum.HOD, role_enum.PURCHASE_HEAD] },
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
    if ((user.role === role_enum.HOD || user.role === role_enum.PURCHASE_HEAD) && !this.getManagedDepartmentIds(user).includes(task.department_id)) throw new ForbiddenException('Not authorized to review this task');
    if (request.current_assignee_id && task.assigned_to_id && task.assigned_to_id !== request.current_assignee_id) {
      throw new ConflictException('Task assignment has changed');
    }

    const requestedAssignee = await this.prisma.users.findFirst({
      where: { id: dto.newAssigneeId, role: role_enum.EMPLOYEE, is_active: true, deleted_at: null, pending_approval: false, department_id: task.department_id },
      select: { id: true, full_name: true },
    });
    if (!requestedAssignee) throw new BadRequestException('Requested assignee is no longer valid');

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.task_requests.update({
        where: { id: request.id },
        data: {
          status: request_status_enum.ACCEPTED,
          reviewed_by_id: user.sub,
          reviewed_at: new Date(),
          requested_assignee_id: requestedAssignee.id,
        },
      });

      await tx.tasks.update({ where: { id: task.id }, data: { assigned_to_id: requestedAssignee.id } });
      await tx.audit_logs.create({
        data: {
          user_id: user.sub,
          action: 'TASK_ASSIGNEE_CHANGED',
          entity: 'tasks',
          entity_id: task.id,
          old_value: JSON.stringify({ previousAssigneeId: task.assigned_to_id, reason: request.request_reason }),
          new_value: JSON.stringify({ newAssigneeId: requestedAssignee.id, approvedBy: user.sub, approvedAt: new Date().toISOString() }),
        },
      });
      return result;
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
    const updated = await this.prisma.task_requests.update({
      where: { id: request.id },
      data: { status: request_status_enum.REJECTED, reviewed_by_id: user.sub, reviewed_at: new Date(), rejection_reason: dto.rejectionReason ?? null },
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
    return [...new Set([request.task?.department_id, request.users_task_requests_requested_by_idTousers?.department_id, ...taskDepartments].filter(Boolean))];
  }

  private mapRequest(request: any) {
    return {
      ...request,
      taskTitle: request.task_title ?? request.task?.title ?? request.title,
      taskDescription: request.task_description ?? request.task?.description ?? request.description,
      requestReason: request.request_reason ?? request.reason ?? null,
      taskDepartmentId: request.task?.department_id ?? request.task?.task_departments?.[0]?.department_id ?? request.task_department_id ?? null,
      currentAssigneeName: request.current_assignee?.full_name ?? request.task?.users_tasks_assigned_to_idTousers?.full_name ?? null,
      requestedAssigneeName: request.requested_assignee?.full_name ?? null,
      requesterName: request.users_task_requests_requested_by_idTousers?.full_name ?? null,
      requesterDepartmentId: request.users_task_requests_requested_by_idTousers?.department_id ?? null,
    };
  }
}
