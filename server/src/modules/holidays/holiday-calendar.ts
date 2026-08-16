// src/modules/holidays/holiday-calendar.ts

/** A `holidays` row narrowed to the columns the merge reads. */
export interface HolidayRow {
  id: string;
  name: string;
  holiday_date: Date;
  is_optional: boolean;
  department_id: string | null;
}

export type HolidayTier = 'COMMON' | 'DEPARTMENT';

export interface EffectiveHoliday extends HolidayRow {
  tier: HolidayTier;
}

/**
 * The calendar day a holiday falls on, as `YYYY-MM-DD`.
 *
 * `holidays.holiday_date` is a Postgres `date`, which Prisma hands back as a
 * Date pinned to UTC midnight, so slicing the ISO string is the day itself and
 * not a timezone-shifted neighbour.
 */
export function holidayDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The calendar a department actually observes: every common holiday plus every
 * holiday belonging to one of `departmentIds`, sorted by date.
 *
 * @param rows - holidays from both tiers, in any order
 * @param departmentIds - the departments to include, or null for every
 *   department, which is what an administrator with no department of their own
 *   sees
 * @returns each surviving row tagged with its tier, oldest date first
 *
 * A date already held by the common tier suppresses department rows on the same
 * date, because a company-wide holiday is a day off for that department too and
 * counting it twice would deduct the day twice from a leave application.
 *
 * ponytail: the suppressed department row stays invisible to the screen that
 * could delete it. It is harmless, it excludes a day that is already excluded.
 * Surface it as a "shadowed by a common holiday" hint if HR ever asks why a row
 * they created does not appear.
 */
export function mergeEffectiveCalendar(
  rows: HolidayRow[],
  departmentIds: string[] | null,
): EffectiveHoliday[] {
  const visible = rows.filter(
    (row) =>
      row.department_id === null ||
      departmentIds === null ||
      departmentIds.includes(row.department_id),
  );

  const commonDates = new Set(
    visible
      .filter((row) => row.department_id === null)
      .map((row) => holidayDateKey(row.holiday_date)),
  );

  return visible
    .filter(
      (row) =>
        row.department_id === null ||
        !commonDates.has(holidayDateKey(row.holiday_date)),
    )
    .map((row) => ({
      ...row,
      tier: (row.department_id === null
        ? 'COMMON'
        : 'DEPARTMENT') as HolidayTier,
    }))
    .sort((a, b) => a.holiday_date.getTime() - b.holiday_date.getTime());
}
