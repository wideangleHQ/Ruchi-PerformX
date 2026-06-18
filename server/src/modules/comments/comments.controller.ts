import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { UploadedFile } from '../../common/types/uploaded-file.type';

@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('attachments'))
  create(
    @Body() dto: CreateCommentDto,
    @UploadedFiles() attachments: UploadedFile[],
    @CurrentUser() user: JwtPayload,
  ) {
    return this.commentsService.create(dto, user, attachments ?? []);
  }

  @Get('task/:taskId')
  findByTask(@Param('taskId') taskId: string, @CurrentUser() user: JwtPayload) {
    return this.commentsService.findByTask(taskId, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.commentsService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.commentsService.remove(id, user);
  }
}
