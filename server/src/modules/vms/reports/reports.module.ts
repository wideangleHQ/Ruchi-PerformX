import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ReportController } from './controllers/report.controller';
import { ReportService } from './services/report.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuthModule } from '../../../modules/auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET!,
    }),
  ],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportsModule {}
