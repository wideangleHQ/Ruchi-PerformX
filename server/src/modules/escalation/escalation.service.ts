// src/modules/escalation/escalation.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { task_status_enum } from '@prisma/client';

@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async createNotification(payload: {
    userId: number | string;
    title: string;
    message: string;
  }): Promise<any> {
    return (this.notifications as any).create(payload);
  }

  async runEscalationCheck(): Promise<void> {
    const now = new Date();

    const overdueTasks = await this.prisma.tasks.findMany({
      where: {
        status: {
          notIn: [
            task_status_enum.COMPLETED,
            task_status_enum.CLOSED,
            task_status_enum.REJECTED,
          ],
        },
        dueDate: { lt: now },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        assignedToId: true,
        departmentId: true,
        assignedTo: {
          select: {
            id: true,
            departmentId: true,
          },
        },
        department: {
          select: {
            users: {
              where: { role: 'HOD', isActive: true },
              select: { id: true },
            },
          },
        },
      },
    });

    const mdUsers = await this.prisma.users.findMany({
      where: { role: 'MD', isActive: true },
      select: { id: true },
    });

    for (const task of overdueTasks) {
      const daysOverdue = Math.floor(
        (now.getTime() - new Date(task.dueDate).getTime()) /
          (1000 * 60 * 60 * 24),
      );

      if (daysOverdue >= 5) {
        for (const md of mdUsers) {
          await this.createNotification({
            userId: md.id,
            title: 'Critical Escalation',
            message: `Task "${task.title}" is ${daysOverdue} days overdue`,
          });
        }
        this.logger.warn(`MD escalation: Task ${task.id} — ${daysOverdue}d overdue`);
        continue;
      }

      if (daysOverdue >= 3) {
        const hodUsers = ((task.department as any)?.users ?? []) as Array<{ id: number | string }>;

        for (const hod of hodUsers) {
          await this.createNotification({
            userId: hod.id,
            title: 'HOD Escalation',
            message: `Task "${task.title}" is ${daysOverdue} days overdue`,
          });
        }
        this.logger.warn(`HOD escalation: Task ${task.id} — ${daysOverdue}d overdue`);
        continue;
      }

      if (daysOverdue >= 1) {
        await this.createNotification({
          userId: task.assignedToId,
          title: 'Task Overdue',
          message: `Your task "${task.title}" is ${daysOverdue} day(s) overdue`,
        });
        this.logger.warn(`Employee reminder: Task ${task.id} — ${daysOverdue}d overdue`);
      }
    }
  }
}