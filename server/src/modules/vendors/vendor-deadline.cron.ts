import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  deliverable_status_enum,
  notification_type_enum,
  vendor_status_enum,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotifyInput } from '../notifications/notification-channels.constants';
import {
  EXPIRY_WINDOW_DAYS,
  daysUntil,
  documentExpiryStatus,
} from './vendor-work.service';

/**
 * Days out from a date that a reminder goes out, plus the day itself.
 *
 * The sweep runs daily and the window is thirty days, so notifying on every
 * run would send thirty emails per document and the recipients would filter
 * the sender inside a week. These are the useful ones.
 */
const REMINDER_DAYS = new Set(
  [30, 14, 7, 3, 1, 0].filter((days) => days <= EXPIRY_WINDOW_DAYS),
);

/** Statuses that still have someone waiting on them. */
const OPEN_DELIVERABLE_STATUSES: deliverable_status_enum[] = [
  deliverable_status_enum.PENDING,
  deliverable_status_enum.IN_PROGRESS,
  deliverable_status_enum.SUBMITTED,
  deliverable_status_enum.UNDER_REVIEW,
];

/**
 * Daily sweep for contract expiry, document expiry and deliverable due dates.
 * The same helper computes document status here and on read, so there is one
 * expiry calculator rather than two that disagree by a day.
 *
 * Every notification from this sweep goes to the internal owner and to vendor
 * management access holders. Never to the vendor: recipients are filtered
 * against `users.vendor_id`, so a portal login cannot receive one even if it
 * somehow held an access row.
 */
@Injectable()
export class VendorDeadlineCron {
  private readonly logger = new Logger(VendorDeadlineCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Walks every live vendor once a day.
   *
   * One vendor's failure is logged and skipped rather than aborting the sweep,
   * because the run is unattended and a single bad row must not cost every
   * other vendor its reminders. Throws nothing.
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async sweep(): Promise<void> {
    const today = new Date();

    const vendors = await this.prisma.vendors.findMany({
      where: {
        status: { in: [vendor_status_enum.ACTIVE, vendor_status_enum.ON_HOLD] },
      },
      select: {
        id: true,
        name: true,
        owner_id: true,
        secondary_owner_id: true,
      },
    });

    const access = await this.prisma.vendor_dashboard_access.findMany({
      select: { user_id: true },
    });
    const accessHolderIds = access.map((row) => row.user_id);

    let sent = 0;
    for (const vendor of vendors) {
      try {
        sent += await this.sweepVendor(vendor, accessHolderIds, today);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.error(`Vendor ${vendor.id} deadline sweep failed: ${reason}`);
      }
    }

    this.logger.log(
      `Vendor deadline sweep sent ${sent} notifications across ${vendors.length} vendors`,
    );
  }

  /** Builds and sends one vendor's reminders. Returns how many went out. */
  private async sweepVendor(
    vendor: {
      id: string;
      name: string;
      owner_id: string;
      secondary_owner_id: string | null;
    },
    accessHolderIds: string[],
    today: Date,
  ): Promise<number> {
    const [contracts, documents, deliverables] = await Promise.all([
      this.prisma.vendor_contracts.findMany({
        where: { vendor_id: vendor.id, status: 'ACTIVE' },
        select: { id: true, contract_number: true, end_date: true, renewal_date: true },
      }),
      this.prisma.vendor_documents.findMany({
        where: { vendor_id: vendor.id, expiry_date: { not: null } },
        select: { id: true, document_name: true, expiry_date: true },
      }),
      this.prisma.vendor_deliverables.findMany({
        where: {
          vendor_id: vendor.id,
          due_date: { not: null },
          status: { in: OPEN_DELIVERABLE_STATUSES },
        },
        select: { id: true, name: true, owner_id: true, due_date: true },
      }),
    ]);

    const managers = [vendor.owner_id, vendor.secondary_owner_id, ...accessHolderIds];
    const pending: { recipients: (string | null)[]; input: Omit<NotifyInput, 'recipientId'> }[] = [];

    for (const contract of contracts) {
      const expiry = this.dueToday(contract.end_date, today);
      if (expiry !== null) {
        pending.push({
          recipients: managers,
          input: {
            type: notification_type_enum.VENDOR_CONTRACT_EXPIRING,
            title: `Contract expiring: ${vendor.name}`,
            message: `Contract ${contract.contract_number} expires ${this.inDays(expiry)}.`,
            entityType: 'vendor',
            entityId: vendor.id,
          },
        });
      }

      const renewal = this.dueToday(contract.renewal_date, today);
      if (renewal !== null) {
        pending.push({
          recipients: managers,
          input: {
            type: notification_type_enum.VENDOR_CONTRACT_EXPIRING,
            title: `Contract renewal due: ${vendor.name}`,
            message: `Contract ${contract.contract_number} is up for renewal ${this.inDays(renewal)}.`,
            entityType: 'vendor',
            entityId: vendor.id,
          },
        });
      }
    }

    for (const document of documents) {
      // The read path and this sweep agree because they call the same function.
      if (documentExpiryStatus(document.expiry_date, today) !== 'EXPIRING_SOON') continue;
      const days = this.dueToday(document.expiry_date, today);
      if (days === null) continue;

      pending.push({
        recipients: managers,
        input: {
          type: notification_type_enum.VENDOR_DOCUMENT_EXPIRING,
          title: `Document expiring: ${vendor.name}`,
          message: `${document.document_name} expires ${this.inDays(days)}.`,
          entityType: 'vendor',
          entityId: vendor.id,
        },
      });
    }

    for (const deliverable of deliverables) {
      const days = this.dueToday(deliverable.due_date, today);
      if (days === null) continue;

      pending.push({
        recipients: [deliverable.owner_id],
        input: {
          type: notification_type_enum.VENDOR_DELIVERABLE_DUE,
          title: `Deliverable due: ${deliverable.name}`,
          message: `${deliverable.name} for ${vendor.name} is due ${this.inDays(days)}.`,
          entityType: 'vendor',
          entityId: vendor.id,
        },
      });
    }

    if (pending.length === 0) return 0;

    const internal = await this.internalRecipients(
      pending.flatMap((item) => item.recipients),
    );
    const inputs = pending.flatMap((item) =>
      [...new Set(item.recipients)]
        .filter((id): id is string => !!id && internal.has(id))
        .map((recipientId) => ({ recipientId, ...item.input })),
    );

    await this.notifications.notifyMany(inputs);
    return inputs.length;
  }

  /**
   * The candidate ids that belong to a live employee.
   *
   * `vendor_id: null` is the half that matters: a vendor deadline reminder
   * naming a contract or a document must never reach the vendor it is about,
   * and this is where that is enforced rather than assumed.
   */
  private async internalRecipients(ids: (string | null)[]): Promise<Set<string>> {
    const unique = [...new Set(ids.filter((id): id is string => !!id))];
    if (unique.length === 0) return new Set();

    const users = await this.prisma.users.findMany({
      where: { id: { in: unique }, vendor_id: null, deleted_at: null },
      select: { id: true },
    });
    return new Set(users.map((user) => user.id));
  }

  /** Days out, or null when today is not one of the reminder days for it. */
  private dueToday(date: Date | null, today: Date): number | null {
    if (!date) return null;
    const days = daysUntil(date, today);
    return REMINDER_DAYS.has(days) ? days : null;
  }

  private inDays(days: number): string {
    if (days === 0) return 'today';
    if (days === 1) return 'tomorrow';
    return `in ${days} days`;
  }
}
