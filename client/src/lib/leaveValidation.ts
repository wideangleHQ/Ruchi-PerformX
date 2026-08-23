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
 * Mirrors CreateLeaveTypeDto. `forbidNonWhitelisted` is on, so a field here
 * without the matching DTO field is a 400 listing field names.
 *
 * `max_carry_forward` above `annual_entitlement` is refused here rather than on
 * the server, which accepts it: carrying more than a year's entitlement is
 * always a typo, and the balance arithmetic would quietly honour it.
 */
export const leaveTypeSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(60),
    annual_entitlement: z.coerce
      .number()
      .min(0, 'Entitlement cannot be negative')
      .max(365, 'That is more days than there are in a year'),
    is_paid: z.boolean(),
    carry_forward: z.boolean(),
    max_carry_forward: z.coerce.number().min(0).max(365),
    requires_proof: z.boolean(),
    is_active: z.boolean(),
  })
  .refine((d) => !d.carry_forward || d.max_carry_forward > 0, {
    message: 'Set how many days may carry forward, or turn carry forward off',
    path: ['max_carry_forward'],
  })
  .refine((d) => d.max_carry_forward <= d.annual_entitlement, {
    message: 'Carry forward cannot exceed the annual entitlement',
    path: ['max_carry_forward'],
  });

export type LeaveTypeFormData = z.infer<typeof leaveTypeSchema>;

/**
 * A balance correction. Every field optional: HR edits one column at a time and
 * the server sets what it is given.
 */
export const leaveBalanceSchema = z
  .object({
    entitled: z.coerce.number().min(0).max(365).optional(),
    used: z.coerce.number().min(0).max(365).optional(),
    carried_over: z.coerce.number().min(0).max(365).optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'Change at least one value',
  });

export type LeaveBalanceFormData = z.infer<typeof leaveBalanceSchema>;

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
  holidays: ReadonlyArray<{ date: string; name: string }> = [],
): LeaveDayBreakdown | null {
  if (!start || !end) return null;

  const from = toUtcDay(start);
  const to = toUtcDay(end);
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return null;

  const holidayNames = new Map(holidays.map((holiday) => [dayKey(holiday.date), holiday.name]));
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
