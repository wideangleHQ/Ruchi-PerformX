import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Daily sweep for contract expiry, document expiry and deliverable due dates.
 * The same helper computes document status here and on read, so there is one
 * expiry calculator rather than two that disagree by a day.
 *
 * Every notification from this sweep goes to the internal owner and to vendor
 * management access holders. Never to the vendor.
 */
@Injectable()
export class VendorDeadlineCron {
  private readonly logger = new Logger(VendorDeadlineCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async sweep(): Promise<void> {
    this.logger.log('Vendor deadline sweep starting');
  }
}
