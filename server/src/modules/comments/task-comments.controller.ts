import { Body, Controller, Get, Param, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CommentsService } from './comments.service';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { UploadedFile } from '../../common/types/uploaded-file.type';

@Controller('tasks/:taskId/comments')
export class TaskCommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('attachments'))
  create(
    @Param('taskId') taskId: string,
    @Body() dto: CreateTaskCommentDto,
    @UploadedFiles() attachments: UploadedFile[],
    @CurrentUser() user: JwtPayload,
  ) {
    return this.commentsService.createForTask(taskId, dto, user, attachments ?? []);
  }

  @Get()
  findByTask(@Param('taskId') taskId: string, @CurrentUser() user: JwtPayload) {
    return this.commentsService.findByTask(taskId, user);
  }
}
