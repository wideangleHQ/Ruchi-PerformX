import { describe, it, expect } from 'vitest';
import { mergeEffectiveCalendar, type HolidayRow } from './holiday-calendar';

const SALES = '11111111-1111-1111-1111-111111111111';
const WORKS = '22222222-2222-2222-2222-222222222222';

function row(
  name: string,
  date: string,
  department_id: string | null = null,
): HolidayRow {
  return {
    id: `${name}-${date}-${department_id ?? 'common'}`,
    name,
    holiday_date: new Date(`${date}T00:00:00.000Z`),
    is_optional: false,
    department_id,
  };
}

// The merge is what leave day counts are computed against, so a row that leaks
// in from another department or a date counted twice comes back as a wrong
// balance weeks later, with nothing pointing at this function.
describe('mergeEffectiveCalendar', () => {
  const common = row('Republic Day', '2026-01-26');
  const salesDay = row('Sales Offsite', '2026-03-12', SALES);
  const worksDay = row('Works Shutdown', '2026-04-14', WORKS);

  it('gives a department with no rows of its own the common tier', () => {
    const merged = mergeEffectiveCalendar([common, worksDay], [SALES]);

    expect(merged.map((h) => [h.name, h.tier])).toEqual([
      ['Republic Day', 'COMMON'],
    ]);
  });

  it('gives a department its own rows', () => {
    const merged = mergeEffectiveCalendar([salesDay, worksDay], [SALES]);

    expect(merged.map((h) => [h.name, h.tier])).toEqual([
      ['Sales Offsite', 'DEPARTMENT'],
    ]);
  });

  it('unions both tiers in date order', () => {
    const merged = mergeEffectiveCalendar(
      [salesDay, common, worksDay],
      [SALES],
    );

    expect(merged.map((h) => h.name)).toEqual([
      'Republic Day',
      'Sales Offsite',
    ]);
  });

  it('counts a date held by both tiers once, keeping the common row', () => {
    const clash = row('Founders Day', '2026-01-26', SALES);
    const merged = mergeEffectiveCalendar([clash, common], [SALES]);

    expect(merged.map((h) => [h.name, h.tier])).toEqual([
      ['Republic Day', 'COMMON'],
    ]);
  });

  it('keeps every department for the administrator view', () => {
    const merged = mergeEffectiveCalendar([salesDay, common, worksDay], null);

    expect(merged.map((h) => h.name)).toEqual([
      'Republic Day',
      'Sales Offsite',
      'Works Shutdown',
    ]);
  });

  it('leaves a user with no department the common tier', () => {
    const merged = mergeEffectiveCalendar([salesDay, common], []);

    expect(merged.map((h) => h.name)).toEqual(['Republic Day']);
  });
});
