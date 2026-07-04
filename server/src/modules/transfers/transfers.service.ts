import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { TransferActionDto } from './dto/transfer-action.dto';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { notification_type_enum, role_enum as Role, transfer_status_enum as TransferStatus } from '@prisma/client';
import { DepartmentScopeService } from '../../common/services/department-scope.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly departmentScopeService: DepartmentScopeService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateTransferDto, user: JwtPayload) {
    const [task, targetDepartment, pending, scope] = await Promise.all([
      this.prisma.tasks.findUnique({
        where: { id: dto.taskId },
        select: { id: true, department_id: true },
      }),
      this.prisma.departments.findFirst({
        where: { id: dto.toDepartmentId, is_active: true },
        select: { id: true },
      }),
      this.prisma.task_transfers.findFirst({
        where: { task_id: dto.taskId, status: TransferStatus.PENDING },
        select: { id: true },
      }),
      this.departmentScopeService.resolveDepartmentScope(user),
    ]);

    if (!task) throw new NotFoundException('Task not found');
    if (!targetDepartment) throw new NotFoundException('Target department not found');

    if (!scope.unrestricted && !scope.departmentIds.includes(task.department_id)) {
      throw new ForbiddenException('Not authorized to transfer this task');
    }

    if (task.department_id === dto.toDepartmentId)
      throw new BadRequestException('Task already belongs to this department');

    if (pending)
      throw new BadRequestException('A pending transfer already exists for this task');

    return this.prisma.task_transfers.create({
      data: {
        task_id: dto.taskId,
        from_dept_id: task.department_id,
        to_dept_id: dto.toDepartmentId,
        initiated_by_id: user.sub,
        reason: dto.reason ?? null,
      },
      select: this.transferSelect(),
    });
  }

  async findAll(user: JwtPayload) {
    const scope = await this.departmentScopeService.resolveDepartmentScope(user);
    const where =
      scope.unrestricted
        ? {}
        : {
            OR: [
              { from_dept_id: { in: scope.departmentIds } },
              { to_dept_id: { in: scope.departmentIds } },
            ],
          };

    return this.prisma.task_transfers.findMany({
      where,
      select: this.transferSelect(),
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string, user: JwtPayload) {
    const transfer = await this.prisma.task_transfers.findUnique({
      where: { id },
      select: this.transferSelect(),
    });

    if (!transfer) throw new NotFoundException('Transfer not found');

    if (
      user.role !== Role.MD &&
      !(await this.canViewTransfer(transfer, user))
    ) {
      throw new ForbiddenException('Not authorized to view this transfer');
    }

    return transfer;
  }

  async approve(id: string, dto: TransferActionDto, user: JwtPayload) {
    const transfer = await this.ensurePendingTransfer(id);

    await this.ensureApprovalAuthority(transfer, user);

    await this.prisma.$transaction([
      this.prisma.task_transfers.update({
        where: { id },
        data: {
          status: TransferStatus.ACCEPTED,
          received_by_id: user.sub,
        },
      }),
      this.prisma.tasks.update({
        where: { id: transfer.task_id },
        data: { department_id: transfer.to_dept_id },
      }),
      this.prisma.task_departments.createMany({
        data: [{ task_id: transfer.task_id, department_id: transfer.to_dept_id }],
        skipDuplicates: true,
      }),
      this.prisma.audit_logs.create({
        data: {
          user_id: user.sub,
          action: 'TRANSFER_ACCEPTED',
          entity: 'task_transfers',
          entity_id: id,
          old_value: JSON.stringify({
            status: transfer.status,
            departmentId: transfer.from_dept_id,
          }),
          new_value: JSON.stringify({
            status: TransferStatus.ACCEPTED,
            receivedBy: user.sub,
            departmentId: transfer.to_dept_id,
            taskId: transfer.task_id,
          }),
        },
      }),
    ]);

    await this.notifyTransferInitiator(transfer.initiated_by_id, transfer.task_id, 'Transfer Accepted', 'Your task transfer has been accepted.', notification_type_enum.TRANSFER_ACCEPTED);

    return { message: 'Transfer approved. Task department updated.' };
  }

  async reject(id: string, dto: TransferActionDto, user: JwtPayload) {
    const transfer = await this.ensurePendingTransfer(id);

    await this.ensureApprovalAuthority(transfer, user);

    await this.prisma.$transaction([
      this.prisma.task_transfers.update({
        where: { id },
        data: {
          status: TransferStatus.REJECTED,
          received_by_id: user.sub,
          rejection_reason: dto.reason ?? null,
        },
      }),
      this.prisma.audit_logs.create({
        data: {
          user_id: user.sub,
          action: 'TRANSFER_REJECTED',
          entity: 'task_transfers',
          entity_id: id,
          old_value: JSON.stringify({ status: transfer.status }),
          new_value: JSON.stringify({
            status: TransferStatus.REJECTED,
            receivedBy: user.sub,
            reason: dto.reason ?? null,
            taskId: transfer.task_id,
          }),
        },
      }),
    ]);

    await this.notifyTransferInitiator(transfer.initiated_by_id, transfer.task_id, 'Transfer Rejected', 'Your task transfer has been rejected.', notification_type_enum.TRANSFER_REJECTED);

    return { message: 'Transfer rejected.' };
  }

  private async ensurePendingTransfer(id: string) {
    const transfer = await this.prisma.task_transfers.findUnique({
      where: { id },
      select: {
        id: true,
        task_id: true,
        from_dept_id: true,
        to_dept_id: true,
        status: true,
        initiated_by_id: true,
      },
    });

    if (!transfer) throw new NotFoundException('Transfer not found');
    if (transfer.status !== TransferStatus.PENDING)
      throw new BadRequestException('Transfer is no longer pending');

    return transfer;
  }

  private async ensureApprovalAuthority(transfer: { to_dept_id: string }, user: JwtPayload) {
    if (user.role === Role.MD) return;

    const scope = await this.departmentScopeService.resolveDepartmentScope(user);
    if (!scope.departmentIds.includes(transfer.to_dept_id)) {
      throw new ForbiddenException('Not authorized to action this transfer');
    }
  }

  private async canViewTransfer(transfer: { from_dept_id: string; to_dept_id: string }, user: JwtPayload) {
    const scope = await this.departmentScopeService.resolveDepartmentScope(user);
    return scope.unrestricted || [transfer.from_dept_id, transfer.to_dept_id].some((deptId) => scope.departmentIds.includes(deptId));
  }

  private async notifyTransferInitiator(
    recipientId: string,
    taskId: string,
    title: string,
    message: string,
    type: notification_type_enum,
  ) {
    try {
      await this.notificationsService.createNotification({
        recipientId,
        type,
        title,
        message,
        taskId,
      } as any);
    } catch (error) {
      console.warn('Transfer notification dispatch failed', error);
    }
  }

  private transferSelect() {
    return {
      id: true,
      task_id: true,
      from_dept_id: true,
      to_dept_id: true,
      initiated_by_id: true,
      received_by_id: true,
      status: true,
      reason: true,
      rejection_reason: true,
      created_at: true,
      updated_at: true,
    };
  }
}
