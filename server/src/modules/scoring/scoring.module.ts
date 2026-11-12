import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ScheduleModule } from '@nestjs/schedule';
import { KpiModule } from '../kpi/kpi.module';
import { ScoringController } from './scoring.controller';
import { ScoringService } from './scoring.service';
import { ScoringCron } from './scoring.cron';

@Module({
  imports: [AuthModule, KpiModule, ScheduleModule.forRoot()],
  controllers: [ScoringController],
  providers: [ScoringService, ScoringCron],
  exports: [ScoringService],
})
export class ScoringModule {}