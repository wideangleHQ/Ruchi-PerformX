import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ScoringService } from './scoring.service';
import { ScoringCron } from './scoring.cron';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [ScoringService, ScoringCron],
  exports: [ScoringService],
})
export class ScoringModule {}