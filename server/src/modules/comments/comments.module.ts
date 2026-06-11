import { Module } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { TaskCommentsController } from './task-comments.controller';

@Module({
  controllers: [CommentsController, TaskCommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
