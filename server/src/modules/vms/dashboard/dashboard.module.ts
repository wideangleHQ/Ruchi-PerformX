import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../../prisma/prisma.module';
import { DashboardController } from './controllers/dashboard.controller';
import { DashboardServiceImpl } from './services/dashboard.service';
import { AuthModule } from '../../../modules/auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET!,
    }),
  ],
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
