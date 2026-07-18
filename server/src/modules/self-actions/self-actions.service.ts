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
import { CreateSelfActionCommentDto } from './dto/create-self-action-comment.dto';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { Prisma, role_enum, self_action_status_enum } from '@prisma/client';
import { AttachmentsService } from '../attachments/attachments.service';
import { UploadedFile } from '../../common/types/uploaded-file.type';
import { DepartmentScopeService } from '../../common/services/department-scope.service';
import { DepartmentQueryHelper } from '../../common/helpers/department-query.helper';

const SELECT = {
  id: true,
  title: true,
  description: true,
  priority: true,
  status: true,
  created_by_id: true,
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
  self_action_departments: {
    select: {
      department_id: true,
      departments: {
        select: {
          id: true,
          name: true,
        },
      },
    },
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
};

@Injectable()
export class SelfActionsService {
  private readonly logger = new Logger(SelfActionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly attachmentsService: AttachmentsService,
    private readonly departmentScopeService: DepartmentScopeService,
  ) {}

  async create(dto: CreateSelfActionDto, user: JwtPayload, attachments: UploadedFile[] = []) {
    if (!user?.sub) {
      throw new BadRequestException('Invalid token: missing user identity');
    }

    try {
      // Resolve department scope
      const scope = await this.departmentScopeService.resolveDepartmentScope(user);
      
      let departmentIds: string[] = dto.department_ids || [];

      if (!departmentIds.length && dto.department_id) {
        departmentIds = [dto.department_id];
      }

      // If no departments specified, use user's scope
      if (!departmentIds.length) {
        departmentIds = scope.departmentIds;
      }

      departmentIds = [...new Set(departmentIds)].filter(Boolean);

      this.logger.log(
        `create self-action payload=${JSON.stringify(dto)} user=${JSON.stringify({
          sub: user?.sub,
          username: user?.username,
          role: user?.role,
          departmentIds,
        })}`,
      );

      if (!departmentIds.length) {
        throw new BadRequestException('User must belong to a department');
      }

      // Validate department access
      const isValid = await this.departmentScopeService.validateDepartmentAccess(user, departmentIds);
      if (!isValid) {
        throw new ForbiddenException('You do not have access to the specified departments');
      }

      const action = await this.prisma.$transaction(async (tx) => {
        const created = await tx.self_actions.create({
          data: {
            title: dto.title,
            description: dto.description,
            priority: dto.priority ?? 'MEDIUM',
            status: 'OPEN',
            created_by_id: user.sub,
          },
          select: { id: true },
        });

        await tx.self_action_departments.createMany({
          data: departmentIds.map((deptId) => ({
            self_action_id: created.id,
            department_id: deptId,
          })),
          skipDuplicates: true,
        });

        await tx.self_action_logs.create({
          data: {
            self_action_id: created.id,
            actor_id: user.sub,
            event_type: 'CREATED',
            new_value: JSON.stringify({ status: 'OPEN', priority: dto.priority ?? 'MEDIUM' }),
          },
        });

        return created;
      });

      if (attachments.length) {
        try {
          await this.attachmentsService.uploadSelfActionAttachments(action.id, attachments, user);
        } catch (error) {
          await this.prisma.self_actions.delete({ where: { id: action.id } });
          throw error;
        }
      }

      const hydrated = await this.findOne(action.id, user);
      this.logger.log(`SelfAction ${action.id} created by ${user.username}`);
      return hydrated;
    } catch (error) {
      this.logger.error(
        `SelfAction create failed: ${(error as any)?.message ?? error}`,
        (error as any)?.stack,
      );
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') {
          throw new BadRequestException(
            `Foreign key constraint failed on field: ${(error.meta as any)?.field_name ?? 'unknown'}. Verify JWT sub is a valid user UUID.`,
          );
        }
        if (error.code === 'P2002') {
          throw new BadRequestException('Duplicate record');
        }
      }
      throw error;
    }
  }

  async findAll(user: JwtPayload, filter: SelfActionFilterDto) {
    const clauses: any[] = [{ deleted_at: null }];

    if (filter.mine) {
      // "My Self Actions": ownership only, identity always from JWT.
      // No department scoping needed — users always see their own records.
      clauses.push({ created_by_id: user.sub });
    } else {
      // Resolve department scope
      const scope = await this.departmentScopeService.resolveDepartmentScope(user);

      // Apply department filter using helper
      const departmentFilter = DepartmentQueryHelper.buildSelfActionDepartmentFilter(scope);
      if (Object.keys(departmentFilter).length > 0) {
        clauses.push(departmentFilter);
      }

      // For employees, add ownership filter
      if (user.role === role_enum.EMPLOYEE) {
        clauses.push({ created_by_id: user.sub });
      }
    }

    if (filter.status) clauses.push({ status: filter.status });
    if (filter.priority) clauses.push({ priority: filter.priority });
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

    if (filter.departmentId) clauses.push({ self_action_departments: { some: { department_id: filter.departmentId } } });
    // createdById is ignored in "mine" mode — identity comes exclusively from JWT
    if (filter.createdById && !filter.mine) clauses.push({ created_by_id: filter.createdById });

    const where = clauses.length === 1 ? clauses[0] : { AND: clauses };

    const [data, total] = await Promise.all([
      this.prisma.self_actions.findMany({
        where,
        select: SELECT,
        orderBy: { created_at: 'desc' },
        skip: ((filter.page || 1) - 1) * (filter.limit || 20),
        take: filter.limit || 20,
      }),
      this.prisma.self_actions.count({ where }),
    ]);

    return {
      data: await Promise.all(data.map((item) => this.mapAction(item))),
      total,
      page: filter.page || 1,
      limit: filter.limit || 20,
      hasMore: (filter.page || 1) * (filter.limit || 20) < total,
    };
  }

  async findOne(id: string, user: JwtPayload) {
    const action = await this.prisma.self_actions.findUnique({
      where: { id },
      select: SELECT,
    });

    if (!action) throw new NotFoundException('Self action not found');
    if (action.deleted_at) throw new NotFoundException('Self action not found');

    await this.checkReadAccess(action, user);
    return this.mapAction(action);
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
        status: true,
        self_action_departments: { select: { department_id: true } },
        users: { select: { role: true, department_id: true } },
      },
    });

    if (!action) throw new NotFoundException('Self action not found');

    const canEdit = await this.canEditAction(action, user);
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

    return this.mapAction(updated);
  }

  async changeStatus(id: string, dto: ChangeStatusDto, user: JwtPayload) {
    const action = await this.prisma.self_actions.findUnique({
      where: { id },
      select: { id: true, created_by_id: true, status: true, self_action_departments: { select: { department_id: true } }, users: { select: { role: true, department_id: true } } },
    });

    if (!action) throw new NotFoundException('Self action not found');

    const canEdit = await this.canEditAction(action, user);
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

    return this.mapAction(updated);
  }

  async softDelete(id: string, user: JwtPayload) {
    const action = await this.prisma.self_actions.findUnique({
      where: { id },
      select: { id: true, created_by_id: true, self_action_departments: { select: { department_id: true } } },
    });

    if (!action) throw new NotFoundException('Self action not found');

    const canDelete = await this.canEditAction(action, user);
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

  async findComments(id: string, user: JwtPayload) {
    const action = await this.ensureActionVisible(id, user);

    const comments = await this.prisma.self_action_comments.findMany({
      where: { self_action_id: action.id, parent_comment_id: null },
      select: this.commentSelect(),
      orderBy: { created_at: 'asc' },
    });

    return Promise.all(comments.map((comment) => this.mapComment(comment)));
  }

  async addComment(
    id: string,
    dto: CreateSelfActionCommentDto,
    user: JwtPayload,
    attachments: UploadedFile[] = [],
  ) {
    await this.ensureActionVisible(id, user);
    await this.ensureParentCommentBelongsToAction(id, dto.parentCommentId);

    const comment = await this.prisma.self_action_comments.create({
      data: {
        self_action_id: id,
        user_id: user.sub,
        content: dto.content,
        parent_comment_id: dto.parentCommentId ?? null,
      },
      select: this.commentSelect(),
    });

    if (attachments.length) {
      try {
        await this.attachmentsService.uploadSelfActionCommentAttachments(id, comment.id, attachments, user);
      } catch (error) {
        await this.prisma.self_action_comments.delete({ where: { id: comment.id } });
        throw error;
      }
    }

    return this.mapComment(await this.findCommentById(comment.id));
  }

  private async ensureActionVisible(id: string, user: JwtPayload) {
    const action = await this.prisma.self_actions.findUnique({
      where: { id },
      select: {
        id: true,
        created_by_id: true,
        deleted_at: true,
        self_action_departments: { select: { department_id: true } },
        users: { select: { id: true, role: true, department_id: true } },
      },
    });

    if (!action || action.deleted_at) throw new NotFoundException('Self action not found');
    this.checkReadAccess(action, user);
    return action;
  }

  private async findCommentById(id: string) {
    const comment = await this.prisma.self_action_comments.findUnique({
      where: { id },
      select: this.commentSelect(),
    });

    if (!comment) throw new NotFoundException('Comment not found');
    return comment;
  }

  private async ensureParentCommentBelongsToAction(id: string, parentCommentId?: string) {
    if (!parentCommentId) return;

    const parent = await this.prisma.self_action_comments.findFirst({
      where: { id: parentCommentId, self_action_id: id },
      select: { id: true },
    });

    if (!parent) {
      throw new NotFoundException('Parent comment not found');
    }
  }

  private async checkReadAccess(action: any, user: JwtPayload) {
    // Employees can see their own actions
    if (action.created_by_id === user.sub) return;
    
    // Check department access (handles unrestricted roles internally)
    const actionDeptIds = action.self_action_departments?.map((d: any) => d.department_id) || [];
    const hasDeptAccess = await this.departmentScopeService.hasAnyDepartmentAccess(user, actionDeptIds);
    
    if (hasDeptAccess) return;
    
    throw new ForbiddenException('Access denied');
  }

  private async canEditAction(action: any, user: JwtPayload): Promise<boolean> {
    // Creator can edit own action
    if (action.created_by_id === user.sub) return true;
    
    // Check department access (handles unrestricted roles internally)
    const actionDeptIds = action.self_action_departments?.map((d: any) => d.department_id) || [];
    return this.departmentScopeService.hasAnyDepartmentAccess(user, actionDeptIds);
  }

  private validateStatusTransition(
    from: self_action_status_enum,
    to: self_action_status_enum,
  ) {
    if (from === to) return;

    const allowed: Record<self_action_status_enum, self_action_status_enum[]> = {
      OPEN: ['ONGOING', 'ABORTED'],
      ONGOING: ['COMPLETED', 'ABORTED', 'OPEN'],
      COMPLETED: ['OPEN', 'ONGOING'],
      ABORTED: ['OPEN', 'ONGOING'],
    };

    if (!allowed[from]?.includes(to)) {
      throw new BadRequestException(`Cannot transition from ${from} to ${to}`);
    }
  }

  private async mapAction(action: any): Promise<any> {
    return {
      ...action,
      department_id: action.self_action_departments?.[0]?.department_id,
      departments: action.self_action_departments?.[0]?.departments,
      departmentIds: action.self_action_departments?.map((d: any) => d.department_id) || [],
      departmentsList: action.self_action_departments?.map((d: any) => d.departments) || [],
      task_attachments: await this.attachmentsService.decorateTaskAttachments(action.task_attachments),
    };
  }

  private commentSelect() {
    return {
      id: true,
      self_action_id: true,
      user_id: true,
      parent_comment_id: true,
      content: true,
      is_tagged: true,
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
      self_action_comment_replies: {
        select: {
          id: true,
          self_action_id: true,
          user_id: true,
          parent_comment_id: true,
          content: true,
          is_tagged: true,
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
        },
      },
    };
  }

  private async mapComment(comment: any): Promise<any> {
    return {
      id: comment.id,
      selfActionId: comment.self_action_id,
      userId: comment.user_id,
      parentCommentId: comment.parent_comment_id,
      content: comment.content,
      isTagged: comment.is_tagged ?? false,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      attachments: await this.attachmentsService.decorateTaskAttachments(comment.task_attachments),
      replies: comment.self_action_comment_replies?.length
        ? await Promise.all(comment.self_action_comment_replies.map((reply: any) => this.mapComment(reply)))
        : [],
      user: comment.users
        ? {
            id: comment.users.id,
            fullName: comment.users.full_name,
            role: comment.users.role,
            departmentId: comment.users.department_id,
          }
        : undefined,
    };
  }
}

