// src/modules/self-actions/self-actions.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSelfActionDto } from './dto/create-self-action.dto';
import { UpdateSelfActionDto } from './dto/update-self-action.dto';
import { SelfActionFilterDto } from './dto/self-action-filter.dto';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { role_enum } from '@prisma/client';

const SELECT = {
  id: true,
  title: true,
  description: true,
  actionDate: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      fullName: true,
      role: true,
      departmentId: true,
    },
  },
};

@Injectable()
export class SelfActionsService {
  private readonly logger = new Logger(SelfActionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSelfActionDto, user: JwtPayload) {
    const action = await this.prisma.self_actions.create({
      data: {
        title: dto.title,
        ...(dto.description ? ({ description: dto.description } as any) : {}),
        actionDate: dto.actionDate ? new Date(dto.actionDate) : new Date(),
        userId: user.sub,
      },
      select: SELECT,
    });

    this.logger.log(`SelfAction created by ${user.username}`);
    return action;
  }

  async findAll(user: JwtPayload, filter: SelfActionFilterDto) {
    const where: any = {};

    if (user.role === role_enum.EMPLOYEE) {
      where.userId = user.sub;
    } else if (user.role === role_enum.HOD) {
      where.user = { departmentId: user.departmentId };
      if (filter.userId) where.userId = filter.userId;
    } else if (user.role === role_enum.MD || user.role === role_enum.ADMIN) {
      if (filter.userId) where.userId = filter.userId;
      if (filter.departmentId) {
        where.user = { departmentId: filter.departmentId };
      }
    }

    if (filter.dateFrom || filter.dateTo) {
      where.actionDate = {};
      if (filter.dateFrom) where.actionDate.gte = new Date(filter.dateFrom);
      if (filter.dateTo) where.actionDate.lte = new Date(filter.dateTo);
    }

    return this.prisma.self_actions.findMany({
      where,
      orderBy: { action_date: 'desc' },
      select: SELECT,
    });
  }

  async findOne(id: string, user: JwtPayload) {
    const action = await this.prisma.self_actions.findUnique({
      where: { id },
      select: SELECT,
    });

    if (!action) throw new NotFoundException('Self action not found');

    this.checkReadAccess(action, user);

    return action;
  }

  async update(id: string, dto: UpdateSelfActionDto, user: JwtPayload) {
    const action = await this.prisma.self_actions.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!action) throw new NotFoundException('Self action not found');

    if (action.userId !== user.sub && user.role !== role_enum.ADMIN) {
      throw new ForbiddenException('Not authorized to edit this action');
    }

    return this.prisma.self_actions.update({
      where: { id },
      data: {
        ...(dto as any),
        actionDate: dto.actionDate ? new Date(dto.actionDate) : undefined,
      },
      select: SELECT,
    });
  }

  async remove(id: string, user: JwtPayload) {
    const action = await this.prisma.self_actions.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!action) throw new NotFoundException('Self action not found');

    if (action.userId !== user.sub && user.role !== role_enum.ADMIN) {
      throw new ForbiddenException('Not authorized to delete this action');
    }

    await this.prisma.self_actions.delete({ where: { id } });
    return { message: 'Self action deleted' };
  }

  private checkReadAccess(action: any, user: JwtPayload) {
    if (user.role === role_enum.MD || user.role === role_enum.ADMIN) return;

    if (user.role === role_enum.HOD) {
      if (action.user.departmentId !== user.departmentId) {
        throw new ForbiddenException('Access denied');
      }
      return;
    }

    if (action.user.id !== user.sub) {
      throw new ForbiddenException('Access denied');
    }
  }
}