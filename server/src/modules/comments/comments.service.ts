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
    await this.ensureTaskExists(dto.taskId);

    return this.prisma.task_comments.create({
      data: {
        content: dto.content,
        task_id: dto.taskId,
        user_id: user.sub,
      },
      select: this.commentSelect(),
    });
  }

  async findByTask(taskId: string) {
    await this.ensureTaskExists(taskId);

    return this.prisma.task_comments.findMany({
      where: { task_id: taskId },
      select: this.commentSelect(),
      orderBy: { created_at: 'asc' },
    });
  }

  async update(id: string, dto: UpdateCommentDto, user: JwtPayload) {
    const comment = await this.ensureCommentExists(id);
    this.ensureOwnership(comment.user_id, user);

    return this.prisma.task_comments.update({
      where: { id },
      data: { content: dto.content },
      select: this.commentSelect(),
    });
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
      content: true,
      task_id: true,
      created_at: true,
      updated_at: true,
      user: {
        select: {
          id: true,
          fullName: true,
          role: true,
        },
      },
    };
  }
}