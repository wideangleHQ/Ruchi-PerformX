import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';

// Registered in app.module.ts by the Phase 2 spine so that feature work never
// has to touch that file.
@Module({
  imports: [PrismaModule, NotificationsModule, AuthModule],
  controllers: [LeaveController],
  providers: [LeaveService],
  exports: [LeaveService],
})
export class LeaveModule {}
