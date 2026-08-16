import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { RndController } from './rnd.controller';
import { RndService } from './rnd.service';

// Registered in app.module.ts by the Phase 2 spine so that feature work never
// has to touch that file. Exported because the projects module needs the
// membership check to scope `is_rnd` projects.
@Module({
  imports: [AuthModule, PrismaModule, NotificationsModule],
  controllers: [RndController],
  providers: [RndService],
  exports: [RndService],
})
export class RndModule {}
