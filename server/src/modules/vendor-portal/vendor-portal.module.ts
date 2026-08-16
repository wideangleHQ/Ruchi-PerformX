import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { VendorsModule } from '../vendors/vendors.module';
import { TaskLifecycleService } from '../tasks/task-lifecycle.service';

import { VendorPortalController } from './vendor-portal.controller';
import { VendorDeliverablesController } from './vendor-deliverables.controller';
import { VendorPortalService } from './vendor-portal.service';

// Registered in app.module.ts by the Phase 2 spine so that feature work never
// has to touch that file.
//
// VendorsModule is imported for VendorScopeService, which it exports and which
// is the only thing standing between an external login and the whole company's
// data. TaskLifecycleService is provided directly rather than exported from
// TasksModule: it holds no state and takes no constructor arguments, so a
// second instance is a second copy of a lookup table, and this way TasksModule
// stays untouched by the portal.
@Module({
  imports: [AuthModule, PrismaModule, NotificationsModule, VendorsModule],
  controllers: [VendorPortalController, VendorDeliverablesController],
  providers: [VendorPortalService, TaskLifecycleService],
  exports: [],
})
export class VendorPortalModule {}
