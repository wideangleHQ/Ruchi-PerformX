import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { budgetVariance } from './budget';

const d = (value: string) => new Prisma.Decimal(value);

// This is the whole reason the events module exists, and it is the one place
// here where a wrong answer looks plausible: a float sum drifts by cents, and
// an unbudgeted event divides by zero.
describe('budgetVariance', () => {
  it('reports an overspend as a positive amount and percentage', () => {
    const report = budgetVariance(d('50000'), [d('30000'), d('25000')]);

    expect(report.estimated).toBe('50000.00');
    expect(report.actual).toBe('55000.00');
    expect(report.variance).toBe('5000.00');
    expect(report.variance_pct).toBe('10.00');
    expect(report.over_budget).toBe(true);
  });

  it('reports an underspend as a negative amount and percentage', () => {
    const report = budgetVariance(d('50000'), [d('40000'), d('2500')]);

    expect(report.actual).toBe('42500.00');
    expect(report.variance).toBe('-7500.00');
    expect(report.variance_pct).toBe('-15.00');
    expect(report.over_budget).toBe(false);
  });

  it('spends exactly the estimate without rounding into an overspend', () => {
    const report = budgetVariance(d('100.00'), [d('33.33'), d('33.33'), d('33.34')]);

    expect(report.variance).toBe('0.00');
    expect(report.variance_pct).toBe('0.00');
    expect(report.over_budget).toBe(false);
  });

  it('gives a null percentage rather than Infinity when nothing was budgeted', () => {
    const report = budgetVariance(d('0'), [d('1200.50')]);

    expect(report.variance).toBe('1200.50');
    expect(report.variance_pct).toBeNull();
    expect(report.over_budget).toBe(true);
  });

  it('gives a null percentage rather than NaN when the estimate is absent', () => {
    const report = budgetVariance(null, []);

    expect(report.estimated).toBe('0.00');
    expect(report.actual).toBe('0.00');
    expect(report.variance).toBe('0.00');
    expect(report.variance_pct).toBeNull();
    expect(report.over_budget).toBe(false);
  });

  it('keeps every cent across a long expense list, where floats would not', () => {
    // 0.03 added a thousand times in binary floating point lands on
    // 30.00000000000038, which is greater than the 30.00 estimate. A float
    // implementation reports this event over budget by a fraction of a cent.
    const amounts = Array.from({ length: 1000 }, () => d('0.03'));
    const report = budgetVariance(d('30'), amounts);

    expect(report.actual).toBe('30.00');
    expect(report.variance).toBe('0.00');
    expect(report.variance_pct).toBe('0.00');
    expect(report.over_budget).toBe(false);
  });

  it('treats a negative amount as a refund against the total', () => {
    const report = budgetVariance(d('1000'), [d('1200'), d('-300')]);

    expect(report.actual).toBe('900.00');
    expect(report.variance).toBe('-100.00');
    expect(report.over_budget).toBe(false);
  });
});
