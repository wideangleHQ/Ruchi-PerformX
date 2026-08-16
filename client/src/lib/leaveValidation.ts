import { z } from 'zod';

/**
 * Mirrors the POST /leave/applications DTO. The API runs `forbidNonWhitelisted`,
 * so a field added here without the matching DTO field is a 400 with an
 * unhelpful message. Attachments ride along as multipart, not through zod.
 */
export const applyLeaveSchema = z
  .object({
    leave_type_id: z.string().min(1, 'Select a leave type'),
    start_date: z.string().min(1, 'Start date is required'),
    end_date: z.string().min(1, 'End date is required'),
    reason: z.string().trim().min(1, 'Reason is required'),
  })
  .refine((data) => data.end_date >= data.start_date, {
    message: 'End date cannot be before the start date',
    path: ['end_date'],
  });

export type ApplyLeaveFormData = z.infer<typeof applyLeaveSchema>;

/**
 * ponytail: weekly offs are a single company-wide constant, as p2_leave.md asks.
 * Sunday only. Per-employee shift calendars are the attendance module's job.
 */
export const WEEKLY_OFF_DAYS = [0];

const DAY_MS = 86_400_000;

/** The `yyyy-mm-dd` part of a date-only column, which Prisma sends as a full ISO string. */
export const dayKey = (value: string) => value.slice(0, 10);

const toUtcDay = (value: string) => {
  const [year, month, day] = dayKey(value).split('-').map(Number);
  return Date.UTC(year, month - 1, day);
};

export interface LeaveDayBreakdown {
  calendarDays: number;
  workingDays: number;
  excluded: Array<{ date: string; label: string }>;
}

/**
 * The arithmetic behind `days_count`: every day in the range, less holidays and
 * weekly offs, with the excluded days named so the employee can check the total.
 * Returns null when the range is incomplete or inverted. The server recomputes
 * this on submit; this is the preview.
 */
export function computeLeaveDays(
  start: string,
  end: string,
  holidays: ReadonlyArray<{ holiday_date: string; name: string }> = [],
): LeaveDayBreakdown | null {
  if (!start || !end) return null;

  const from = toUtcDay(start);
  const to = toUtcDay(end);
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return null;

  const holidayNames = new Map(holidays.map((holiday) => [dayKey(holiday.holiday_date), holiday.name]));
  const excluded: LeaveDayBreakdown['excluded'] = [];
  let workingDays = 0;

  for (let cursor = from; cursor <= to; cursor += DAY_MS) {
    const date = new Date(cursor);
    const key = date.toISOString().slice(0, 10);
    const holiday = holidayNames.get(key);

    if (holiday) excluded.push({ date: key, label: holiday });
    else if (WEEKLY_OFF_DAYS.includes(date.getUTCDay())) excluded.push({ date: key, label: 'Weekly off' });
    else workingDays += 1;
  }

  return { calendarDays: (to - from) / DAY_MS + 1, workingDays, excluded };
}

/** Renders a date-only value in UTC so a `yyyy-mm-dd` never slips a day westward. */
export function formatLeaveDate(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(dayKey(value)));
}
