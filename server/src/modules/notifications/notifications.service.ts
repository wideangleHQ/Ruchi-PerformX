import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationsGateway } from './notifications.gateway';
import {
  NOTIFICATION_CHANNELS,
  NotifyInput,
} from './notification-channels.constants';
import { EmailService } from '../email/email.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
    private readonly email: EmailService,
  ) {}

  /**
   * The entry point every Phase 2 module uses.
   *
   * Writes the row, pushes it over the socket, then dispatches any non-IN_APP
   * channel the type asks for. The in-app notification is the source of truth
   * and email is best effort: a send that fails is logged and swallowed, never
   * rolled back, because a user whose email bounced still needs the bell.
   *
   * Throws nothing on a delivery failure. Throws whatever Prisma throws if the
   * row cannot be written, which is the only part callers should care about.
   */
  async notify(input: NotifyInput) {
    const row = await this.prisma.notifications.create({
      data: {
        user_id: input.recipientId,
        type: input.type,
        title: input.title,
        message: input.message,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });

    this.gateway.notifyUser(input.recipientId, row);

    const channels =
      input.channels ?? NOTIFICATION_CHANNELS[input.type] ?? ['IN_APP'];
    if (channels.includes('EMAIL')) {
      void this.dispatchEmail(row.id, input).catch((err: Error) =>
        this.logger.error(
          `Email failed for notification ${row.id}: ${err.message}`,
        ),
      );
    }

    return row;
  }

  /**
   * Bulk path for crons. The escalation sweep and the project deadline sweep
   * both notify a list, and awaiting notify() per row turns a few hundred
   * overdue tasks into a few hundred sequential round trips.
   *
   * Returns the created rows. Email dispatch is fire and forget, same as notify().
   */
  async notifyMany(inputs: NotifyInput[]) {
    if (inputs.length === 0) return [];

    const rows = await this.prisma.notifications.createManyAndReturn({
      data: inputs.map((i) => ({
        user_id: i.recipientId,
        type: i.type,
        title: i.title,
        message: i.message,
        entity_type: i.entityType ?? null,
        entity_id: i.entityId ?? null,
        metadata: i.metadata ? JSON.stringify(i.metadata) : null,
      })),
    });

    rows.forEach((row) => this.gateway.notifyUser(row.user_id, row));

    inputs.forEach((input, i) => {
      const channels =
        input.channels ?? NOTIFICATION_CHANNELS[input.type] ?? ['IN_APP'];
      if (!channels.includes('EMAIL')) return;
      const row = rows[i];
      if (!row) return;
      void this.dispatchEmail(row.id, input).catch((err: Error) =>
        this.logger.error(
          `Email failed for notification ${row.id}: ${err.message}`,
        ),
      );
    });

    return rows;
  }

  /**
   * Resolves the recipient's address and hands off to EmailService.
   *
   * ponytail: one generic template. Per-type templates are worth building when
   * somebody complains about the wording, not before. The rejection and
   * cancellation bodies already carry their remark because the caller puts it
   * in `message`, which is the part that actually mattered.
   */
  private async dispatchEmail(notificationId: string, input: NotifyInput) {
    const user = await this.prisma.users.findUnique({
      where: { id: input.recipientId },
      select: { email: true, full_name: true },
    });
    if (!user?.email) {
      this.logger.warn(
        `Notification ${notificationId} wanted email but the recipient has none`,
      );
      return;
    }

    await this.email.sendNotificationEmail(
      user.email,
      user.full_name,
      input.title,
      input.message,
    );

    await this.prisma.notifications.update({
      where: { id: notificationId },
      data: { channel: 'EMAIL', delivered_at: new Date() },
    });
  }

  /** Mark every unread notification for this user as read. */
  async markAllRead(userId: string) {
    const result = await this.prisma.notifications.updateMany({
      where: { user_id: userId, is_read: false },
      data: { is_read: true },
    });
    return { updated: result.count };
  }

  /**
   * Create Notification
   */
  async createNotification(dto: CreateNotificationDto) {
    return this.prisma.notifications.create({
      data: {
        title: dto.title,
        message: dto.message,
        user_id: dto.recipientId,
        type: dto.type || 'TASK_ASSIGNED',
      },
    });
  }

  /**
   * Get User Notifications
   */
  async getUserNotifications(
    recipientId: string,
    page = 1,
    limit = 20,
  ) {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.prisma.notifications.findMany({
        where: {
          user_id: recipientId,
        },
        orderBy: {
          created_at: 'desc',
        },
        skip,
        take: limit,
      }),

      this.prisma.notifications.count({
        where: {
          user_id: recipientId,
        },
      }),
    ]);

    return {
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Mark Notification As Read
   */
  async markAsRead(
    notificationId: string,
    recipientId: string,
  ) {
    const notification =
      await this.prisma.notifications.findUnique({
        where: {
          id: notificationId,
        },
      });

    if (!notification) {
      throw new NotFoundException(
        'Notification not found',
      );
    }

    if (notification.user_id !== recipientId) {
      throw new ForbiddenException(
        'You are not allowed to access this notification',
      );
    }

    return this.prisma.notifications.update({
      where: {
        id: notificationId,
      },
      data: {
        is_read: true,
      },
    });
  }

  /**
   * Get Unread Count
   */
  async getUnreadCount(recipientId: string) {
    const count = await this.prisma.notifications.count({
      where: {
        user_id: recipientId,
        is_read: false,
      },
    });

    return {
      unreadCount: count,
    };
  }

  /**
   * Delete Notification
   */
  async deleteNotification(
    notificationId: string,
    recipientId: string,
  ) {
    const notification =
      await this.prisma.notifications.findUnique({
        where: {
          id: notificationId,
        },
      });

    if (!notification) {
      throw new NotFoundException(
        'Notification not found',
      );
    }

    if (notification.user_id !== recipientId) {
      throw new ForbiddenException(
        'You are not allowed to delete this notification',
      );
    }

    await this.prisma.notifications.delete({
      where: {
        id: notificationId,
      },
    });

    return {
      message: 'Notification deleted successfully',
    };
  }
}