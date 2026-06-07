import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { role_enum } from '@prisma/client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class AttachmentsService {
  private readonly supabase: SupabaseClient;
  private readonly bucket = 'task-attachments';
  private readonly MAX_FILE_SIZE_KB = 5120;
  private readonly ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];

  constructor(private readonly prisma: PrismaService) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase environment variables are missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async upload(taskId: string, file: Express.Multer.File, user: JwtPayload) {
    await this.ensureTaskExists(taskId);
    this.validateFile(file);

    const fileSizeKb = Math.ceil(file.size / 1024);
    const ext = file.originalname.split('.').pop();
    const storagePath = `tasks/${taskId}/${Date.now()}-${user.sub}.${ext}`;

    const { error } = await this.supabase.storage
      .from(this.bucket)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) throw new BadRequestException(`Upload failed: ${error.message}`);

    const { data: urlData } = this.supabase.storage
      .from(this.bucket)
      .getPublicUrl(storagePath);

    return this.prisma.task_attachments.create({
      data: {
        task_id: taskId,
        file_name: file.originalname,
        file_url: urlData.publicUrl,
        file_type: file.mimetype,
        file_size_kb: fileSizeKb,
        uploaded_by_id: user.sub,
      },
      select: {
        id: true,
        file_name: true,
        file_url: true,
        file_type: true,
        file_size_kb: true,
        created_at: true,
      },
    });
  }

  async findByTask(taskId: string) {
    await this.ensureTaskExists(taskId);

    return this.prisma.task_attachments.findMany({
      where: { task_id: taskId },
      select: {
        id: true,
        file_name: true,
        file_url: true,
        file_type: true,
        file_size_kb: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async remove(id: string, user: JwtPayload) {
    const attachment = await this.prisma.task_attachments.findUnique({
      where: { id },
      select: { id: true, uploaded_by_id: true, file_url: true },
    });

    if (!attachment) throw new NotFoundException('Attachment not found');

    if (attachment.uploaded_by_id !== user.sub && user.role !== role_enum.ADMIN) {
      throw new ForbiddenException('Not authorized to delete this attachment');
    }

    const url = new URL(attachment.file_url);
    const storagePath = url.pathname.split(`/${this.bucket}/`)[1];

    if (storagePath) {
      await this.supabase.storage.from(this.bucket).remove([storagePath]);
    }

    await this.prisma.task_attachments.delete({ where: { id } });
    return { message: 'Attachment deleted successfully' };
  }

  private async ensureTaskExists(taskId: string) {
    const task = await this.prisma.tasks.findUnique({
      where: { id: taskId },
      select: { id: true },
    });
    if (!task) throw new NotFoundException('Task not found');
  }

  private validateFile(file: Express.Multer.File) {
    const fileSizeKb = Math.ceil(file.size / 1024);

    if (fileSizeKb > this.MAX_FILE_SIZE_KB) {
      throw new BadRequestException('File size exceeds 5MB limit');
    }

    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('File type not allowed');
    }
  }
}