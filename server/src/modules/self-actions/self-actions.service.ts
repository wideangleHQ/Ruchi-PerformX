import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSelfActionDto } from './dto/create-self-action.dto';
import { UpdateSelfActionDto } from './dto/update-self-action.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { SelfActionFilterDto } from './dto/self-action-filter.dto';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { role_enum, self_action_status_enum } from '@prisma/client';

const SELECT = {
  id: true,
  title: true,
  description: true,
  priority: true,
  status: true,
  created_by_id: true,
  department_id: true,
  completed_at: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
  users: {
    select: {
      id: true,
      full_name: true,
      role: true,
      department_id: true,
    },
  },
  departments: {
    select: {
      id: true,
      name: true,
    },
  },
  task_attachments: {
    select: {
      id: true,
      file_name: true,
      file_url: true,
      file_type: true,
      file_size_kb: true,
    },
  },
};

@Injectable()
export class SelfActionsService {
  private readonly logger = new Logger(SelfActionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSelfActionDto, user: JwtPayload) {
    const userDept = await this.prisma.users.findUnique({
      where: { id: user.sub },
      select: { department_id: true },
    });

    if (!userDept?.department_id) {
      throw new BadRequestException('User must belong to a department');
    }

    const action = await this.prisma.$transaction(async (tx) => {
      const created = await tx.self_actions.create({
        data: {
          title: dto.title,
          description: dto.description,
          priority: dto.priority || 'MEDIUM',
          status: 'OPEN',
          created_by_id: user.sub,
          department_id: userDept.department_id as string,
        },
        select: SELECT,
      });

      await tx.self_action_logs.create({
        data: {
          self_action_id: created.id,
          actor_id: user.sub,
          event_type: 'CREATED',
          new_value: JSON.stringify({ status: 'OPEN', priority: dto.priority }),
        },
      });

      return created;
    });

    this.logger.log(`SelfAction ${action.id} created by ${user.username}`);
    return action;
  }

  async findAll(user: JwtPayload, filter: SelfActionFilterDto) {
    const clauses: any[] = [{ deleted_at: null }];

    if (filter.status) clauses.push({ status: filter.status });
    if (filter.priority) clauses.push({ priority: filter.priority });
    if (filter.departmentId) clauses.push({ department_id: filter.departmentId });
    if (filter.createdById) clauses.push({ created_by_id: filter.createdById });
    if (filter.search) {
      clauses.push({
        OR: [
          { title: { contains: filter.search, mode: 'insensitive' } },
          { description: { contains: filter.search, mode: 'insensitive' } },
        ],
      });
    }
    if (filter.dateFrom || filter.dateTo) {
      const createdAt: any = {};
      if (filter.dateFrom) createdAt.gte = new Date(filter.dateFrom);
      if (filter.dateTo) createdAt.lte = new Date(filter.dateTo);
      clauses.push({ created_at: createdAt });
    }

    const visible = this.getVisibilityFilter(user);
    if (visible) clauses.push(visible);

    const where = clauses.length === 1 ? clauses[0] : { AND: clauses };

    const [data, total] = await Promise.all([
      this.prisma.self_actions.findMany({
        where,
        select: SELECT,
        orderBy: { created_at: 'desc' },
        skip: ((filter.page || 1) - 1) * (filter.limit || 20),
        take: filter.limit || 20,
      }),
      this.prisma.self_actions.count({
        where,
      }),
    ]);

    return {
      data,
      total,
      page: filter.page || 1,
      limit: filter.limit || 20,
      hasMore: ((filter.page || 1) * (filter.limit || 20)) < total,
    };
  }

  async findOne(id: string, user: JwtPayload) {
    const action = await this.prisma.self_actions.findUnique({
      where: { id },
      select: SELECT,
    });

    if (!action) throw new NotFoundException('Self action not found');
    if (action.deleted_at) throw new NotFoundException('Self action not found');

    this.checkReadAccess(action, user);
    return action;
  }

  async update(id: string, dto: UpdateSelfActionDto, user: JwtPayload) {
    const action = await this.prisma.self_actions.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        created_by_id: true,
        department_id: true,
        status: true,
        users: { select: { role: true, department_id: true } },
      },
    });

    if (!action) throw new NotFoundException('Self action not found');

    const canEdit = this.canEditAction(action, user);
    if (!canEdit) throw new ForbiddenException('Not authorized to edit this action');

    const updateData: any = { updated_at: new Date() };
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.priority !== undefined) updateData.priority = dto.priority;

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.self_actions.update({
        where: { id },
        data: updateData,
        select: SELECT,
      });

      if (dto.title !== undefined || dto.description !== undefined || dto.priority !== undefined) {
        await tx.self_action_logs.create({
          data: {
            self_action_id: id,
            actor_id: user.sub,
            event_type: 'UPDATED',
            old_value: JSON.stringify({
              title: action.title,
              description: action.description,
              priority: action.priority,
            }),
            new_value: JSON.stringify({
              title: dto.title ?? action.title,
              description: dto.description ?? action.description,
              priority: dto.priority ?? action.priority,
            }),
          },
        });
      }

      return result;
    });

    return updated;
  }

  async changeStatus(id: string, dto: ChangeStatusDto, user: JwtPayload) {
    const action = await this.prisma.self_actions.findUnique({
      where: { id },
      select: { id: true, created_by_id: true, status: true },
    });

    if (!action) throw new NotFoundException('Self action not found');

    const canEdit = user.role === role_enum.MD || user.role === role_enum.ADMIN || action.created_by_id === user.sub;
    if (!canEdit) throw new ForbiddenException('Not authorized');

    this.validateStatusTransition(action.status as self_action_status_enum, dto.status);

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.self_actions.update({
        where: { id },
        data: {
          status: dto.status,
          completed_at: dto.status === 'COMPLETED' ? new Date() : null,
          updated_at: new Date(),
        },
        select: SELECT,
      });

      await tx.self_action_logs.create({
        data: {
          self_action_id: id,
          actor_id: user.sub,
          event_type: 'STATUS_CHANGED',
          old_value: action.status,
          new_value: dto.status,
        },
      });

      return result;
    });

    return updated;
  }

  async softDelete(id: string, user: JwtPayload) {
    const action = await this.prisma.self_actions.findUnique({
      where: { id },
      select: { id: true, created_by_id: true },
    });

    if (!action) throw new NotFoundException('Self action not found');

    const canDelete = user.role === role_enum.MD || user.role === role_enum.ADMIN || action.created_by_id === user.sub;
    if (!canDelete) throw new ForbiddenException('Not authorized to delete');

    await this.prisma.$transaction(async (tx) => {
      await tx.self_actions.update({
        where: { id },
        data: { deleted_at: new Date() },
      });

      await tx.self_action_logs.create({
        data: {
          self_action_id: id,
          actor_id: user.sub,
          event_type: 'DELETED',
        },
      });
    });

    return { message: 'Self action deleted' };
  }

  private getVisibilityFilter(user: JwtPayload) {
    if (user.role === role_enum.MD || user.role === role_enum.ADMIN) {
      return null;
    }

    if (user.role === role_enum.EA || user.role === role_enum.PA) {
      return null;
    }

    if (user.role === role_enum.HOD) {
      return {
        OR: [
          { created_by_id: user.sub },
          { department_id: user.departmentId, users: { role: role_enum.EMPLOYEE } },
        ],
      };
    }

    return { created_by_id: user.sub };
  }

  private checkReadAccess(action: any, user: JwtPayload) {
    if (user.role === role_enum.MD || user.role === role_enum.ADMIN) return;
    if (user.role === role_enum.EA || user.role === role_enum.PA) return;

    if (user.role === role_enum.HOD) {
      if (action.users?.id === user.sub) return;
      if (action.department_id === user.departmentId && action.users?.role === role_enum.EMPLOYEE) return;
      throw new ForbiddenException('Access denied');
    }

    if (action.users?.id !== user.sub) {
      throw new ForbiddenException('Access denied');
    }
  }

  private canEditAction(action: any, user: JwtPayload): boolean {
    if (user.role === role_enum.MD || user.role === role_enum.ADMIN) return true;
    if (action.created_by_id === user.sub) return true;
    if (user.role === role_enum.EA || user.role === role_enum.PA) return true;

    if (user.role === role_enum.HOD && action.department_id === user.departmentId) {
      return action.users?.role === role_enum.EMPLOYEE || action.created_by_id === user.sub;
    }

    return false;
  }

  private validateStatusTransition(from: self_action_status_enum, to: self_action_status_enum) {
    const allowed: Record<self_action_status_enum, self_action_status_enum[]> = {
      OPEN: ['ONGOING', 'ABORTED'],
      ONGOING: ['COMPLETED', 'ABORTED'],
      COMPLETED: [],
      ABORTED: [],
    };

    if (!allowed[from]?.includes(to)) {
      throw new BadRequestException(`Cannot transition from ${from} to ${to}`);
    }
  }
}
