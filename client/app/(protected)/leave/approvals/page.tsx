'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarRange, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { LeaveApplication, LeaveType, leaveTypeName, toDays } from '@/api/leave';
import { useApproveLeave, useLeaveTypes, usePendingLeave, useRejectLeave } from '@/hooks/useLeave';
import { TeamCalendarDialog } from '@/components/leave/TeamCalendarDialog';
import { canActOnLeave } from '@/components/leave/access';
import { formatLeaveDate } from '@/lib/leaveValidation';

export default function LeaveApprovalsPage() {
  const { user } = useAuth();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const allowed = canActOnLeave(user?.role);
  const { data: pending = [], isLoading } = usePendingLeave(allowed);
  const { data: types = [] } = useLeaveTypes();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/leave" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-green-700">
            <ArrowLeft size={16} />
            Back to my leave
          </Link>
          <div className="mt-3 mb-2 inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
            <Users size={14} />
            Approvals
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Pending Leave</h1>
          <p className="mt-1 text-sm text-slate-500">
            Whichever of you acts first closes the application. Rejections need a remark.
          </p>
        </div>
        <Button type="button" variant="outline" className="gap-2" onClick={() => setCalendarOpen(true)}>
          <CalendarRange size={16} />
          Team Calendar
        </Button>
      </div>

      {!allowed ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
          Leave approvals are for HODs and HR.
        </div>
      ) : isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading pending applications...
        </div>
      ) : !pending.length ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
          Nothing is waiting on you.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['Applicant', 'Dates', 'Type', 'Reason', 'Their Balance', 'Decision'].map((head) => (
                    <th key={head} className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pending.map((application) => (
                  <PendingRow key={application.id} application={application} types={types} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
            {pending.length} application{pending.length === 1 ? '' : 's'} pending
          </div>
        </div>
      )}

      <TeamCalendarDialog open={calendarOpen} onClose={() => setCalendarOpen(false)} />
    </div>
  );
}

function PendingRow({ application, types }: { application: LeaveApplication; types: LeaveType[] }) {
  const [remark, setRemark] = useState('');
  const [error, setError] = useState<string | null>(null);
  const approveMutation = useApproveLeave();
  const rejectMutation = useRejectLeave();
  const busy = approveMutation.isPending || rejectMutation.isPending;

  const act = async (decision: 'approve' | 'reject') => {
    setError(null);
    try {
      if (decision === 'approve') await approveMutation.mutateAsync({ id: application.id, remark: remark.trim() });
      else await rejectMutation.mutateAsync({ id: application.id, remark: remark.trim() });
    } catch (err) {
      setError((err as any)?.response?.data?.message || 'Could not record the decision');
    }
  };

  const days = toDays(application.days_count);

  return (
    <tr className="align-top hover:bg-slate-50/60">
      <td className="px-5 py-4">
        <Link href={`/leave/${application.id}`} className="font-semibold text-slate-900 hover:text-green-700">
          {application.user_id_user?.full_name ?? 'Employee'}
        </Link>
        <p className="text-xs text-slate-500">{application.user_id_user?.email ?? ''}</p>
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-slate-600">
        {formatLeaveDate(application.start_date)} - {formatLeaveDate(application.end_date)}
        <p className="text-xs text-slate-500">
          {days} day{days === 1 ? '' : 's'}
        </p>
      </td>
      <td className="px-5 py-4 text-slate-600">{leaveTypeName(types, application.leave_type_id)}</td>
      <td className="max-w-[260px] px-5 py-4 text-slate-600">
        <p className="line-clamp-3">{application.reason}</p>
      </td>
      <td className="whitespace-nowrap px-5 py-4">
        {application.applicant_balance === null || application.applicant_balance === undefined ? (
          <span className="text-slate-400">-</span>
        ) : (
          <span className="font-semibold text-slate-900">{toDays(application.applicant_balance)} days</span>
        )}
      </td>
      <td className="px-5 py-4">
        <div className="w-[260px] space-y-2">
          <textarea
            value={remark}
            onChange={(event) => setRemark(event.target.value)}
            rows={2}
            placeholder="Remark (required to reject)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              className="bg-green-600 hover:bg-green-700"
              disabled={busy}
              onClick={() => act('approve')}
            >
              Approve
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || !remark.trim()}
              onClick={() => act('reject')}
            >
              Reject
            </Button>
          </div>
          {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        </div>
      </td>
    </tr>
  );
}
