// src/modules/escalation/escalation.module.ts

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EscalationService } from './escalation.service';
import { EscalationCron } from './escalation.cron';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    NotificationsModule,
  ],
  providers: [EscalationService, EscalationCron],
})
export class EscalationModule {}