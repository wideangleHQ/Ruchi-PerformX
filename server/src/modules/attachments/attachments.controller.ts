import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AttachmentsService } from './attachments.service';
import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { UploadedFile } from '../../common/types/uploaded-file.type';

@UseGuards(JwtAuthGuard)
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post('upload/:taskId')
  @UseInterceptors(FilesInterceptor('attachments'))
  uploadTask(
    @Param('taskId') taskId: string,
    @UploadedFiles() files: UploadedFile[],
    @CurrentUser() user: JwtPayload,
  ) {
    return this.attachmentsService.uploadTaskAttachments(taskId, files ?? [], user);
  }

  @Post('upload/:taskId/comments/:commentId')
  @UseInterceptors(FilesInterceptor('attachments'))
  uploadTaskComment(
    @Param('taskId') taskId: string,
    @Param('commentId') commentId: string,
    @UploadedFiles() files: UploadedFile[],
    @CurrentUser() user: JwtPayload,
  ) {
    return this.attachmentsService.uploadTaskCommentAttachments(taskId, commentId, files ?? [], user);
  }

  @Post('upload/self-actions/:actionId')
  @UseInterceptors(FilesInterceptor('attachments'))
  uploadSelfAction(
    @Param('actionId') actionId: string,
    @UploadedFiles() files: UploadedFile[],
    @CurrentUser() user: JwtPayload,
  ) {
    return this.attachmentsService.uploadSelfActionAttachments(actionId, files ?? [], user);
  }

  @Post('upload/self-actions/:actionId/comments/:commentId')
  @UseInterceptors(FilesInterceptor('attachments'))
  uploadSelfActionComment(
    @Param('actionId') actionId: string,
    @Param('commentId') commentId: string,
    @UploadedFiles() files: UploadedFile[],
    @CurrentUser() user: JwtPayload,
  ) {
    return this.attachmentsService.uploadSelfActionCommentAttachments(actionId, commentId, files ?? [], user);
  }

  @Get('task/:taskId')
  findTask(
    @Param('taskId') taskId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.attachmentsService.findTaskAttachments(taskId, user);
  }

  @Get('task/:taskId/comments/:commentId')
  findTaskComment(
    @Param('taskId') taskId: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.attachmentsService.findTaskCommentAttachments(taskId, commentId, user);
  }

  @Get('self-actions/:actionId')
  findSelfAction(
    @Param('actionId') actionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.attachmentsService.findSelfActionAttachments(actionId, user);
  }

  @Get('self-actions/:actionId/comments/:commentId')
  findSelfActionComment(
    @Param('actionId') actionId: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.attachmentsService.findSelfActionCommentAttachments(actionId, commentId, user);
  }

  @Delete(':id')
  removeAttachment(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.attachmentsService.remove(id, user);
  }
}
