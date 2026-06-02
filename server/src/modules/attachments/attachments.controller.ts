import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';

import { AttachmentsService } from './attachments.service';

import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

import { JwtPayload } from '../../common/types/jwt-payload.type';
import { Multer } from 'multer';


@UseGuards(JwtAuthGuard)
@Controller('attachments')
export class AttachmentsController {
  constructor(
    private readonly attachmentsService: AttachmentsService,
  ) {}

  @Post('upload/:taskId')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('taskId') taskId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.attachmentsService.upload(
      taskId,
      file,
      user,
    );
  }

  @Get('task/:taskId')
  getTaskAttachments(
    @Param('taskId') taskId: string,
  ) {
    return this.attachmentsService.findByTask(taskId);
  }

  @Delete(':id')
  deleteAttachment(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.attachmentsService.remove(
      id,
      user,
    );
  }
}