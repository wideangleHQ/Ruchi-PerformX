import { EventStatus } from '@/api/events';

/**
 * "120000.50" as ₹1,20,000.50, by string surgery rather than by parsing.
 * Nothing on the money path becomes a number, display included, so there is
 * never a version of an amount that rounds differently to the one the API sent.
 */
export function formatMoney(value: string | null | undefined) {
  if (value === null || value === undefined) return '-';

  const negative = value.startsWith('-');
  const [whole = '0', cents = ''] = (negative ? value.slice(1) : value).split('.');
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;

  return `${negative ? '-' : ''}₹${grouped}.${cents.padEnd(2, '0')}`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export const statusTone: Record<EventStatus, string> = {
  PLANNED: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
  COMPLETED: 'bg-green-50 text-green-700 ring-1 ring-green-200',
  CANCELLED: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
};
