import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { task_status_enum, role_enum } from '@prisma/client';

@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

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
        due_date: { lt: now },
      },
      select: {
        id: true,
        title: true,
        due_date: true,
        assigned_to_id: true,
        department_id: true,
        departments: {
          select: {
            users: {
              where: { role: role_enum.HOD, is_active: true },
              select: { id: true },
            },
          },
        },
      },
    });

    const mdUsers = await this.prisma.users.findMany({
      where: { role: role_enum.MD, is_active: true },
      select: { id: true },
    });

    for (const task of overdueTasks) {
      const daysOverdue = Math.floor(
        (now.getTime() - new Date(task.due_date).getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysOverdue >= 5) {
        for (const md of mdUsers) {
          await this.notifications.createNotification({
            recipientId: md.id,
            type: 'ESCALATION_MD',
            title: 'Critical Escalation',
            message: `Task "${task.title}" is ${daysOverdue} days overdue`,
          });
        }
        this.logger.warn(`MD escalation: Task ${task.id} — ${daysOverdue}d overdue`);
        continue;
      }

      if (daysOverdue >= 3) {
        const hodUsers = task.departments?.users ?? [];

        for (const hod of hodUsers) {
          await this.notifications.createNotification({
            recipientId: hod.id,
            type: 'ESCALATION_HOD',
            title: 'HOD Escalation',
            message: `Task "${task.title}" is ${daysOverdue} days overdue`,
          });
        }
        this.logger.warn(`HOD escalation: Task ${task.id} — ${daysOverdue}d overdue`);
        continue;
      }

      if (daysOverdue >= 1 && task.assigned_to_id) {
        await this.notifications.createNotification({
          recipientId: task.assigned_to_id,
          type: 'TASK_OVERDUE',
          title: 'Task Overdue',
          message: `Your task "${task.title}" is ${daysOverdue} day(s) overdue`,
        });
        this.logger.warn(`Employee reminder: Task ${task.id} — ${daysOverdue}d overdue`);
      }
    }
  }
}