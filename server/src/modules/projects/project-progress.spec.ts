import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';

import { computeProgress, deriveHealth } from './project-execution.service';
import { toMemberTick } from './dto/checklist/member-tick-checklist.dto';

/**
 * Progress is the number the whole module is judged on, and the one thing
 * nobody is allowed to type in. These tests pin both halves of that: the
 * arithmetic, and the fact that the only way to move it is to tick an item.
 */
describe('computeProgress', () => {
  it('is 0 percent for an empty checklist, not 100', () => {
    expect(computeProgress([])).toEqual({ done: 0, total: 0, percent: 0 });
  });

  it('is 100 percent when every item is done', () => {
    const items = [{ is_done: true }, { is_done: true }];
    expect(computeProgress(items)).toEqual({ done: 2, total: 2, percent: 100 });
  });

  it('rounds a partial checklist', () => {
    const items = [{ is_done: true }, { is_done: false }, { is_done: false }];
    expect(computeProgress(items)).toEqual({ done: 1, total: 3, percent: 33 });
  });

  it('reads nothing but is_done, so a caller cannot hand it a number', () => {
    const honest = [{ is_done: true }, { is_done: false }];
    const tampered = [
      { is_done: true, percent: 100, progress: 100, is_overdue: false },
      { is_done: false, percent: 100, progress: 100, is_overdue: true },
    ];
    expect(computeProgress(tampered)).toEqual(computeProgress(honest));
    expect(computeProgress(tampered).percent).toBe(50);
  });
});

describe('toMemberTick', () => {
  it('drops every field but is_done', () => {
    const body = {
      is_done: true,
      due_date: '2027-01-01T00:00:00.000Z',
      priority: 'LOW',
      title: 'A softer target',
      assigned_to_id: '00000000-0000-0000-0000-000000000001',
      sort_order: 99,
    };

    const update = toMemberTick(body);

    expect(Object.keys(update)).toEqual(['is_done']);
    expect(update.is_done).toBe(true);
  });

  it('rejects a member PATCH with nothing to tick', () => {
    expect(() => toMemberTick({ title: 'Renamed' })).toThrow(
      BadRequestException,
    );
  });
});

describe('deriveHealth', () => {
  const now = new Date('2026-08-16T00:00:00.000Z');
  const days = (n: number) => new Date(now.getTime() + n * 86_400_000);

  it('is ON_TRACK once the checklist is finished, late or not', () => {
    const health = deriveHealth(
      {
        deadline: days(-30),
        progress: { done: 4, total: 4, percent: 100 },
        overdueItems: 0,
        overdueMilestones: 0,
      },
      now,
    );
    expect(health).toBe('ON_TRACK');
  });

  it('is DELAYED once the deadline passes with work outstanding', () => {
    const health = deriveHealth(
      {
        deadline: days(-1),
        progress: { done: 1, total: 4, percent: 25 },
        overdueItems: 0,
        overdueMilestones: 0,
      },
      now,
    );
    expect(health).toBe('DELAYED');
  });

  it('is DELAYED on an overdue milestone even with the deadline ahead', () => {
    const health = deriveHealth(
      {
        deadline: days(60),
        progress: { done: 3, total: 4, percent: 75 },
        overdueItems: 0,
        overdueMilestones: 1,
      },
      now,
    );
    expect(health).toBe('DELAYED');
  });

  it('is AT_RISK inside the last week with the checklist behind', () => {
    const health = deriveHealth(
      {
        deadline: days(3),
        progress: { done: 1, total: 4, percent: 25 },
        overdueItems: 0,
        overdueMilestones: 0,
      },
      now,
    );
    expect(health).toBe('AT_RISK');
  });

  it('is ON_TRACK with no deadline and nothing overdue', () => {
    const health = deriveHealth(
      {
        deadline: null,
        progress: { done: 1, total: 4, percent: 25 },
        overdueItems: 0,
        overdueMilestones: 0,
      },
      now,
    );
    expect(health).toBe('ON_TRACK');
  });
});
