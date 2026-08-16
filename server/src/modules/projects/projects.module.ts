import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

// Registered in app.module.ts by the Phase 2 spine so that feature work never
// has to touch that file. Add this module's controller and service here.
@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [],
  providers: [],
  exports: [],
})
export class ProjectsModule {}
