import { KpiMode, KpiStatus } from '@/api/kpi';

/**
 * Display helpers shared by the list, the form, and the detail panel. Kept out
 * of the components so the three cannot drift into showing the same KPI three
 * different ways.
 */

const TONES: Record<KpiStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-sky-100 text-sky-800',
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  IN_PROGRESS: 'bg-emerald-100 text-emerald-800',
  PENDING_REVIEW: 'bg-violet-100 text-violet-800',
  EVALUATED: 'bg-indigo-100 text-indigo-800',
  FINALIZED: 'bg-blue-100 text-blue-800',
  LOCKED: 'bg-slate-200 text-slate-800',
  CANCELLED: 'bg-rose-100 text-rose-800',
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

/**
 * The moves offered on the detail panel, mirroring the server's transition
 * table. The server decides what is legal and who may do it; this only decides
 * which buttons are worth drawing, so a stale entry here is a missing button
 * rather than a wrong outcome.
 */
export const NEXT_STATUSES: Record<KpiStatus, KpiStatus[]> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'DRAFT', 'CANCELLED'],
  APPROVED: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['PENDING_REVIEW', 'CANCELLED'],
  IN_PROGRESS: ['PENDING_REVIEW', 'CANCELLED'],
  PENDING_REVIEW: ['EVALUATED', 'IN_PROGRESS', 'CANCELLED'],
  EVALUATED: ['FINALIZED', 'PENDING_REVIEW', 'CANCELLED'],
  FINALIZED: ['LOCKED', 'EVALUATED', 'CANCELLED'],
  LOCKED: [],
  CANCELLED: [],
};
