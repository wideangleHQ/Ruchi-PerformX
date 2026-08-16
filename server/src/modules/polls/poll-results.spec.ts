import { describe, it, expect } from 'vitest';
import { isOpen, tally } from './poll-results';

const options = [
  { id: 'a', label: 'Alpha', sort_order: 0 },
  { id: 'b', label: 'Beta', sort_order: 1 },
  { id: 'c', label: 'Gamma', sort_order: 2 },
];

const castFor = (...ids: string[]) => ids.map((option_id) => ({ option_id }));

describe('tally', () => {
  it('returns every option at zero when nobody has voted', () => {
    const result = tally(options, []);

    expect(result.totalVotes).toBe(0);
    expect(result.options.map((o) => o.votes)).toEqual([0, 0, 0]);
    expect(result.options.map((o) => o.percent)).toEqual([0, 0, 0]);
  });

  it('keeps options with no votes in the list', () => {
    const result = tally(options, castFor('a', 'a'));

    expect(result.options).toHaveLength(3);
    expect(result.options.map((o) => o.votes)).toEqual([2, 0, 0]);
    expect(result.options.map((o) => o.percent)).toEqual([100, 0, 0]);
  });

  it('splits a tie evenly', () => {
    const result = tally(options.slice(0, 2), castFor('a', 'b'));

    expect(result.options.map((o) => o.percent)).toEqual([50, 50]);
  });

  it('adds up to 100 on a three way split that does not divide evenly', () => {
    const result = tally(options, castFor('a', 'b', 'c'));

    expect(result.totalVotes).toBe(3);
    expect(result.options.map((o) => o.percent)).toEqual([34, 33, 33]);
    expect(result.options.reduce((sum, o) => sum + o.percent, 0)).toBe(100);
  });

  it('adds up to 100 across a range of awkward vote counts', () => {
    for (let a = 0; a <= 7; a += 1) {
      for (let b = 0; b <= 7; b += 1) {
        for (let c = 0; c <= 7; c += 1) {
          if (a + b + c === 0) continue;
          const votes = [
            ...Array.from({ length: a }, () => ({ option_id: 'a' })),
            ...Array.from({ length: b }, () => ({ option_id: 'b' })),
            ...Array.from({ length: c }, () => ({ option_id: 'c' })),
          ];
          const result = tally(options, votes);
          expect(result.options.reduce((sum, o) => sum + o.percent, 0)).toBe(100);
        }
      }
    }
  });

  it('ignores a vote for an option that is not on the poll', () => {
    const result = tally(options, castFor('a', 'ghost'));

    expect(result.totalVotes).toBe(1);
    expect(result.options.map((o) => o.percent)).toEqual([100, 0, 0]);
  });

  it('orders by sort_order rather than by the order rows arrived in', () => {
    const shuffled = [options[2]!, options[0]!, options[1]!];

    expect(tally(shuffled, []).options.map((o) => o.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('isOpen', () => {
  const now = new Date('2026-08-16T12:00:00.000Z');

  it('is open while closes_at is in the future', () => {
    expect(
      isOpen({ closes_at: new Date('2026-08-17T12:00:00.000Z'), is_closed: false }, now),
    ).toBe(true);
  });

  it('is closed once closes_at has passed, with no job having run', () => {
    expect(
      isOpen({ closes_at: new Date('2026-08-15T12:00:00.000Z'), is_closed: false }, now),
    ).toBe(false);
  });

  it('is closed at the exact moment closes_at is reached', () => {
    expect(isOpen({ closes_at: now, is_closed: false }, now)).toBe(false);
  });

  it('lets is_closed override a deadline that has not arrived yet', () => {
    expect(
      isOpen({ closes_at: new Date('2026-08-17T12:00:00.000Z'), is_closed: true }, now),
    ).toBe(false);
  });

  it('stays closed when both say closed', () => {
    expect(
      isOpen({ closes_at: new Date('2026-08-15T12:00:00.000Z'), is_closed: true }, now),
    ).toBe(false);
  });
});
