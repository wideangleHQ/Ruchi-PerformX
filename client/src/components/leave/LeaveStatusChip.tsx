import { LeaveStatus } from '@/api/leave';

const tone: Record<LeaveStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  APPROVED: 'bg-green-50 text-green-700 ring-1 ring-green-200',
  REJECTED: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  CANCELLED: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
};

export function LeaveStatusChip({ status }: { status: LeaveStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone[status] ?? tone.CANCELLED}`}>
      {status}
    </span>
  );
}
