import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { role_enum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { UploadedFile } from '../../common/types/uploaded-file.type';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  async create(dto: CreateCommentDto, user: JwtPayload, attachments: UploadedFile[] = []) {
    return this.createForTask(
      dto.taskId,
      { content: dto.content, ...(dto.parentCommentId ? { parentCommentId: dto.parentCommentId } : {}) },
      user,
      attachments,
    );
  }

  async createForTask(
    taskId: string,
    dto: CreateTaskCommentDto,
    user: JwtPayload,
    attachments: UploadedFile[] = [],
  ) {
    await this.ensureTaskVisible(taskId, user);
    await this.ensureParentCommentBelongsToTask(taskId, dto.parentCommentId);

    const comment = await this.prisma.task_comments.create({
      data: {
        content: dto.content,
        task_id: taskId,
        user_id: user.sub,
        parent_comment_id: dto.parentCommentId ?? null,
      },
      select: this.commentSelect(),
    });

    if (attachments.length) {
      await this.attachmentsService.uploadTaskCommentAttachments(taskId, comment.id, attachments, user);
    }

    return this.mapTaskComment(await this.findCommentById(comment.id));
  }

  async findByTask(taskId: string, user: JwtPayload) {
    await this.ensureTaskVisible(taskId, user);

    const comments = await this.prisma.task_comments.findMany({
      where: { task_id: taskId, parent_comment_id: null },
      select: this.commentSelect(),
      orderBy: { created_at: 'asc' },
    });

    return Promise.all(comments.map((comment) => this.mapTaskComment(comment)));
  }

  async update(id: string, dto: UpdateCommentDto, user: JwtPayload) {
    const comment = await this.ensureCommentExists(id);
    this.ensureOwnership(comment.user_id, user);

    const updated = await this.prisma.task_comments.update({
      where: { id },
      data: { content: dto.content },
      select: this.commentSelect(),
    });

    return this.mapTaskComment(updated);
  }

  async remove(id: string, user: JwtPayload) {
    const comment = await this.ensureCommentExists(id);
    this.ensureOwnership(comment.user_id, user);

    await this.prisma.task_comments.delete({ where: { id } });
    return { message: 'Comment deleted successfully' };
  }

  private async ensureTaskVisible(taskId: string, user: JwtPayload) {
    const task = await this.prisma.tasks.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        department_id: true,
        assigned_to_id: true,
        assigned_by_id: true,
        task_departments: { select: { department_id: true } },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (user.role === role_enum.MD || user.role === role_enum.ADMIN) return;

    const departmentIds = [...new Set([task.department_id, ...task.task_departments.map((item) => item.department_id)].filter(Boolean))];
    if (user.role === role_enum.EMPLOYEE && user.departmentId && departmentIds.includes(user.departmentId)) return;
    if ((user.role === role_enum.HOD || user.role === role_enum.EA || user.role === role_enum.PA) && user.departmentIds?.some((id) => departmentIds.includes(id))) return;

    throw new ForbiddenException('Access denied to this task');
  }

  private async ensureParentCommentBelongsToTask(taskId: string, parentCommentId?: string) {
    if (!parentCommentId) return;

    const parent = await this.prisma.task_comments.findFirst({
      where: { id: parentCommentId, task_id: taskId },
      select: { id: true },
    });

    if (!parent) {
      throw new NotFoundException('Parent comment not found');
    }
  }

  private async findCommentById(id: string) {
    const comment = await this.prisma.task_comments.findUnique({
      where: { id },
      select: this.commentSelect(),
    });
    if (!comment) throw new NotFoundException('Comment not found');
    return comment;
  }

  private async ensureCommentExists(id: string) {
    const comment = await this.prisma.task_comments.findUnique({
      where: { id },
      select: { id: true, user_id: true },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    return comment;
  }

  private ensureOwnership(ownerId: string, user: JwtPayload) {
    if (ownerId !== user.sub && user.role !== role_enum.ADMIN && user.role !== role_enum.MD) {
      throw new ForbiddenException('Not authorized to modify this comment');
    }
  }

  private commentSelect() {
    return {
      id: true,
      user_id: true,
      content: true,
      task_id: true,
      parent_comment_id: true,
      is_tagged: true,
      created_at: true,
      updated_at: true,
      users: {
        select: {
          id: true,
          full_name: true,
          role: true,
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
      task_comment_replies: {
        select: {
          id: true,
          user_id: true,
          content: true,
          task_id: true,
          parent_comment_id: true,
          is_tagged: true,
          created_at: true,
          updated_at: true,
          users: {
            select: {
              id: true,
              full_name: true,
              role: true,
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

  private async mapTaskComment(comment: {
    id: string;
    user_id: string;
    content: string;
    task_id: string;
    parent_comment_id: string | null;
    is_tagged: boolean | null;
    created_at: Date;
    updated_at: Date;
    users: { id: string; full_name: string; role: role_enum } | null;
    task_attachments: any[];
    task_comment_replies?: any[];
  }): Promise<any> {
    const attachments = await this.attachmentsService.decorateTaskAttachments(comment.task_attachments);
    const replies: any[] = comment.task_comment_replies?.length
      ? await Promise.all(comment.task_comment_replies.map((reply) => this.mapTaskComment(reply)))
      : [];

    return {
      id: comment.id,
      userId: comment.user_id,
      taskId: comment.task_id,
      parentCommentId: comment.parent_comment_id,
      content: comment.content,
      isTagged: comment.is_tagged ?? false,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      attachments,
      replies,
      user: comment.users
        ? {
            id: comment.users.id,
            fullName: comment.users.full_name,
            role: comment.users.role,
          }
        : undefined,
    };
  }
}
