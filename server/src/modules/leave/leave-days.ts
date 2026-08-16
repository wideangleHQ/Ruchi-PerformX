/**
 * Date arithmetic for leave, with no Prisma and no Nest in it.
 *
 * The balance is the part of this module that is expensive to get wrong and
 * silent when it is, so the day count lives here as plain functions and is
 * tested directly in `leave-balance.spec.ts`.
 *
 * Every function works in UTC. Prisma hands back `@db.Date` columns as UTC
 * midnight and the DTOs carry `YYYY-MM-DD` strings, so staying in UTC keeps a
 * leave taken in IST from sliding a day when the server runs somewhere else.
 */

/**
 * Weekdays that are non-working company-wide, 0 = Sunday through 6 = Saturday.
 *
 * ponytail: a constant, not a table. Weekly offs are the same for everybody at
 * RUCHI and a per-employee shift calendar is the attendance module's job, which
 * is an optional add-on that does not exist. Ceiling: one company, one pattern,
 * no alternate-Saturday rule. Upgrade path is a `work_schedules` row keyed by
 * department, read in place of this constant, on the day somebody works Sundays.
 */
export const WEEKLY_OFF_DAYS: ReadonlySet<number> = new Set([0]);

/** The financial year starts 1 April, so month index 3. See decisions.md. */
export const FINANCIAL_YEAR_START_MONTH = 3;

/** Smallest application the module accepts, in days. */
export const MIN_LEAVE_DAYS = 0.5;

/** `YYYY-MM-DD` in UTC. The key format for holiday set lookups. */
export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Parse a `YYYY-MM-DD` DTO field into UTC midnight.
 *
 * Assumes the caller validated the format with `@IsDateString()`; an unparseable
 * string yields an Invalid Date rather than throwing, which the range check in
 * the service then rejects.
 */
export function parseDateOnly(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

/**
 * The financial year a date falls in, named by its starting calendar year.
 * 16 August 2026 is FY 2026; 10 February 2026 is FY 2025.
 */
export function financialYearOf(date: Date): number {
  const year = date.getUTCFullYear();
  return date.getUTCMonth() >= FINANCIAL_YEAR_START_MONTH ? year : year - 1;
}

/** First and last day of a financial year, inclusive. */
export function financialYearRange(year: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, FINANCIAL_YEAR_START_MONTH, 1)),
    // Day 0 of the next April is 31 March.
    end: new Date(Date.UTC(year + 1, FINANCIAL_YEAR_START_MONTH, 0)),
  };
}

/** First and last day of a calendar month, inclusive. `month` is 1-12. */
export function monthRange(year: number, month: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 0)),
  };
}

/** Every date from `start` to `end` inclusive. Empty when `end` precedes `start`. */
export function datesBetween(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  const cursor = new Date(start.getTime());
  while (cursor.getTime() <= end.getTime()) {
    out.push(new Date(cursor.getTime()));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/**
 * Working days in an inclusive range, with weekly offs and holidays removed.
 *
 * `holidayKeys` is the applicant's effective calendar as `YYYY-MM-DD` strings:
 * the union of company-wide holidays and their department's. Building that set
 * is the service's job because it needs the database; the exclusion arithmetic
 * is here because it is the part that has to be right.
 *
 * Returns 0 for a range that is entirely offs and holidays, which is the
 * failure the submission validator reports as its own rule.
 */
export function countLeaveDays(
  start: Date,
  end: Date,
  holidayKeys: ReadonlySet<string>,
): number {
  return datesBetween(start, end).filter(
    (day) =>
      !WEEKLY_OFF_DAYS.has(day.getUTCDay()) && !holidayKeys.has(toDateKey(day)),
  ).length;
}

/** Anything `Number()` can read. Keeps Prisma's Decimal out of this file. */
type DecimalLike = number | string | { toString(): string };

/**
 * Days left on a balance row: entitlement plus what carried over, less what has
 * been used. The one arithmetic every screen in the module repeats, so it is
 * written once and tested rather than inlined five times.
 */
export function remainingDays(balance: {
  entitled: DecimalLike;
  used: DecimalLike;
  carried_over: DecimalLike;
}): number {
  return (
    Number(balance.entitled) +
    Number(balance.carried_over) -
    Number(balance.used)
  );
}
