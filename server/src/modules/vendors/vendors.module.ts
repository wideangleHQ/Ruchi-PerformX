import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { VendorsController } from './vendors.controller';
import { VendorsService } from './vendors.service';
import { VendorAccessController } from './vendor-access.controller';
import { VendorAccessService } from './vendor-access.service';
import { VendorScopeService } from './vendor-scope.service';
import { VendorWorkController } from './vendor-work.controller';
import { VendorWorkService } from './vendor-work.service';
import { VendorDeadlineCron } from './vendor-deadline.cron';

// Split by concern for the same reason as ProjectsModule. VendorScopeService
// is exported because the portal module is the only other caller and it is the
// single thing standing between an external login and the whole company's data.
@Module({
  imports: [AuthModule, PrismaModule, NotificationsModule],
  controllers: [VendorsController, VendorAccessController, VendorWorkController],
  providers: [
    VendorsService,
    VendorAccessService,
    VendorScopeService,
    VendorWorkService,
    VendorDeadlineCron,
  ],
  exports: [VendorScopeService, VendorsService],
})
export class VendorsModule {}
