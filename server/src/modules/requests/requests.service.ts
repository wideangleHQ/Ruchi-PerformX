import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestStatusDto } from './dto/update-request-status.dto';
import { RequestFilterDto } from './dto/request-filter.dto';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { request_status_enum , role_enum } from '@prisma/client';

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── Create ────────────────────────────────────────────────────

  async create(dto: CreateRequestDto, user: JwtPayload) {
    const request = await this.prisma.task_requests.create({
      data: {
        title: dto.title,
        description: dto.description,
        type: dto.type,
        requested_by_id: user.sub,
        status: request_status_enum.PENDING,
      },
    });

    // Notify HOD of new request
    const hod = await this.prisma.users.findFirst({
      where: {
        department_id: user.departmentId,
        role: role_enum.HOD,
        isActive: true,
      },
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

  // ─── List (role-scoped) ────────────────────────────────────────

  async findAll(filters: RequestFilterDto, user: JwtPayload) {
    const where: any = {};

    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;

    if (user.role === role_enum.EMPLOYEE) {
      where.requested_by_id = user.sub;
    } else if (user.role === role_enum.HOD) {
      where.requested_by = { departmentId: user.departmentId };
    }
    // MD sees all — no extra filter

    return this.prisma.task_requests.findMany({
      where,
      include: {
        users_task_requests_requested_by_idTousers: { select: { id: true, full_name: true, department_id: true } },
        users_task_requests_reviewed_by_idTousers: { select: { id: true, full_name: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  // ─── Find One ──────────────────────────────────────────────────

  async findOne(id: string, user: JwtPayload) {
    const request = await this.prisma.task_requests.findUnique({
      where: { id },
      include: {
        users_task_requests_requested_by_idTousers: { select: { id: true, full_name: true, department_id: true } },
        users_task_requests_reviewed_by_idTousers: { select: { id: true, full_name: true } },
      },
    });

    if (!request) throw new NotFoundException('Request not found');

    this.assertAccess(request, user);

    return request;
  }

  // ─── Approve ───────────────────────────────────────────────────

  async approve(id: string, user: JwtPayload) {
    const request = await this.getRequestOrFail(id);

    this.assertReviewAccess(request, user);

    const updated = await this.prisma.task_requests.update({
      where: { id },
      data: {
        status: request_status_enum.ACCEPTED,
        reviewedById: user.sub,
        reviewedAt: new Date(),
      },
    });

    await this.notifications.createNotification({
      recipientId: request.requested_by_id,
      type: 'REQUEST_ACCEPTED',
      title: 'Request Approved',
      message: `Your request "${request.title}" has been approved.`,
    });

    return updated;
  }

  // ─── Reject ────────────────────────────────────────────────────

  async reject(id: string, dto: UpdateRequestStatusDto, user: JwtPayload) {
    const request = await this.getRequestOrFail(id);

    this.assertReviewAccess(request, user);

    const updated = await this.prisma.task_requests.update({
      where: { id },
      data: {
        status: request_status_enum.REJECTED,
        reviewedById: user.sub,
        reviewedAt: new Date(),
        rejectionReason: dto.rejectionReason ?? null,
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

  // ─── Helpers ───────────────────────────────────────────────────

  private async getRequestOrFail(id: string) {
    const request = await this.prisma.task_requests.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Request not found');
    return request;
  }

  private assertAccess(request: any, user: JwtPayload) {
    if (user.role === role_enum.MD) return;
    if (user.role === role_enum.HOD &&
      request.users_task_requests_requested_by_idTousers?.department_id === user.departmentId) return;
    if (user.role === role_enum.EMPLOYEE && request.requested_by_id === user.sub) return;
    throw new ForbiddenException('Access denied');
  }

  private assertReviewAccess(request: any, user: JwtPayload) {
    if (request.status !== request_status_enum.PENDING) {
      throw new ForbiddenException('Request has already been reviewed');
    }
    if (user.role === role_enum.MD) return;
    if (user.role === role_enum.HOD) return;
    throw new ForbiddenException('Only HOD or MD can review requests');
  }
}