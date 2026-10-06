import { describe, it, expect, vi } from 'vitest';
import { task_status_enum } from '@prisma/client';

import { EscalationService } from './escalation.service';

// The sweep used to call notifications.createNotification() once per
// recipient per task, sequentially. This checks it now collects every
// recipient across every overdue task and calls notifyMany() exactly once,
// with the same recipients, types, titles and messages the old loop sent —
// notifyMany() is also what restores the EMAIL channel already configured
// for ESCALATION_MD/HOD in notification-channels.constants.ts, which
// createNotification never dispatched.

function buildService(overdueTasks: unknown[], mdUsers: { id: string }[]) {
  const prisma = {
    tasks: { findMany: vi.fn().mockResolvedValue(overdueTasks) },
    users: { findMany: vi.fn().mockResolvedValue(mdUsers) },
  };
  const notifications = { notifyMany: vi.fn().mockResolvedValue([]) };
  const service = new EscalationService(prisma as never, notifications as never);
  return { service, prisma, notifications };
}

const dayMs = 1000 * 60 * 60 * 24;

describe('EscalationService.runEscalationCheck', () => {
  it('batches every recipient across every task into one notifyMany() call', async () => {
    const now = Date.now();
    const overdueTasks = [
      {
        id: 'task-employee',
        title: 'Reminder task',
        due_date: new Date(now - 2 * dayMs),
        assigned_to_id: 'emp-1',
        department_id: 'dept-a',
        departments: { users: [] },
      },
      {
        id: 'task-hod',
        title: 'HOD task',
        due_date: new Date(now - 3 * dayMs),
        assigned_to_id: 'emp-2',
        department_id: 'dept-a',
        departments: { users: [{ id: 'hod-1' }, { id: 'hod-2' }] },
      },
      {
        id: 'task-md',
        title: 'Critical task',
        due_date: new Date(now - 6 * dayMs),
        assigned_to_id: 'emp-3',
        department_id: 'dept-b',
        departments: { users: [{ id: 'hod-3' }] },
      },
    ];
    const mdUsers = [{ id: 'md-1' }];

    const { service, notifications } = buildService(overdueTasks, mdUsers);
    await service.runEscalationCheck();

    expect(notifications.notifyMany).toHaveBeenCalledTimes(1);
    const sent = notifications.notifyMany.mock.calls[0]?.[0] as {
      recipientId: string;
      type: string;
    }[];

    expect(sent).toHaveLength(4);
    expect(sent).toContainEqual(expect.objectContaining({ recipientId: 'emp-1', type: 'TASK_OVERDUE' }));
    expect(sent).toContainEqual(expect.objectContaining({ recipientId: 'hod-1', type: 'ESCALATION_HOD' }));
    expect(sent).toContainEqual(expect.objectContaining({ recipientId: 'hod-2', type: 'ESCALATION_HOD' }));
    expect(sent).toContainEqual(expect.objectContaining({ recipientId: 'md-1', type: 'ESCALATION_MD' }));
    // A task 5+ days overdue notifies the MD only, per the exclusive `continue`
    // branches this preserves unchanged: hod-3 must not appear.
    expect(sent.some((n) => n.recipientId === 'hod-3')).toBe(false);
  });

  it('still calls notifyMany once with an empty list when nothing is overdue', async () => {
    const { service, notifications } = buildService([], []);
    await service.runEscalationCheck();

    expect(notifications.notifyMany).toHaveBeenCalledTimes(1);
    expect(notifications.notifyMany).toHaveBeenCalledWith([]);
  });

  it('queries only tasks that are overdue and not in a terminal status', async () => {
    const { service, prisma } = buildService([], []);
    await service.runEscalationCheck();

    const where = (prisma.tasks.findMany.mock.calls[0]?.[0] as { where: { status: { notIn: string[] } } }).where;
    expect(where.status.notIn).toEqual(
      expect.arrayContaining([
        task_status_enum.COMPLETED,
        task_status_enum.REVIEWED,
        task_status_enum.CLOSED,
        task_status_enum.REJECTED,
      ]),
    );
  });

  it('excludes soft-deleted tasks — Phase 4 fix, this query used to be the one exception', async () => {
    const { service, prisma } = buildService([], []);
    await service.runEscalationCheck();

    const where = prisma.tasks.findMany.mock.calls[0]?.[0] as { where: { deleted_at: unknown } };
    expect(where.where.deleted_at).toBeNull();
  });
});
