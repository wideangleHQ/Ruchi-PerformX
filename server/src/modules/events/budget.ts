import { Prisma } from '@prisma/client';

export interface BudgetVariance {
  estimated: string;
  actual: string;
  /** Actual minus estimated. Positive is an overspend. */
  variance: string;
  /** The same number against the estimate, or null when there is no estimate to divide by. */
  variance_pct: string | null;
  over_budget: boolean;
}

/**
 * Estimated against actual for one event.
 *
 * Kept pure and separate from the service because it is the only arithmetic in
 * this module that can be wrong quietly. Decimal in, strings out, so no value
 * on this path is ever a JavaScript number: both columns are Decimal(12, 2)
 * and a float sum of a few hundred receipts drifts by cents.
 *
 * A missing or zero estimate gives a null percentage rather than Infinity or
 * NaN. That is the normal state of an event created before anyone agreed a
 * budget, not an error, so it does not throw.
 *
 * Assumes amounts come straight from `event_expenses.amount`. A negative
 * amount is treated as a refund and simply reduces the actual.
 */
export function budgetVariance(
  estimated: Prisma.Decimal | null,
  amounts: readonly Prisma.Decimal[],
): BudgetVariance {
  const estimate = estimated ?? new Prisma.Decimal(0);
  const actual = amounts.reduce((sum, amount) => sum.plus(amount), new Prisma.Decimal(0));
  const variance = actual.minus(estimate);

  return {
    estimated: estimate.toFixed(2),
    actual: actual.toFixed(2),
    variance: variance.toFixed(2),
    variance_pct: estimate.isZero() ? null : variance.div(estimate).times(100).toFixed(2),
    over_budget: variance.greaterThan(0),
  };
}
