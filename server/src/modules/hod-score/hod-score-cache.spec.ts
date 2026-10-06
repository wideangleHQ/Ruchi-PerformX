import { describe, it, expect, vi } from 'vitest';

import { HodScoreService } from './hod-score.service';

// The HOD score matrix cache moved from an in-process Map (Phase 0/1 finding:
// incoherent across instances, empty after every deploy) to Redis, with the
// call sites in hod-score.service.ts completely unchanged — get<T>/set/del
// keep the exact signatures the in-memory version had. These tests cover the
// caching behaviour itself: key shape, hit vs. miss, and that a Redis failure
// never stops a score from being returned correctly.

function minimalRow(overrides: Record<string, unknown> = {}) {
  return {
    hod_id: 'hod-1',
    hod_name: 'Test HOD',
    department_ids: ['dept-1'],
    department_names: ['Dept One'],
    primary_department_id: 'dept-1',
    primary_department_name: 'Dept One',
    employee_count: 3,
    working_days: 22,
    created_tasks: 5,
    expected_tasks: 6,
    self_actions_total: 2,
    self_actions_completed: 2,
    self_action_days: 2,
    dept_tasks_total: 10,
    dept_tasks_completed: 8,
    dept_tasks_pending: 1,
    dept_tasks_overdue: 1,
    active_days: 20,
    features_used: 4,
    reviewed_tasks: 5,
    avg_review_hours: 3,
    requests_reviewed: 2,
    avg_request_hours: 1,
    task_creation_score: 80,
    self_action_score: 90,
    dept_completion_score: 70,
    dept_health_score: 60,
    active_participation_score: 85,
    leadership_score: 50,
    final_score: 75,
    department_rank: 1,
    department_total: 4,
    company_rank: 2,
    company_total: 10,
    ...overrides,
  };
}

function buildFakeRedis() {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn(async (key: string) => (store.has(key) ? store.get(key) : null)),
    set: vi.fn(async (key: string, value: unknown, _ttlSeconds?: number) => {
      store.set(key, value);
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  };
}

function buildService(rows: ReturnType<typeof minimalRow>[], redis = buildFakeRedis()) {
  const prisma = { $queryRaw: vi.fn().mockResolvedValue(rows) };
  const departmentScopeService = {};
  const service = new HodScoreService(prisma as never, redis as never, departmentScopeService as never);
  return { service, prisma, redis };
}

type PrivateHodScoreService = {
  getMatrix: (period: { month: number; year: number }) => Promise<{ hodId: string; score: number }[]>;
};

describe('HodScoreService matrix cache', () => {
  it('computes and caches on a miss', async () => {
    const { service, prisma, redis } = buildService([minimalRow()]);

    const result = await (service as unknown as PrivateHodScoreService).getMatrix({ month: 3, year: 2026 });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result[0]!.hodId).toBe('hod-1');
    expect(redis.set).toHaveBeenCalledTimes(1);
    const [key, value, ttl] = redis.set.mock.calls[0]!;
    expect(key).toBe('hod-score:v1:2026:3');
    expect(value).toEqual(result);
    expect(ttl).toBe(30 * 60);
  });

  it('serves a hit without recomputing', async () => {
    const redis = buildFakeRedis();
    const { service, prisma } = buildService([minimalRow()], redis);

    const first = await (service as unknown as PrivateHodScoreService).getMatrix({ month: 3, year: 2026 });
    const second = await (service as unknown as PrivateHodScoreService).getMatrix({ month: 3, year: 2026 });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it('gives different periods different cache keys', async () => {
    const redis = buildFakeRedis();
    const { service, prisma } = buildService([minimalRow()], redis);

    await (service as unknown as PrivateHodScoreService).getMatrix({ month: 3, year: 2026 });
    await (service as unknown as PrivateHodScoreService).getMatrix({ month: 4, year: 2026 });
    await (service as unknown as PrivateHodScoreService).getMatrix({ month: 3, year: 2027 });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(3);
    const keys = redis.set.mock.calls.map((call) => call[0]);
    expect(new Set(keys).size).toBe(3);
    expect(keys).toEqual(['hod-score:v1:2026:3', 'hod-score:v1:2026:4', 'hod-score:v1:2027:3']);
  });

  it('recomputes correctly when Redis reads fail — a cache is not a single point of failure', async () => {
    const redis = buildFakeRedis();
    redis.get.mockRejectedValue(new Error('redis unavailable'));
    const { service, prisma } = buildService([minimalRow()], redis);

    // getMatrix catches a throwing get() itself (belt and suspenders on top
    // of RedisService.get() already never throwing — see redis.service.spec.ts)
    // and falls through to computing the matrix normally.
    const result = await (service as unknown as PrivateHodScoreService).getMatrix({ month: 3, year: 2026 });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result[0]!.hodId).toBe('hod-1');
  });

  it('still returns the correct score when a cache write fails', async () => {
    const redis = buildFakeRedis();
    redis.set.mockRejectedValue(new Error('redis unavailable'));
    const { service, prisma } = buildService([minimalRow()], redis);

    const result = await (service as unknown as PrivateHodScoreService).getMatrix({ month: 3, year: 2026 });

    // The business computation succeeded and was returned even though
    // caching it failed — a missed write only costs the next reader a
    // recompute, it never turns into an error response.
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result[0]!.hodId).toBe('hod-1');
  });

  it('invalidatePeriod deletes the current period key when none is given', async () => {
    const redis = buildFakeRedis();
    const { service } = buildService([], redis);

    await service.invalidatePeriod();

    expect(redis.del).toHaveBeenCalledTimes(1);
    expect(redis.del.mock.calls[0]![0]).toMatch(/^hod-score:v1:\d{4}:\d{1,2}$/);
  });

  it('invalidatePeriod deletes a specific period key when one is given', async () => {
    const redis = buildFakeRedis();
    const { service } = buildService([], redis);

    await service.invalidatePeriod({ month: 1, year: 2025 });

    expect(redis.del).toHaveBeenCalledWith('hod-score:v1:2025:1');
  });
});
