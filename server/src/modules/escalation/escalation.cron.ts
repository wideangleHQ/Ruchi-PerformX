// src/modules/escalation/escalation.cron.ts

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EscalationService } from './escalation.service';

@Injectable()
export class EscalationCron {
  private readonly logger = new Logger(EscalationCron.name);

  constructor(private readonly escalationService: EscalationService) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleEscalationCheck(): Promise<void> {
    this.logger.log('Running daily escalation check...');
    await this.escalationService.runEscalationCheck();
    this.logger.log('Escalation check complete');
  }
}