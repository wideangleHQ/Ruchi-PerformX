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
  status: true,
  remarks: true,
  category: true,
  action_date: true,
  created_at: true,
  updated_at: true,
  users: {
    select: {
      id: true,
      full_name: true,
      role: true,
      department_id: true,
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
        status: (dto as any).status ?? 'PENDING',
        action_date: dto.actionDate ? new Date(dto.actionDate) : new Date(),
        user_id: user.sub,
      },
      select: SELECT,
    });

    this.logger.log(`SelfAction created by ${user.username}`);
    return action;
  }

  async findAll(user: JwtPayload, filter: SelfActionFilterDto) {
    const where: any = {};

    if (user.role === role_enum.EMPLOYEE) {
      where.user_id = user.sub;
    } else if (user.role === role_enum.HOD) {
      where.users = { department_id: user.departmentId };
      if (filter.userId) where.user_id = filter.userId;
    } else if (user.role === role_enum.MD || user.role === role_enum.ADMIN) {
      if (filter.userId) where.user_id = filter.userId;
      if (filter.departmentId) {
        where.users = { department_id: filter.departmentId };
      }
    }

    if (filter.dateFrom || filter.dateTo) {
      where.action_date = {};
      if (filter.dateFrom) where.action_date.gte = new Date(filter.dateFrom);
      if (filter.dateTo) where.action_date.lte = new Date(filter.dateTo);
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
      select: { id: true, user_id: true },
    });

    if (!action) throw new NotFoundException('Self action not found');

    if (action.user_id !== user.sub && user.role !== role_enum.ADMIN) {
      throw new ForbiddenException('Not authorized to edit this action');
    }

    return this.prisma.self_actions.update({
      where: { id },
      data: {
        ...(dto as any),
        action_date: (dto as any).actionDate ? new Date((dto as any).actionDate) : undefined,
      },
      select: SELECT,
    });
  }

  async remove(id: string, user: JwtPayload) {
    const action = await this.prisma.self_actions.findUnique({
      where: { id },
      select: { id: true, user_id: true },
    });

    if (!action) throw new NotFoundException('Self action not found');

    if (action.user_id !== user.sub && user.role !== role_enum.ADMIN) {
      throw new ForbiddenException('Not authorized to delete this action');
    }

    await this.prisma.self_actions.delete({ where: { id } });
    return { message: 'Self action deleted' };
  }

  private checkReadAccess(action: any, user: JwtPayload) {
    if (user.role === role_enum.MD || user.role === role_enum.ADMIN) return;

    if (user.role === role_enum.HOD) {
      if (action.users?.department_id !== user.departmentId) {
        throw new ForbiddenException('Access denied');
      }
      return;
    }

    if (action.users?.id !== user.sub) {
      throw new ForbiddenException('Access denied');
    }
  }
}