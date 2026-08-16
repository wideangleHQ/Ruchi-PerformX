import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectExecutionController } from './project-execution.controller';
import { ProjectExecutionService } from './project-execution.service';
import { ProjectCollabController } from './project-collab.controller';
import { ProjectCollabService } from './project-collab.service';
import { ProjectClosureController } from './project-closure.controller';
import { ProjectClosureService } from './project-closure.service';
import { ProjectDeadlineCron } from './project-deadline.cron';

// Controllers and services are split by concern so that concurrent work on
// this module edits different files. Registered here up front for the same
// reason the Phase 2 spine registered the modules: this file is the one every
// projects branch would otherwise touch.
@Module({
  imports: [AuthModule, PrismaModule, NotificationsModule],
  controllers: [
    ProjectsController,
    ProjectExecutionController,
    ProjectCollabController,
    ProjectClosureController,
  ],
  providers: [
    ProjectsService,
    ProjectExecutionService,
    ProjectCollabService,
    ProjectClosureService,
    ProjectDeadlineCron,
  ],
  exports: [ProjectsService],
})
export class ProjectsModule {}
