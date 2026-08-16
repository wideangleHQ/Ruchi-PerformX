import { describe, it, expect } from 'vitest';
import {
  aggregateByPeriod,
  buildScoreTrend,
  trendPeriods,
  type StoredScoreRow,
} from './score-trend';

const row = (month: number, year: number, points: number): StoredScoreRow => ({
  month,
  year,
  points,
  assignedTasksCompleted: 1,
  selfActionsCompleted: 2,
  overdueTasksCount: 3,
});

describe('trendPeriods', () => {
  it('runs oldest to newest and ends on the requested period', () => {
    expect(trendPeriods({ month: 3, year: 2026 }, 3)).toEqual([
      { month: 1, year: 2026 },
      { month: 2, year: 2026 },
      { month: 3, year: 2026 },
    ]);
  });

  it('crosses the year boundary', () => {
    expect(trendPeriods({ month: 1, year: 2026 }, 3)).toEqual([
      { month: 11, year: 2025 },
      { month: 12, year: 2025 },
      { month: 1, year: 2026 },
    ]);
  });
});

describe('buildScoreTrend', () => {
  it('returns an empty series for a user with no history, rather than throwing', () => {
    expect(buildScoreTrend([], { month: 6, year: 2026 }, 6)).toEqual([]);
  });

  it('represents a month with no stored score instead of skipping it', () => {
    const trend = buildScoreTrend(
      [row(1, 2026, 40), row(3, 2026, 70)],
      { month: 3, year: 2026 },
      3,
    );

    expect(trend).toHaveLength(3);
    expect(trend.map((point) => point.hasScore)).toEqual([true, false, true]);
    expect(trend.map((point) => point.points)).toEqual([40, null, 70]);
  });

  it('distinguishes a stored zero from a missing month', () => {
    const trend = buildScoreTrend(
      [row(1, 2026, 0)],
      { month: 2, year: 2026 },
      2,
    );

    expect(trend[0]).toMatchObject({ hasScore: true, points: 0 });
    expect(trend[1]).toMatchObject({ hasScore: false, points: null });
  });

  it('orders the series oldest to newest across a year boundary', () => {
    const trend = buildScoreTrend(
      [row(12, 2025, 50), row(1, 2026, 60)],
      { month: 1, year: 2026 },
      3,
    );

    expect(trend.map((point) => point.label)).toEqual([
      'Nov 2025',
      'Dec 2025',
      'Jan 2026',
    ]);
  });

  it('ignores rows outside the window', () => {
    const trend = buildScoreTrend(
      [row(1, 2020, 900), row(2, 2026, 60)],
      { month: 2, year: 2026 },
      2,
    );

    expect(trend.map((point) => point.points)).toEqual([null, 60]);
  });

  it('carries the stored counts through unchanged', () => {
    const [point] = buildScoreTrend([row(2, 2026, 60)], { month: 2, year: 2026 }, 1);

    expect(point).toMatchObject({
      assignedTasksCompleted: 1,
      selfActionsCompleted: 2,
      overdueTasksCount: 3,
    });
  });
});

describe('aggregateByPeriod', () => {
  it('averages points and sums counts within a month', () => {
    const aggregated = aggregateByPeriod([row(2, 2026, 40), row(2, 2026, 70)]);

    expect(aggregated).toEqual([
      {
        month: 2,
        year: 2026,
        points: 55,
        assignedTasksCompleted: 2,
        selfActionsCompleted: 4,
        overdueTasksCount: 6,
      },
    ]);
  });

  it('keeps months apart', () => {
    const aggregated = aggregateByPeriod([row(1, 2026, 10), row(2, 2026, 20)]);

    expect(aggregated.map((entry) => entry.points)).toEqual([10, 20]);
  });

  it('returns nothing for no rows, so an empty department stays an empty series', () => {
    expect(buildScoreTrend(aggregateByPeriod([]), { month: 2, year: 2026 }, 6)).toEqual([]);
  });
});
