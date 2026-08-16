import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InternalApiGuard } from '../../common/gaurds/internal-api.guard';
import { InternalEmployeesController } from './internal-employees.controller';
import { InternalEmployeesService } from './internal-employees.service';

// Registered in app.module.ts by the Phase 2 spine so that feature work never
// has to touch that file. Add this module's controller and service here.
@Module({
  imports: [AuthModule, ConfigModule, PrismaModule, NotificationsModule],
  controllers: [InternalEmployeesController],
  providers: [InternalEmployeesService, InternalApiGuard],
  exports: [InternalEmployeesService],
})
export class InternalModule {}
