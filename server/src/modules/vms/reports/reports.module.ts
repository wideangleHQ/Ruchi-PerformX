import { Module } from '@nestjs/common';
import { ReportController } from './controllers/report.controller';
import { ReportService } from './services/report.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuthModule } from '../../../modules/auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportsModule {}
