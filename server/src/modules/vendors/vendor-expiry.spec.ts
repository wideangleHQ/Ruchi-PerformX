import { describe, it, expect } from 'vitest';
import {
  EXPIRY_WINDOW_DAYS,
  daysUntil,
  deadlineFlag,
  documentExpiryStatus,
  onTimePercentage,
} from './vendor-work.service';

const today = new Date('2026-08-16T09:30:00Z');
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

// vendor_documents stores no status. ACTIVE / EXPIRING_SOON / EXPIRED is a
// function of expiry_date and today, so a stored copy is wrong the morning
// after it is written. This is the one calculator, and the deadline cron calls
// the same one, which is the whole point of testing it here.
describe('documentExpiryStatus', () => {
  it('is ACTIVE well before the window opens', () => {
    expect(documentExpiryStatus(day('2027-01-01'), today)).toBe('ACTIVE');
  });

  it('is EXPIRING_SOON on the last day outside the window', () => {
    // 30 days out with a 30 day window is inside it, 31 is not
    expect(documentExpiryStatus(day('2026-09-15'), today)).toBe('EXPIRING_SOON');
    expect(documentExpiryStatus(day('2026-09-16'), today)).toBe('ACTIVE');
  });

  it('is EXPIRING_SOON on the expiry date itself, not EXPIRED', () => {
    expect(documentExpiryStatus(day('2026-08-16'), today)).toBe('EXPIRING_SOON');
  });

  it('is EXPIRED the day after', () => {
    expect(documentExpiryStatus(day('2026-08-15'), today)).toBe('EXPIRED');
  });

  it('treats a missing expiry date as ACTIVE rather than throwing', () => {
    // A PAN card does not expire. The column is nullable for that reason and a
    // list of documents must not blow up on one.
    expect(documentExpiryStatus(null, today)).toBe('ACTIVE');
    expect(documentExpiryStatus(undefined, today)).toBe('ACTIVE');
  });

  it('takes a different window without a second calculator', () => {
    expect(documentExpiryStatus(day('2026-08-20'), today, 3)).toBe('ACTIVE');
    expect(documentExpiryStatus(day('2026-08-20'), today, 7)).toBe('EXPIRING_SOON');
  });

  it('ignores the time of day, so status does not change over an afternoon', () => {
    const morning = new Date('2026-08-16T00:00:01Z');
    const night = new Date('2026-08-16T23:59:59Z');
    expect(documentExpiryStatus(day('2026-08-16'), morning)).toBe('EXPIRING_SOON');
    expect(documentExpiryStatus(day('2026-08-16'), night)).toBe('EXPIRING_SOON');
  });

  it('uses the documented default window', () => {
    expect(EXPIRY_WINDOW_DAYS).toBe(30);
  });
});

describe('deadlineFlag', () => {
  it('separates overdue, soon and upcoming across the same window', () => {
    expect(deadlineFlag(day('2026-08-15'), today)).toBe('OVERDUE');
    expect(deadlineFlag(day('2026-08-16'), today)).toBe('SOON');
    expect(deadlineFlag(day('2026-09-15'), today)).toBe('SOON');
    expect(deadlineFlag(day('2026-09-16'), today)).toBe('UPCOMING');
  });
});

describe('daysUntil', () => {
  it('counts whole days and goes negative once the date passes', () => {
    expect(daysUntil(day('2026-08-16'), today)).toBe(0);
    expect(daysUntil(day('2026-08-17'), today)).toBe(1);
    expect(daysUntil(day('2026-08-14'), today)).toBe(-2);
  });
});

// The performance view divides submitted-on-time by submitted-at-all. A vendor
// with nothing submitted has an empty denominator, and 0/0 is the bug that
// reaches the screen as NaN%.
describe('onTimePercentage', () => {
  it('returns null instead of dividing by zero when there are no deliverables', () => {
    expect(onTimePercentage([])).toBeNull();
  });

  it('returns null when nothing is measurable yet', () => {
    expect(
      onTimePercentage([
        { due_date: day('2026-09-01'), submitted_date: null },
        { due_date: null, submitted_date: day('2026-08-01') },
      ]),
    ).toBeNull();
  });

  it('counts submission on the due date as on time', () => {
    expect(
      onTimePercentage([
        { due_date: day('2026-08-10'), submitted_date: day('2026-08-10') },
      ]),
    ).toBe(100);
  });

  it('skips unmeasurable rows rather than counting them late', () => {
    expect(
      onTimePercentage([
        { due_date: day('2026-08-10'), submitted_date: day('2026-08-09') },
        { due_date: day('2026-08-10'), submitted_date: day('2026-08-12') },
        { due_date: day('2026-08-10'), submitted_date: null },
      ]),
    ).toBe(50);
  });

  it('rounds to a whole percentage', () => {
    expect(
      onTimePercentage([
        { due_date: day('2026-08-10'), submitted_date: day('2026-08-01') },
        { due_date: day('2026-08-10'), submitted_date: day('2026-08-01') },
        { due_date: day('2026-08-10'), submitted_date: day('2026-08-20') },
      ]),
    ).toBe(67);
  });
});
