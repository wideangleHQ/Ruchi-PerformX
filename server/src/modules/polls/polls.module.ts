import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PollsController } from './polls.controller';
import { PollsService } from './polls.service';

// Registered in app.module.ts by the Phase 2 spine so that feature work never
// has to touch that file. DashboardModule imports this one to fold active polls
// into the single dashboard call.
@Module({
  imports: [AuthModule, PrismaModule, NotificationsModule],
  controllers: [PollsController],
  providers: [PollsService],
  exports: [PollsService],
})
export class PollsModule {}
