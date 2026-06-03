// src/modules/scoring/scoring.cron.ts

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ScoringService } from './scoring.service';

@Injectable()
export class ScoringCron {
  private readonly logger = new Logger(ScoringCron.name);

  constructor(private readonly scoringService: ScoringService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyScoreUpdate(): Promise<void> {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    this.logger.log(`Running daily score update for ${month}/${year}`);
    await this.scoringService.saveMonthlyScores(month, year);
    this.logger.log('Daily score update complete');
  }
}