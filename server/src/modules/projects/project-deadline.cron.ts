import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Daily sweep over projects with a deadline. Reminds the Lead and Co-Lead as
 * the date approaches, escalates to the MD once it passes with no closure
 * report, and recomputes projects.health while it is already walking the rows.
 *
 * health is a stored, indexed column that the directory filters on, so it is
 * recomputed here rather than at read time, where the filter and the index
 * would be querying stale rows.
 */
@Injectable()
export class ProjectDeadlineCron {
  private readonly logger = new Logger(ProjectDeadlineCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async sweep(): Promise<void> {
    this.logger.log('Project deadline sweep starting');
  }
}
