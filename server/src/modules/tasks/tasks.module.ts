import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { TaskLifecycleService } from './task-lifecycle.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AttachmentsModule } from '../attachments/attachments.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, AuthModule, AttachmentsModule, NotificationsModule],
  controllers: [TasksController],
  providers: [TasksService, TaskLifecycleService],
  exports: [TasksService],
})
export class TasksModule {}
