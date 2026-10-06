import { describe, it, expect, vi } from 'vitest';

import { ScoringService } from './scoring.service';

// saveMonthlyScores() used to run calculateEmployeeScore's 4 sequential
// queries, then re-run 2 of them again (completedTasks, selfActions) for the
// persisted columns, then a 3rd (overdueCount) — 7 sequential-ish reads plus
// 1 write per employee, in a single unbounded `for` loop across every active
// employee. These cover the replacement: the 4 score-math reads run in
// parallel via Promise.all, completedTasks/selfActions are computed once and
// shared between the score and the persisted columns, employees are
// processed in bounded batches, and — the one deliberately un-fixed
// mismatch — the persisted `overdue_tasks_count` stays a separate,
// differently-scoped query, not merged with the period-scoped one the score
// itself uses.

function buildService(userIds: string[]) {
  const prisma = {
    users: { findMany: vi.fn().mockResolvedValue(userIds.map((id) => ({ id }))) },
    tasks: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
    self_actions: { count: vi.fn().mockResolvedValue(0) },
    performance_scores: { upsert: vi.fn().mockResolvedValue({}) },
  };
  const service = new ScoringService(prisma as never);
  return { service, prisma };
}

describe('ScoringService.saveMonthlyScores', () => {
  it('computes completedTasks and selfActions once per employee, shared between the score and the persisted columns', async () => {
    const { service, prisma } = buildService(['u1']);
    await service.saveMonthlyScores(3, 2026);

    // 3 count queries per employee for the score math (completed, reviewed,
    // and — separately — the all-time overdue count for persistence) plus
    // one findMany for the period-scoped overdue detail. Two counts
    // (completedTasks, selfActions) are NOT run a second time for the
    // persisted columns, which is the fix.
    const completedTasksCalls = prisma.tasks.count.mock.calls.filter(
      (call) => (call[0] as { where: { completed_at?: unknown } }).where.completed_at,
    );
    expect(completedTasksCalls).toHaveLength(1);
    expect(prisma.self_actions.count).toHaveBeenCalledTimes(1);
  });

  it('writes exactly one performance_scores row per employee', async () => {
    const { service, prisma } = buildService(['u1', 'u2', 'u3']);
    await service.saveMonthlyScores(3, 2026);

    expect(prisma.performance_scores.upsert).toHaveBeenCalledTimes(3);
    const userIds = prisma.performance_scores.upsert.mock.calls.map(
      (call) => (call[0] as { where: { user_id_month_year: { user_id: string } } }).where.user_id_month_year.user_id,
    );
    expect(new Set(userIds)).toEqual(new Set(['u1', 'u2', 'u3']));
  });

  it('processes every employee even when there are more than one batch', async () => {
    const userIds = Array.from({ length: 23 }, (_, i) => `u${i}`);
    const { service, prisma } = buildService(userIds);

    await service.saveMonthlyScores(3, 2026);

    expect(prisma.performance_scores.upsert).toHaveBeenCalledTimes(23);
  });

  it('keeps the persisted overdue_tasks_count as a separate, all-time query — not the period-scoped one the score uses', async () => {
    const { service, prisma } = buildService(['u1']);
    await service.saveMonthlyScores(3, 2026);

    const overdueCountCall = prisma.tasks.count.mock.calls.find(
      (call) => (call[0] as { where: { status?: unknown } }).where.status,
    );
    expect(overdueCountCall).toBeDefined();
    const where = overdueCountCall![0] as { where: { due_date: { gte?: unknown; lt: unknown } } };
    expect(where.where.due_date.gte).toBeUndefined();
    expect(where.where.due_date.lt).toBeInstanceOf(Date);

    // The score-math overdue read (findMany, not count) is period-scoped.
    const overdueDetailCall = prisma.tasks.findMany.mock.calls[0]![0] as {
      where: { due_date: { gte: unknown } };
    };
    expect(overdueDetailCall.where.due_date.gte).toBeInstanceOf(Date);
  });

  it('preserves "one employee failing fails the whole job" — unchanged from before this phase', async () => {
    const { service, prisma } = buildService(['u1', 'u2']);
    prisma.performance_scores.upsert.mockRejectedValueOnce(new Error('constraint violation'));

    await expect(service.saveMonthlyScores(3, 2026)).rejects.toThrow('constraint violation');
  });

  it('calculateEmployeeScore still returns just the number, for any other caller', async () => {
    const { service, prisma } = buildService([]);
    prisma.tasks.count.mockResolvedValueOnce(2); // completed
    prisma.tasks.count.mockResolvedValueOnce(1); // reviewed

    const score = await service.calculateEmployeeScore('u1', 3, 2026);
    expect(typeof score).toBe('number');
    // 2 completed * 10 + 1 reviewed * 5 = 25
    expect(score).toBe(25);
  });
});
