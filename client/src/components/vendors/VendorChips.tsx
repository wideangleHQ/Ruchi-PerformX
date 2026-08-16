'use client';

import { Star } from 'lucide-react';
import {
  DeliverableStatus,
  VendorAccessLevel,
  VendorDocumentStatus,
  VendorStatus,
} from '@/api/vendors';

const chip = 'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold';

const vendorStatusTone: Record<VendorStatus, string> = {
  PROSPECT: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
  ACTIVE: 'bg-green-50 text-green-700 ring-1 ring-green-200',
  ON_HOLD: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  EXPIRED: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  TERMINATED: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
};

const documentStatusTone: Record<VendorDocumentStatus, string> = {
  ACTIVE: 'bg-green-50 text-green-700 ring-1 ring-green-200',
  EXPIRING_SOON: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  EXPIRED: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
};

const deliverableStatusTone: Record<DeliverableStatus, string> = {
  PENDING: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  SUBMITTED: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  UNDER_REVIEW: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
  ACCEPTED: 'bg-green-50 text-green-700 ring-1 ring-green-200',
  REJECTED: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  OVERDUE: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
};

export const ACCESS_LEVELS: VendorAccessLevel[] = [
  'VENDOR_VIEWER',
  'VENDOR_MANAGER',
  'VENDOR_ADMIN',
];

/** PROSPECT / ACTIVE / ON_HOLD / EXPIRED / TERMINATED, section 15. */
export const VENDOR_STATUSES: VendorStatus[] = [
  'PROSPECT',
  'ACTIVE',
  'ON_HOLD',
  'EXPIRED',
  'TERMINATED',
];

export function label(value?: string | null) {
  return value ? value.replace(/_/g, ' ') : '-';
}

export function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function VendorStatusChip({ status }: { status: VendorStatus }) {
  return <span className={`${chip} ${vendorStatusTone[status]}`}>{label(status)}</span>;
}

/**
 * The status comes from the API, which derives it from expiry_date inside the
 * configurable window. A second rule here would disagree with the deadline
 * tracker on the boundary day.
 */
export function DocumentStatusChip({ status }: { status: VendorDocumentStatus }) {
  return <span className={`${chip} ${documentStatusTone[status]}`}>{label(status)}</span>;
}

export function DeliverableStatusChip({ status }: { status: DeliverableStatus }) {
  return <span className={`${chip} ${deliverableStatusTone[status]}`}>{label(status)}</span>;
}

export function GenericChip({ value }: { value?: string | null }) {
  return (
    <span className={`${chip} bg-slate-100 text-slate-700 ring-1 ring-slate-200`}>
      {label(value)}
    </span>
  );
}

/** Ratings are 1 to 5 and are shown as such. No composite, no percentage. */
export function RatingStars({ rating }: { rating?: number | null }) {
  if (rating === null || rating === undefined) {
    return <span className="text-sm text-slate-400">Not rated</span>;
  }

  const filled = Math.round(rating);

  return (
    <span className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((step) => (
        <Star
          key={step}
          size={16}
          className={step <= filled ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}
        />
      ))}
      <span className="ml-1 text-sm font-semibold text-slate-700">
        {rating.toFixed(1)} / 5
      </span>
    </span>
  );
}
