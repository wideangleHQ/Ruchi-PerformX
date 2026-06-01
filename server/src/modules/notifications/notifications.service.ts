import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

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