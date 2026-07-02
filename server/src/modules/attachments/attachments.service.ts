import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { role_enum, Prisma } from '@prisma/client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PDFDocument } from 'pdf-lib';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { UploadedFile } from '../../common/types/uploaded-file.type';

const ASSISTANT_ROLES: role_enum[] = [role_enum.EA, role_enum.PA, role_enum.DEPARTMENT_CONTROLLER];

type AttachmentRecord = Prisma.task_attachmentsGetPayload<{
  select: {
    id: true;
    task_id: true;
    request_id: true;
    comment_id: true;
    self_action_id: true;
    self_action_comment_id: true;
    file_name: true;
    file_url: true;
    storage_path: true;
    file_type: true;
    file_size_kb: true;
    uploaded_by_id: true;
    created_at: true;
  };
}>;

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const DOCUMENT_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'ppt', 'pptx']);

@Injectable()
export class AttachmentsService {
  private readonly supabase: SupabaseClient;
  private readonly bucket = process.env.SUPABASE_BUCKET || 'performx-files';
  private readonly maxImageSize = 10 * 1024 * 1024;
  private readonly maxDocumentSize = 25 * 1024 * 1024;

  constructor(private readonly prisma: PrismaService) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase environment variables are missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async uploadTaskAttachments(taskId: string, files: UploadedFile[], user: JwtPayload) {
    await this.ensureTaskVisible(taskId, user);
    return this.uploadFiles(files, {
      taskId,
      uploadedById: user.sub,
      folder: 'tasks/attachments',
      relation: 'task',
    });
  }

  async uploadRequestAttachments(requestId: string, files: UploadedFile[], user: JwtPayload) {
    await this.ensureRequestVisible(requestId, user);
    return this.uploadFiles(files, {
      requestId,
      uploadedById: user.sub,
      folder: 'requests/attachments',
      relation: 'request',
    });
  }

  async uploadTaskCommentAttachments(
    taskId: string,
    commentId: string,
    files: UploadedFile[],
    user: JwtPayload,
  ) {
    await this.ensureTaskCommentVisible(taskId, commentId, user);
    return this.uploadFiles(files, {
      taskId,
      commentId,
      uploadedById: user.sub,
      folder: 'tasks/comments',
      relation: 'taskComment',
    });
  }

  async uploadSelfActionAttachments(actionId: string, files: UploadedFile[], user: JwtPayload) {
    await this.ensureSelfActionVisible(actionId, user);
    return this.uploadFiles(files, {
      selfActionId: actionId,
      uploadedById: user.sub,
      folder: 'self-actions/attachments',
      relation: 'selfAction',
    });
  }

  async uploadSelfActionCommentAttachments(
    actionId: string,
    commentId: string,
    files: UploadedFile[],
    user: JwtPayload,
  ) {
    await this.ensureSelfActionCommentVisible(actionId, commentId, user);
    return this.uploadFiles(files, {
      selfActionId: actionId,
      selfActionCommentId: commentId,
      uploadedById: user.sub,
      folder: 'self-actions/comments',
      relation: 'selfActionComment',
    });
  }

  async findTaskAttachments(taskId: string, user: JwtPayload) {
    await this.ensureTaskVisible(taskId, user);
    const attachments = await this.prisma.task_attachments.findMany({
      where: { task_id: taskId },
      orderBy: { created_at: 'asc' },
      select: this.selectAttachment(),
    });
    return this.mapAttachments(attachments);
  }

  async findRequestAttachments(requestId: string, user: JwtPayload) {
    await this.ensureRequestVisible(requestId, user);
    const attachments = await this.prisma.task_attachments.findMany({
      where: { request_id: requestId },
      orderBy: { created_at: 'asc' },
      select: this.selectAttachment(),
    });
    return this.mapAttachments(attachments);
  }

  async findTaskCommentAttachments(taskId: string, commentId: string, user: JwtPayload) {
    await this.ensureTaskCommentVisible(taskId, commentId, user);
    const attachments = await this.prisma.task_attachments.findMany({
      where: { comment_id: commentId },
      orderBy: { created_at: 'asc' },
      select: this.selectAttachment(),
    });
    return this.mapAttachments(attachments);
  }

  async findSelfActionAttachments(actionId: string, user: JwtPayload) {
    await this.ensureSelfActionVisible(actionId, user);
    const attachments = await this.prisma.task_attachments.findMany({
      where: { self_action_id: actionId },
      orderBy: { created_at: 'asc' },
      select: this.selectAttachment(),
    });
    return this.mapAttachments(attachments);
  }

  async findSelfActionCommentAttachments(actionId: string, commentId: string, user: JwtPayload) {
    await this.ensureSelfActionCommentVisible(actionId, commentId, user);
    const attachments = await this.prisma.task_attachments.findMany({
      where: { self_action_comment_id: commentId },
      orderBy: { created_at: 'asc' },
      select: this.selectAttachment(),
    });
    return this.mapAttachments(attachments);
  }

  async decorateTaskAttachments(attachments: AttachmentRecord[] | undefined | null) {
    return this.mapAttachments(attachments ?? []);
  }

  async remove(id: string, user: JwtPayload) {
    const attachment = await this.prisma.task_attachments.findUnique({
      where: { id },
      select: this.selectAttachment(),
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    if (attachment.uploaded_by_id !== user.sub && user.role !== role_enum.ADMIN && user.role !== role_enum.MD) {
      throw new ForbiddenException('Not authorized to delete this attachment');
    }

    const storagePath = attachment.storage_path || this.resolveStoragePath(attachment.file_url);
    if (storagePath) {
      await this.supabase.storage.from(this.bucket).remove([storagePath]);
    }

    await this.prisma.task_attachments.delete({ where: { id } });
    return { message: 'Attachment deleted successfully' };
  }

  private async uploadFiles(
    files: UploadedFile[],
    target: {
      folder: string;
      uploadedById: string;
      taskId?: string;
      requestId?: string;
      commentId?: string;
      selfActionId?: string;
      selfActionCommentId?: string;
      relation: 'task' | 'request' | 'taskComment' | 'selfAction' | 'selfActionComment';
    },
  ) {
    if (!files?.length) {
      return [];
    }

    // DEBUG: remove after diagnosing
    console.log('UPLOAD DEBUG target=', target);
    console.log(
      'UPLOAD DEBUG files=',
      files.map((f) => ({
        originalname: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
        hasBuffer: !!f.buffer,
        bufferLen: f.buffer?.length,
      })),
    );

    const createdIds: string[] = [];
    const uploadedPaths: string[] = [];

    try {
      const results = [];

      for (const file of files) {
        const prepared = await this.prepareFile(file);
        const contextId = target.selfActionCommentId || target.commentId || target.taskId || target.requestId || target.selfActionId;

        if (!contextId) {
          throw new BadRequestException(
            `Storage path cannot be built: missing context ID (folder=${target.folder}). ` +
            `selfActionCommentId=${target.selfActionCommentId} commentId=${target.commentId} ` +
            `taskId=${target.taskId} requestId=${target.requestId} selfActionId=${target.selfActionId}`,
          );
        }

        const storagePath = `${target.folder}/${contextId}/${Date.now()}-${randomUUID()}-${prepared.safeName}`;

        // DEBUG: remove after diagnosing
        console.log('UPLOAD DEBUG storagePath=', storagePath, 'contextId=', contextId, 'safeName=', prepared.safeName);

        const uploadResult = await this.supabase.storage.from(this.bucket).upload(storagePath, prepared.buffer, {
          contentType: prepared.mimetype,
          upsert: false,
        });

        if (uploadResult.error) {
          // DEBUG: remove after diagnosing
          console.log('UPLOAD DEBUG supabase error=', uploadResult.error);
          throw new BadRequestException(uploadResult.error.message);
        }
        uploadedPaths.push(storagePath);

        const signedUrl = await this.createSignedUrl(storagePath);
        const created = await this.prisma.task_attachments.create({
          data: {
            task_id: target.taskId ?? null,
            request_id: target.requestId ?? null,
            comment_id: target.commentId ?? null,
            self_action_id: target.selfActionId ?? null,
            self_action_comment_id: target.selfActionCommentId ?? null,
            file_name: prepared.fileName,
            file_url: signedUrl,
            storage_path: storagePath,
            file_type: prepared.mimetype,
            file_size_kb: Math.ceil(prepared.buffer.length / 1024),
            uploaded_by_id: target.uploadedById,
          },
          select: this.selectAttachment(),
        });

        createdIds.push(created.id);
        results.push(await this.mapAttachment(created));
      }

      return results;
    } catch (error) {
      // DEBUG: remove after diagnosing
      console.log('UPLOAD DEBUG caught error=', error);
      if (createdIds.length) {
        await this.prisma.task_attachments.deleteMany({ where: { id: { in: createdIds } } });
      }
      if (uploadedPaths.length) {
        await this.supabase.storage.from(this.bucket).remove(uploadedPaths);
      }
      throw error;
    }
  }

  private async prepareFile(file: UploadedFile) {
    this.validateFile(file);

    if (file.mimetype === 'application/pdf') {
      try {
        const pdf = await PDFDocument.load(file.buffer);
        const optimized = await pdf.save({ useObjectStreams: true });
        return {
          buffer: Buffer.from(optimized),
          fileName: file.originalname,
          mimetype: file.mimetype,
          safeName: this.safeName(file.originalname),
        };
      } catch {
        return {
          buffer: file.buffer,
          fileName: file.originalname,
          mimetype: file.mimetype,
          safeName: this.safeName(file.originalname),
        };
      }
    }

    return {
      buffer: file.buffer,
      fileName: file.originalname,
      mimetype: file.mimetype,
      safeName: this.safeName(file.originalname),
    };
  }

  private validateFile(file: UploadedFile) {
    const extension = this.extensionOf(file.originalname);
    const size = file.size;

    if (IMAGE_MIME_TYPES.has(file.mimetype)) {
      if (!IMAGE_EXTENSIONS.has(extension)) {
        throw new BadRequestException('Invalid image extension');
      }
      if (size > this.maxImageSize) {
        throw new BadRequestException('Image size exceeds 10 MB limit');
      }
      return;
    }

    if (DOCUMENT_MIME_TYPES.has(file.mimetype)) {
      if (!DOCUMENT_EXTENSIONS.has(extension)) {
        throw new BadRequestException('Invalid document extension');
      }
      if (size > this.maxDocumentSize) {
        throw new BadRequestException('Document size exceeds 25 MB limit');
      }
      return;
    }

    throw new BadRequestException('Unsupported file type');
  }

  private async createSignedUrl(storagePath: string) {
    const { data, error } = await this.supabase.storage.from(this.bucket).createSignedUrl(storagePath, 60 * 60);
    if (error || !data?.signedUrl) {
      throw new BadRequestException(error?.message || 'Unable to create signed url');
    }
    return data.signedUrl;
  }

  private async mapAttachments(attachments: AttachmentRecord[]) {
    const mapped = [];

    for (const attachment of attachments) {
      mapped.push(await this.mapAttachment(attachment));
    }

    return mapped;
  }

  private async mapAttachment(attachment: AttachmentRecord) {
    let fileUrl = attachment.file_url;

    if (attachment.storage_path) {
      // Normalize: if storage_path is a full URL, extract the relative path
      const relativePath = this.isAbsoluteUrl(attachment.storage_path)
        ? (this.resolveStoragePath(attachment.storage_path) ?? null)
        : attachment.storage_path;

      if (relativePath) {
        try {
          fileUrl = await this.createSignedUrl(relativePath);
        } catch {
          // Fall back to stored URL — avoids crashing list endpoints on bad paths
          fileUrl = attachment.file_url;
        }
      }
    }

    return {
      id: attachment.id,
      file_name: attachment.file_name,
      file_url: fileUrl,
      storage_path: attachment.storage_path,
      file_type: attachment.file_type,
      file_size_kb: attachment.file_size_kb,
      uploaded_by_id: attachment.uploaded_by_id,
      task_id: attachment.task_id,
      request_id: attachment.request_id,
      comment_id: attachment.comment_id,
      self_action_id: attachment.self_action_id,
      self_action_comment_id: attachment.self_action_comment_id,
      created_at: attachment.created_at,
    };
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

    const departmentIds = this.taskDepartmentIds(task);
    if (user.role === role_enum.EMPLOYEE && user.departmentId && departmentIds.includes(user.departmentId)) return;
    if ((user.role === role_enum.HOD || ASSISTANT_ROLES.includes(user.role)) && this.hasOverlap(departmentIds, user.departmentIds || [])) return;

    throw new ForbiddenException('Access denied to this task');
  }

  private async ensureRequestVisible(requestId: string, user: JwtPayload) {
    const request = await this.prisma.task_requests.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        requested_by_id: true,
        department_id: true,
        users_task_requests_requested_by_idTousers: { select: { department_id: true } },
      },
    });

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    if (user.role === role_enum.MD || user.role === role_enum.ADMIN) return;
    if (request.requested_by_id === user.sub) return;

    const departmentId = request.department_id ?? request.users_task_requests_requested_by_idTousers?.department_id;
    if (!departmentId) {
      throw new ForbiddenException('Access denied to this request');
    }

    const departmentIds = user.departmentIds?.length ? user.departmentIds : user.departmentId ? [user.departmentId] : [];
    if ((user.role === role_enum.HOD || ASSISTANT_ROLES.includes(user.role) || user.role === role_enum.PURCHASE_HEAD) && departmentIds.includes(departmentId)) {
      return;
    }

    throw new ForbiddenException('Access denied to this request');
  }

  private async ensureTaskCommentVisible(taskId: string, commentId: string, user: JwtPayload) {
    await this.ensureTaskVisible(taskId, user);
    const comment = await this.prisma.task_comments.findFirst({
      where: { id: commentId, task_id: taskId },
      select: { id: true },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
  }

  private async ensureSelfActionVisible(actionId: string, user: JwtPayload) {
    const action = await this.prisma.self_actions.findUnique({
      where: { id: actionId },
      select: {
        id: true,
        created_by_id: true,
        department_id: true,
      },
    });

    if (!action) {
      throw new NotFoundException('Self action not found');
    }

    if (user.role === role_enum.MD || user.role === role_enum.ADMIN || ASSISTANT_ROLES.includes(user.role)) return;
    if (action.created_by_id === user.sub) return;
    if (user.role === role_enum.HOD && user.departmentIds?.includes(action.department_id)) return;
    if (user.role === role_enum.EMPLOYEE && user.departmentId === action.department_id) return;

    throw new ForbiddenException('Access denied to this self action');
  }

  private async ensureSelfActionCommentVisible(actionId: string, commentId: string, user: JwtPayload) {
    await this.ensureSelfActionVisible(actionId, user);
    const comment = await this.prisma.self_action_comments.findFirst({
      where: { id: commentId, self_action_id: actionId },
      select: { id: true },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
  }

  private taskDepartmentIds(task: { department_id: string; task_departments: { department_id: string }[] }) {
    return [...new Set([task.department_id, ...task.task_departments.map((item) => item.department_id)].filter(Boolean))];
  }

  private hasOverlap(source: string[], target: string[]) {
    return source.some((item) => target.includes(item));
  }

  private selectAttachment() {
    return {
      id: true,
      task_id: true,
      request_id: true,
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
    };
  }

  private extensionOf(fileName: string) {
    const parts = fileName.toLowerCase().split('.');
    return parts.length > 1 ? parts.pop() || '' : '';
  }

  private safeName(fileName: string) {
    return fileName.replace(/[^a-zA-Z0-9._-]+/g, '_');
  }

  private resolveStoragePath(fileUrl: string) {
    try {
      const url = new URL(fileUrl);
      const marker = `/${this.bucket}/`;
      const index = url.pathname.indexOf(marker);
      if (index >= 0) {
        return url.pathname.slice(index + marker.length);
      }
    } catch {
      return null;
    }
    return null;
  }

  private isAbsoluteUrl(value: string) {
    return value.startsWith('http://') || value.startsWith('https://');
  }
}
