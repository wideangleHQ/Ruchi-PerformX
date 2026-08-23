'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { remainingDays } from '@/api/leave';
import { useApplyLeave, useHolidays, useLeaveBalance, useLeaveTypes } from '@/hooks/useLeave';
import { ApplyLeaveFormData, applyLeaveSchema, computeLeaveDays, formatLeaveDate } from '@/lib/leaveValidation';

/** The API returns every submission failure at once, so it can be an array. */
function errorMessages(error: unknown): string[] {
  const message = (error as any)?.response?.data?.message;
  if (Array.isArray(message)) return message;
  if (typeof message === 'string') return [message];
  return ['Failed to submit the application'];
}

const yearOf = (value: string) => Number(value.slice(0, 4)) || new Date().getFullYear();

export function ApplyLeaveForm() {
  const router = useRouter();
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const { data: types = [] } = useLeaveTypes();
  const { data: balances = [] } = useLeaveBalance();
  const applyMutation = useApplyLeave();

  const form = useForm<ApplyLeaveFormData>({
    resolver: zodResolver(applyLeaveSchema),
    defaultValues: { leave_type_id: '', start_date: '', end_date: '', reason: '' },
  });

  const leaveTypeId = form.watch('leave_type_id');
  const startDate = form.watch('start_date');
  const endDate = form.watch('end_date');

  // A range across new year needs both calendars; identical years dedupe in the cache.
  const { data: startYearHolidays = [] } = useHolidays(yearOf(startDate || ''));
  const { data: endYearHolidays = [] } = useHolidays(yearOf(endDate || startDate || ''));

  const selectedType = types.find((type) => type.id === leaveTypeId) ?? null;
  const balance = balances.find((item) => item.leave_type_id === leaveTypeId) ?? null;
  const remaining = balance ? remainingDays(balance) : null;

  // Optional holidays are the employee's to take or not, so they still count as working days.
  const breakdown = useMemo(
    () =>
      computeLeaveDays(
        startDate,
        endDate,
        [...startYearHolidays, ...endYearHolidays].filter((holiday) => !holiday.isOptional),
      ),
    [startDate, endDate, startYearHolidays, endYearHolidays],
  );

  const needsProof = Boolean(selectedType?.requires_proof) && attachmentUrl.trim() === '';
  const overBalance =
    Boolean(selectedType && selectedType.is_paid && breakdown && remaining !== null && breakdown.workingDays > remaining);
  const noWorkingDays = Boolean(breakdown && breakdown.workingDays < 0.5);

  const submit = form.handleSubmit(async (values) => {
    setErrors([]);
    try {
      await applyMutation.mutateAsync({
        ...values,
        reason: values.reason.trim(),
        attachment_url: attachmentUrl.trim() || undefined,
      });
      router.push('/leave');
    } catch (error) {
      setErrors(errorMessages(error));
    }
  });

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {errors.length ? (
        <ul className="mb-6 space-y-1 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700">Leave Type</label>
          <select
            {...form.register('leave_type_id')}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Select a leave type</option>
            {types
              .filter((type) => type.is_active)
              .map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                  {type.is_paid ? '' : ' (unpaid)'}
                </option>
              ))}
          </select>
          {form.formState.errors.leave_type_id ? (
            <p className="mt-1 text-xs text-rose-600">{form.formState.errors.leave_type_id.message}</p>
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          {selectedType ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Remaining balance</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {selectedType.is_paid ? `${remaining ?? 0} days` : 'Unpaid'}
              </p>
              {selectedType.requires_proof ? (
                <p className="mt-1 text-xs text-amber-700">This type needs a supporting document.</p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-slate-500">Pick a type to see your remaining balance.</p>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700">From</label>
          <Input type="date" {...form.register('start_date')} className="mt-1" />
          {form.formState.errors.start_date ? (
            <p className="mt-1 text-xs text-rose-600">{form.formState.errors.start_date.message}</p>
          ) : null}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">To</label>
          <Input type="date" {...form.register('end_date')} min={startDate || undefined} className="mt-1" />
          {form.formState.errors.end_date ? (
            <p className="mt-1 text-xs text-rose-600">{form.formState.errors.end_date.message}</p>
          ) : null}
        </div>
      </div>

      {breakdown ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm text-slate-600">
              {breakdown.calendarDays} calendar day{breakdown.calendarDays === 1 ? '' : 's'}, minus{' '}
              {breakdown.excluded.length} non-working
            </p>
            <p className="text-lg font-bold text-green-700">
              {breakdown.workingDays} working day{breakdown.workingDays === 1 ? '' : 's'}
            </p>
          </div>

          {breakdown.excluded.length ? (
            <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
              {breakdown.excluded.map((day) => (
                <li key={day.date} className="flex items-center gap-2">
                  <CalendarOff size={13} className="text-slate-400" />
                  <span className="font-medium text-slate-700">{formatLeaveDate(day.date)}</span>
                  <span>{day.label}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {overBalance ? (
            <p className="mt-3 text-sm font-medium text-rose-700">
              That is more than your remaining {remaining} day balance.
            </p>
          ) : null}
          {noWorkingDays ? (
            <p className="mt-3 text-sm font-medium text-rose-700">
              The whole range falls on holidays or weekly offs, so there is nothing to apply for.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4">
        <label className="block text-sm font-medium text-slate-700">Reason</label>
        <textarea
          {...form.register('reason')}
          rows={3}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Why you need the leave"
        />
        {form.formState.errors.reason ? (
          <p className="mt-1 text-xs text-rose-600">{form.formState.errors.reason.message}</p>
        ) : null}
      </div>

      <div className="mt-4">
        <label htmlFor="attachment-url" className="block text-sm font-medium text-slate-700">
          Supporting document link {selectedType?.requires_proof ? '' : '(optional)'}
        </label>
        <Input
          id="attachment-url"
          type="url"
          inputMode="url"
          maxLength={500}
          placeholder="https://..."
          className="mt-1"
          value={attachmentUrl}
          onChange={(event) => setAttachmentUrl(event.target.value)}
        />
        <p className="mt-1 text-xs text-slate-500">
          Paste a link to the document. Leave stores the link, not the file.
        </p>
        {needsProof ? (
          <p className="mt-1 text-xs text-rose-600">{selectedType?.name} needs a supporting document.</p>
        ) : null}
      </div>

      <div className="mt-6 flex gap-2">
        <Button
          type="submit"
          className="bg-green-600 hover:bg-green-700"
          disabled={applyMutation.isPending || needsProof || overBalance || noWorkingDays}
        >
          {applyMutation.isPending ? 'Submitting...' : 'Submit Application'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/leave')}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
