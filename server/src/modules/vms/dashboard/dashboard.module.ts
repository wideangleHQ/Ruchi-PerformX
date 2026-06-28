import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { DashboardController } from './controllers/dashboard.controller';
import { DashboardServiceImpl } from './services/dashboard.service';
import { AuthModule } from '../../../modules/auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [DashboardController],
  providers: [
    {
      provide: 'DashboardService',
      useClass: DashboardServiceImpl,
    },
  ],
  exports: ['DashboardService'],
})
export class DashboardModule {}
