'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CreateKpiRevisionPayload, Kpi } from '@/api/kpi';

export interface RevisionValues {
  new_target: string;
  new_weight: string;
  effective_from: string;
  reason: string;
}

const same = (a: string | null | undefined, b: string) =>
  a !== null && a !== undefined && a !== '' && Number(a) === Number(b);

/**
 * The body of `POST /kpis/:id/revisions`, or the reasons it cannot be sent.
 *
 * A target or weight left alone, or typed back as the value it already has, is
 * not part of the revision: the server refuses a revision that changes neither,
 * and only a quantitative KPI has a target to revise.
 */
export function buildRevisionPayload(
  kpi: Kpi,
  values: RevisionValues,
): { payload: CreateKpiRevisionPayload | null; errors: string[] } {
  const errors: string[] = [];
  const change: Partial<CreateKpiRevisionPayload> = {};

  if (values.new_target.trim()) {
    if (!Number.isFinite(Number(values.new_target))) errors.push('The new target must be a number.');
    else if (!same(kpi.target_value, values.new_target)) change.new_target = Number(values.new_target);
  }

  if (values.new_weight.trim()) {
    const weight = Number(values.new_weight);
    if (!(weight >= 0.01 && weight <= 100)) errors.push('The new weight must be between 0.01 and 100.');
    else if (!same(kpi.weight, values.new_weight)) change.new_weight = weight;
  }

  if (errors.length === 0 && Object.keys(change).length === 0) {
    errors.push('Change the target or the weight.');
  }
  if (!values.effective_from) errors.push('Say when the change takes effect.');
  if (!values.reason.trim()) errors.push('A revision needs a reason.');

  if (errors.length > 0) return { payload: null, errors };
  return {
    payload: {
      ...change,
      effective_from: values.effective_from,
      reason: values.reason.trim(),
    },
    errors,
  };
}

/**
 * Change an approved KPI's target or weight without losing the original.
 *
 * The server keeps the old values on a revision row with who changed them and
 * why, so this is the one way an approved target moves; a draft is edited
 * instead.
 */
export function KpiRevisionDialog({
  kpi,
  onClose,
  onSubmit,
  isPending,
  error,
}: {
  kpi: Kpi;
  onClose: () => void;
  onSubmit: (payload: CreateKpiRevisionPayload) => Promise<void>;
  isPending?: boolean;
  error?: string | null;
}) {
  const [values, setValues] = useState<RevisionValues>({
    new_target: '',
    new_weight: '',
    effective_from: new Date().toISOString().slice(0, 10),
    reason: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const { payload, errors } = buildRevisionPayload(kpi, values);
  const set = (field: keyof RevisionValues, value: string) =>
    setValues((current) => ({ ...current, [field]: value }));
  const quantitative = kpi.mode === 'QUANTITATIVE';

  return (
    <div
      role="dialog"
      aria-label="Revise KPI"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Revise target or weight</h2>
            <p className="text-sm text-slate-500">The original is kept in the KPI&apos;s history.</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        <form
          className="space-y-4 p-5"
          onSubmit={async (event) => {
            event.preventDefault();
            setSubmitted(true);
            if (payload) await onSubmit(payload);
          }}
        >
          {error ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          {submitted && errors.length > 0 ? (
            <ul className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            {quantitative ? (
              <div>
                <label htmlFor="rev-target" className="mb-1 block text-sm font-medium text-slate-700">
                  New target (now {Number(kpi.target_value)})
                </label>
                <Input
                  id="rev-target"
                  type="number"
                  step="any"
                  value={values.new_target}
                  onChange={(event) => set('new_target', event.target.value)}
                />
              </div>
            ) : null}
            <div>
              <label htmlFor="rev-weight" className="mb-1 block text-sm font-medium text-slate-700">
                New weight % (now {Number(kpi.weight)})
              </label>
              <Input
                id="rev-weight"
                type="number"
                step="any"
                value={values.new_weight}
                onChange={(event) => set('new_weight', event.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="rev-effective" className="mb-1 block text-sm font-medium text-slate-700">
                Effective from *
              </label>
              <Input
                id="rev-effective"
                type="date"
                value={values.effective_from}
                onChange={(event) => set('effective_from', event.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="rev-reason" className="mb-1 block text-sm font-medium text-slate-700">
                Reason *
              </label>
              <textarea
                id="rev-reason"
                rows={2}
                maxLength={500}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={values.reason}
                onChange={(event) => set('reason', event.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Record revision'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
