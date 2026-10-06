import { KpiMode, KpiStatus } from '@/api/kpi';

/**
 * Display helpers shared by the list, the form, and the detail panel. Kept out
 * of the components so the three cannot drift into showing the same KPI three
 * different ways.
 */

const TONES: Record<KpiStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-800',
  PUBLISHED: 'bg-emerald-100 text-emerald-800',
  DELETED: 'bg-rose-100 text-rose-800',
};

export function statusTone(status: KpiStatus): string {
  return TONES[status];
}

export function statusLabel(status: KpiStatus): string {
  return status.replace(/_/g, ' ').toLowerCase();
}

export const MODE_LABELS: Record<KpiMode, string> = {
  QUANTITATIVE: 'Quantitative',
  BINARY: 'Binary',
  MILESTONE: 'Milestone',
  RATING: 'Rating',
};

/** Indian grouping, because every rupee target in this company is read in
 * lakhs and crores. */
export function formatNumber(value: number | string | null): string {
  if (value === null) return '-';
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(parsed)) return '-';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(parsed);
}

/** A value with its unit, which is the only form in which it means anything. */
export function formatValue(
  value: number | string | null,
  symbol: string | null,
): string {
  if (value === null) return 'Not entered';
  const number = formatNumber(value);
  if (!symbol) return number;
  return symbol === '₹' || symbol === '$' || symbol === '€' || symbol === '£'
    ? `${symbol}${number}`
    : `${number} ${symbol}`;
}

export function formatPercent(value: number | null): string {
  return value === null ? '-' : `${formatNumber(value)}%`;
}

/** The band an AT or PS score falls in. Labelled as proposed, not HR policy. */
export function scoreBand(score: number): { label: string; tone: string } {
  if (score >= 90) return { label: 'Excellent', tone: 'text-emerald-600' };
  if (score >= 75) return { label: 'Good', tone: 'text-sky-600' };
  if (score >= 60) return { label: 'Needs attention', tone: 'text-amber-600' };
  return { label: 'Improvement required', tone: 'text-rose-600' };
}

/** Roles that publish their own KPIs, assign to others, and quick approve.
 * Mirrors `KPI_AUTHORITY_ROLES` on the server, which is what actually decides. */
export const AUTHORITY_ROLES = ['MD', 'EA', 'PA', 'HOD', 'DEPARTMENT_CONTROLLER'];
