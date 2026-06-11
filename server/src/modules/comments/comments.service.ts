import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { role_enum } from '@prisma/client';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCommentDto, user: JwtPayload) {
    return this.createForTask(dto.taskId, dto.content, user);
  }

  async createForTask(taskId: string, content: string, user: JwtPayload) {
    await this.ensureTaskExists(taskId);

    const comment = await this.prisma.task_comments.create({
      data: {
        content,
        task_id: taskId,
        user_id: user.sub,
      },
      select: this.commentSelect(),
    });

    return this.mapComment(comment);
  }

  async findByTask(taskId: string) {
    await this.ensureTaskExists(taskId);

    const comments = await this.prisma.task_comments.findMany({
      where: { task_id: taskId },
      select: this.commentSelect(),
      orderBy: { created_at: 'asc' },
    });

    return comments.map((comment) => this.mapComment(comment));
  }

  async update(id: string, dto: UpdateCommentDto, user: JwtPayload) {
    const comment = await this.ensureCommentExists(id);
    this.ensureOwnership(comment.user_id, user);

    const updated = await this.prisma.task_comments.update({
      where: { id },
      data: { content: dto.content },
      select: this.commentSelect(),
    });

    return this.mapComment(updated);
  }

  async remove(id: string, user: JwtPayload) {
    const comment = await this.ensureCommentExists(id);
    this.ensureOwnership(comment.user_id, user);

    await this.prisma.task_comments.delete({ where: { id } });
    return { message: 'Comment deleted successfully' };
  }

  private async ensureTaskExists(taskId: string) {
    const task = await this.prisma.tasks.findUnique({
      where: { id: taskId },
      select: { id: true },
    });
    if (!task) throw new NotFoundException('Task not found');
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
    if (ownerId !== user.sub && user.role !== role_enum.ADMIN) {
      throw new ForbiddenException('Not authorized to modify this comment');
    }
  }

  private commentSelect() {
    return {
      id: true,
      user_id: true,
      content: true,
      task_id: true,
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
    };
  }

  private mapComment(comment: {
    id: string;
    user_id: string;
    content: string;
    task_id: string;
    is_tagged: boolean | null;
    created_at: Date;
    updated_at: Date;
    users: { id: string; full_name: string; role: role_enum } | null;
  }) {
    return {
      id: comment.id,
      userId: comment.user_id,
      taskId: comment.task_id,
      content: comment.content,
      isTagged: comment.is_tagged ?? false,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
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
