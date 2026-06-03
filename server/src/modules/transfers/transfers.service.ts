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
import { role_enum as Role, transfer_status_enum as TransferStatus } from '@prisma/client';

@Injectable()
export class TransfersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTransferDto, user: JwtPayload) {
    const task = await this.prisma.tasks.findUnique({
      where: { id: dto.taskId },
      select: { id: true, departmentId: true },
    });

    if (!task) throw new NotFoundException('Task not found');

    if (task.departmentId === dto.toDepartmentId)
      throw new BadRequestException('Task already belongs to this department');

    const pending = await this.prisma.task_transfers.findFirst({
      where: { taskId: dto.taskId, status: TransferStatus.PENDING },
    });

    if (pending)
      throw new BadRequestException('A pending transfer already exists for this task');

    const reason = dto.reason ?? null;
    const fromDeptId = task.departmentId as string;

    return this.prisma.task_transfers.create({
      data: {
        task_id: dto.taskId,
        from_dept_id: fromDeptId,
        to_dept_id: dto.toDepartmentId,
        initiated_by_id: user.sub,
        reason,
      },
      select: this.transferSelect(),
    });
  }

  async findAll(user: JwtPayload) {
    const where =
      user.role === Role.MD
        ? {}
        : {
            OR: [
              { from_dept_id: user.departmentId! },
              { to_dept_id: user.departmentId! },
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
      transfer.fromDeptId !== user.departmentId &&
      transfer.toDeptId !== user.departmentId
    ) {
      throw new ForbiddenException('Not authorized to view this transfer');
    }

    return transfer;
  }

  async approve(id: string, dto: TransferActionDto, user: JwtPayload) {
    const transfer = await this.ensurePendingTransfer(id);

    this.ensureApprovalAuthority(transfer, user);

    await this.prisma.$transaction([
      this.prisma.task_transfers.update({
        where: { id },
        data: {
          status: TransferStatus.ACCEPTED,
          receivedById: user.sub,
        },
      }),
      this.prisma.tasks.update({
        where: { id: transfer.taskId },
        data: { department_id: transfer.toDeptId },
      }),
    ]);

    return { message: 'Transfer approved. Task department updated.' };
  }

  async reject(id: string, dto: TransferActionDto, user: JwtPayload) {
    const transfer = await this.ensurePendingTransfer(id);

    this.ensureApprovalAuthority(transfer, user);

    await this.prisma.task_transfers.update({
      where: { id },
      data: {
        status: TransferStatus.REJECTED,
        receivedById: user.sub,
        rejectionReason: dto.reason,
      },
    });

    return { message: 'Transfer rejected.' };
  }

  private async ensurePendingTransfer(id: string) {
    const transfer = await this.prisma.task_transfers.findUnique({
      where: { id },
      select: {
        id: true,
        taskId: true,
        fromDeptId: true,
        toDeptId: true,
        status: true,
        initiatedById: true,
      },
    });

    if (!transfer) throw new NotFoundException('Transfer not found');
    if (transfer.status !== TransferStatus.PENDING)
      throw new BadRequestException('Transfer is no longer pending');

    return transfer;
  }

  private ensureApprovalAuthority(transfer: any, user: JwtPayload) {
    if (
      user.role !== Role.MD &&
      transfer.toDeptId !== user.departmentId
    ) {
      throw new ForbiddenException('Not authorized to action this transfer');
    }
  }

  private transferSelect() {
    return {
      id: true,
      taskId: true,
      fromDeptId: true,
      toDeptId: true,
      initiatedById: true,
      receivedById: true,
      status: true,
      reason: true,
      rejectionReason: true,
      createdAt: true,
      updatedAt: true,
    };
  }
}