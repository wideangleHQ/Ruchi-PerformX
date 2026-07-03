import { Module } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { TaskCommentsController } from './task-comments.controller';
import { AttachmentsModule } from '../attachments/attachments.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [AttachmentsModule, CommonModule],
  controllers: [CommentsController, TaskCommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
