'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { leaveTypeName, toDays } from '@/api/leave';
import { useCancelMyLeave, useLeaveApplication, useLeaveTypes } from '@/hooks/useLeave';
import { HrCancelDialog } from '@/components/leave/HrCancelDialog';
import { LeaveStatusChip } from '@/components/leave/LeaveStatusChip';
import { isLeaveHr } from '@/components/leave/access';
import { formatLeaveDate } from '@/lib/leaveValidation';

export default function LeaveDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const applicationId = params.id as string;
  const { data: application, isLoading } = useLeaveApplication(applicationId);
  const { data: types = [] } = useLeaveTypes();
  const cancelMutation = useCancelMyLeave();
  const [hrCancelOpen, setHrCancelOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Loading application...
      </div>
    );
  }

  if (!application) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
        Application not found.
      </div>
    );
  }

  const isMine = application.user_id === user?.id;
  const canWithdraw = isMine && application.status === 'PENDING';
  const canHrCancel = isLeaveHr(user?.role) && application.status === 'APPROVED';
  const days = toDays(application.days_count);

  const withdraw = async () => {
    setError(null);
    try {
      await cancelMutation.mutateAsync(application.id);
    } catch (err) {
      setError((err as any)?.response?.data?.message || 'Could not withdraw the application');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/leave" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-green-700">
          <ArrowLeft size={16} />
          Back to my leave
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {leaveTypeName(types, application.leave_type_id)}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {formatLeaveDate(application.start_date)} to {formatLeaveDate(application.end_date)} - {days} working day
              {days === 1 ? '' : 's'}
            </p>
          </div>
          <LeaveStatusChip status={application.status} />
        </div>

        {error ? <div className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</div> : null}

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Applicant" value={application.user_id_user?.full_name ?? (isMine ? 'You' : '-')} />
          <Field label="Applied on" value={formatLeaveDate(application.created_at)} />
          <Field label="Reason" value={application.reason} />
          <Field
            label="Decision"
            value={
              application.approved_at
                ? `${application.status} by ${application.approved_by_id_user?.full_name ?? application.approved_by_role ?? 'an approver'} on ${formatLeaveDate(application.approved_at)}`
                : 'Awaiting a decision'
            }
          />
          {application.approval_remark ? <Field label="Approver remark" value={application.approval_remark} /> : null}
          {application.cancellation_reason ? (
            <Field label="Cancellation reason" value={application.cancellation_reason} />
          ) : null}
        </dl>

        {application.attachment_url ? (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Supporting document
            </p>
            <a
              href={application.attachment_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block break-all text-sm text-green-700 hover:underline"
            >
              {application.attachment_url}
            </a>
          </div>
        ) : null}

        {canWithdraw || canHrCancel ? (
          <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            {canWithdraw ? (
              <Button type="button" variant="outline" disabled={cancelMutation.isPending} onClick={withdraw}>
                {cancelMutation.isPending ? 'Withdrawing...' : 'Withdraw Application'}
              </Button>
            ) : null}
            {canHrCancel ? (
              <Button type="button" variant="destructive" onClick={() => setHrCancelOpen(true)}>
                Cancel Approved Leave
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <HrCancelDialog application={hrCancelOpen ? application : null} onClose={() => setHrCancelOpen(false)} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{value}</dd>
    </div>
  );
}
