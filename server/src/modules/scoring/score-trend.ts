// src/modules/scoring/score-trend.ts

/**
 * Trend assembly for employee points.
 *
 * Pure functions, no Prisma and no clock. The service does the reading, this
 * file does the shaping, and `score-trend.spec.ts` covers it directly.
 *
 * The number carried through here is `points`: the unbounded total written to
 * `performance_scores.final_score`. It is not a percentage and not a rating out
 * of anything. See docs/src/p1_scoring.md.
 */

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export interface ScorePeriod {
  month: number;
  year: number;
}

/** A `performance_scores` row reduced to the columns a trend reads. */
export interface StoredScoreRow extends ScorePeriod {
  points: number;
  assignedTasksCompleted: number;
  selfActionsCompleted: number;
  overdueTasksCount: number;
}

/**
 * One month of the series. `hasScore: false` means no row was stored for that
 * month, which is different from a stored zero, so the two are never conflated.
 */
export interface ScoreTrendPoint extends ScorePeriod {
  label: string;
  hasScore: boolean;
  points: number | null;
  assignedTasksCompleted: number;
  selfActionsCompleted: number;
  overdueTasksCount: number;
}

/**
 * The `months` periods ending at and including `end`, oldest first.
 *
 * Month arithmetic runs on an absolute month index so a window crossing a year
 * boundary needs no special case. Returns an empty array for `months < 1`.
 */
export function trendPeriods(end: ScorePeriod, months: number): ScorePeriod[] {
  if (months < 1) return [];

  const endIndex = end.year * 12 + (end.month - 1);
  const periods: ScorePeriod[] = [];

  for (let back = months - 1; back >= 0; back--) {
    const index = endIndex - back;
    periods.push({ month: (index % 12) + 1, year: Math.floor(index / 12) });
  }

  return periods;
}

/**
 * Assemble a monthly series from stored rows, oldest to newest.
 *
 * A month inside the window with no stored row is emitted as a gap
 * (`hasScore: false`, `points: null`) rather than being dropped. Dropping it
 * would leave a six-month chart drawing five bars as though they were
 * consecutive, which is a chart that lies.
 *
 * No rows at all returns an empty series, so a user who has never been scored
 * gets an explicit "no history" empty state instead of a row of gaps that reads
 * as a run of bad months.
 *
 * Rows outside the window are ignored. Duplicate periods keep the last row.
 */
export function buildScoreTrend(
  rows: StoredScoreRow[],
  end: ScorePeriod,
  months: number,
): ScoreTrendPoint[] {
  if (!rows.length) return [];

  const byPeriod = new Map(rows.map((row) => [`${row.year}-${row.month}`, row]));

  return trendPeriods(end, months).map((period) => {
    const row = byPeriod.get(`${period.year}-${period.month}`);

    return {
      month: period.month,
      year: period.year,
      label: `${MONTH_LABELS[period.month - 1]} ${period.year}`,
      hasScore: Boolean(row),
      points: row ? row.points : null,
      assignedTasksCompleted: row?.assignedTasksCompleted ?? 0,
      selfActionsCompleted: row?.selfActionsCompleted ?? 0,
      overdueTasksCount: row?.overdueTasksCount ?? 0,
    };
  });
}

/**
 * Collapse many users' rows into one row per month: points averaged across the
 * people scored that month, counts summed.
 *
 * Averaging points and summing counts is deliberate. Points are per person, so
 * a department total would grow with headcount and say nothing about the
 * department. The counts are volumes and a department total is what they mean.
 */
export function aggregateByPeriod(rows: StoredScoreRow[]): StoredScoreRow[] {
  const buckets = new Map<string, { row: StoredScoreRow; count: number }>();

  for (const row of rows) {
    const key = `${row.year}-${row.month}`;
    const bucket = buckets.get(key);

    if (!bucket) {
      buckets.set(key, { row: { ...row }, count: 1 });
      continue;
    }

    bucket.row.points += row.points;
    bucket.row.assignedTasksCompleted += row.assignedTasksCompleted;
    bucket.row.selfActionsCompleted += row.selfActionsCompleted;
    bucket.row.overdueTasksCount += row.overdueTasksCount;
    bucket.count += 1;
  }

  return [...buckets.values()].map(({ row, count }) => ({
    ...row,
    points: Math.round(row.points / count),
  }));
}
