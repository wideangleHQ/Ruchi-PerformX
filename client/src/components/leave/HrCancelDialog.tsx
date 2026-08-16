'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LeaveApplication, leaveTypeName, toDays } from '@/api/leave';
import { useHrCancelLeave, useLeaveTypes } from '@/hooks/useLeave';
import { formatLeaveDate } from '@/lib/leaveValidation';

type Props = {
  application: LeaveApplication | null;
  onClose: () => void;
};

/**
 * HR reversal of an approved application. The reason is mandatory, and the
 * balance credit is spelled out here so HR is not surprised by it afterwards.
 */
export function HrCancelDialog({ application, onClose }: Props) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const cancelMutation = useHrCancelLeave();
  const { data: types = [] } = useLeaveTypes();

  if (!application) return null;

  const days = toDays(application.days_count);
  const applicant = application.user_id_user?.full_name ?? 'the applicant';

  const submit = async () => {
    setError(null);
    try {
      await cancelMutation.mutateAsync({ id: application.id, reason: reason.trim() });
      setReason('');
      onClose();
    } catch (err) {
      setError((err as any)?.response?.data?.message || 'Failed to cancel the application');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Cancel Approved Leave</h2>
            <p className="text-sm text-slate-500">
              {applicant}, {formatLeaveDate(application.start_date)} to {formatLeaveDate(application.end_date)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error ? <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</div> : null}

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Cancelling credits <span className="font-semibold">{days}</span> day{days === 1 ? '' : 's'} back to{' '}
            {applicant}&apos;s {leaveTypeName(types, application.leave_type_id)} balance.
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Cancellation reason</label>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="The applicant sees this, so say why"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Keep Approved
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!reason.trim() || cancelMutation.isPending}
            onClick={submit}
          >
            {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Leave'}
          </Button>
        </div>
      </div>
    </div>
  );
}
