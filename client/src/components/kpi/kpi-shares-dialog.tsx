'use client';

import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KpiContribution, KpiContributionPayload } from '@/api/kpi';
import { useUserOptions } from '@/components/pickers';

export interface ShareRow {
  user_id: string;
  share: string;
}

/**
 * The body of `PUT /kpis/:id/contributions`, or the reasons it cannot be sent.
 *
 * The server replaces the whole set with what it is sent, so the rows are the
 * full allocation, not a change. An empty list is valid and clears it. Blank
 * rows are dropped rather than rejected, and a person listed twice is refused
 * because the server would store both and credit them twice.
 */
export function buildSharesPayload(rows: ShareRow[]): {
  payload: { contributions: KpiContributionPayload[] } | null;
  errors: string[];
  total: number;
} {
  const filled = rows.filter((row) => row.user_id || row.share.trim());
  const errors: string[] = [];
  const contributions: KpiContributionPayload[] = [];

  for (const row of filled) {
    const share = Number(row.share);
    if (!row.user_id) errors.push('Choose a person for every share.');
    else if (!row.share.trim() || !(share >= 0 && share <= 100)) {
      errors.push('Each share must be between 0 and 100.');
    } else contributions.push({ user_id: row.user_id, share });
  }

  if (new Set(contributions.map((entry) => entry.user_id)).size !== contributions.length) {
    errors.push('A person can only appear once.');
  }

  const total = contributions.reduce((sum, entry) => sum + entry.share, 0);
  if (total > 100.0001) errors.push(`Shares total ${total}%, which is more than the outcome.`);

  return {
    payload: errors.length === 0 ? { contributions } : null,
    errors: [...new Set(errors)],
    total,
  };
}

/**
 * Allocate a department or project KPI between the people who deliver it.
 *
 * An individual KPI is owned outright and has no shares, so this is only
 * offered on the other two scopes. A set that totals under 100 is allowed: the
 * rest is simply unallocated.
 */
export function KpiSharesDialog({
  current,
  onClose,
  onSubmit,
  isPending,
  error,
}: {
  current: KpiContribution[];
  onClose: () => void;
  onSubmit: (payload: { contributions: KpiContributionPayload[] }) => Promise<void>;
  isPending?: boolean;
  error?: string | null;
}) {
  const users = useUserOptions();
  const [rows, setRows] = useState<ShareRow[]>(
    current.length > 0
      ? current.map((entry) => ({ user_id: entry.user_id, share: String(Number(entry.share)) }))
      : [{ user_id: '', share: '' }],
  );
  const [submitted, setSubmitted] = useState(false);
  const { payload, errors, total } = buildSharesPayload(rows);

  const setRow = (index: number, patch: Partial<ShareRow>) =>
    setRows((list) => list.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <div
      role="dialog"
      aria-label="Edit shares"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div className="flex max-h-full w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Contribution allocation</h2>
            <p className="text-sm text-slate-500">
              Replaces the current allocation. Leave it empty to clear it.
            </p>
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
          className="flex-1 space-y-3 overflow-y-auto p-5"
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

          {rows.map((row, index) => (
            <div key={index} className="flex items-center gap-2">
              <select
                aria-label={`Person ${index + 1}`}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={row.user_id}
                onChange={(event) => setRow(index, { user_id: event.target.value })}
              >
                <option value="">Select a person</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName}
                  </option>
                ))}
              </select>
              <Input
                aria-label={`Share ${index + 1}`}
                type="number"
                step="any"
                className="w-24"
                placeholder="%"
                value={row.share}
                onChange={(event) => setRow(index, { share: event.target.value })}
              />
              <button
                type="button"
                aria-label={`Remove person ${index + 1}`}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                onClick={() => setRows((list) => list.filter((_, i) => i !== index))}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}

          <div className="flex items-center justify-between">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setRows((list) => [...list, { user_id: '', share: '' }])}
            >
              <Plus size={14} /> Add person
            </Button>
            <p className="text-sm text-slate-600">Allocated: {total}%</p>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save allocation'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
