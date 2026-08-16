'use client';

import { useState } from 'react';
import type { OutcomeType, ProjectOutcome } from '@/api/projects';
import { useCreateOutcome } from '@/hooks/useProjects';
import { outcomeSchema } from '@/lib/projectValidation';
import { Button } from '@/components/ui/button';
import { fmtDateTime, userName } from '@/components/projects/ProjectMeta';
import { FlaskConical, Trophy, XOctagon } from 'lucide-react';

/**
 * TRY, FAILURE and OUTCOME each get their own button, their own prompt and their
 * own treatment in the log. Deliberately not one form with a type dropdown:
 * failures being first-class is the point of this record.
 */
const entryKinds = {
  TRY: {
    label: 'Try',
    button: 'Log a Try',
    prompt: 'What was attempted?',
    icon: FlaskConical,
    trigger: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
    card: 'border-l-4 border-l-blue-400 bg-blue-50/40',
    chip: 'bg-blue-100 text-blue-700',
    iconColor: 'text-blue-600',
  },
  FAILURE: {
    label: 'Failure',
    button: 'Log a Failure',
    prompt: 'What did not work, and why?',
    icon: XOctagon,
    trigger: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
    card: 'border-l-4 border-l-red-400 bg-red-50/40',
    chip: 'bg-red-100 text-red-700',
    iconColor: 'text-red-600',
  },
  OUTCOME: {
    label: 'Outcome',
    button: 'Log an Outcome',
    prompt: 'What result was achieved?',
    icon: Trophy,
    trigger: 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100',
    card: 'border-l-4 border-l-green-500 bg-green-50/40',
    chip: 'bg-green-100 text-green-700',
    iconColor: 'text-green-600',
  },
} as const;

const kinds = Object.keys(entryKinds) as OutcomeType[];

export function OutcomesPanel({
  projectId,
  outcomes,
  isLoading,
  canParticipate,
}: {
  projectId: string;
  outcomes: ProjectOutcome[];
  isLoading?: boolean;
  canParticipate: boolean;
}) {
  const [entryType, setEntryType] = useState<OutcomeType | null>(null);
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const createOutcome = useCreateOutcome(projectId);

  const counts = kinds.map((kind) => ({ kind, count: outcomes.filter((entry) => entry.entry_type === kind).length }));

  const submit = async () => {
    if (!entryType) return;
    const parsed = outcomeSchema.safeParse({ entryType, content: content.trim() });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Write what happened');
      return;
    }
    setError(null);
    await createOutcome.mutateAsync(parsed.data);
    setContent('');
    setEntryType(null);
  };

  if (isLoading) {
    return <div className="py-12 text-center text-gray-500">Loading entries...</div>;
  }

  const active = entryType ? entryKinds[entryType] : null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Tries, failures and outcomes</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              {counts.map(({ kind, count }) => `${count} ${entryKinds[kind].label.toLowerCase()}${count === 1 ? '' : 's'}`).join(' · ')}
            </p>
          </div>

          {canParticipate && (
            <div className="flex flex-wrap gap-2">
              {kinds.map((kind) => {
                const kindMeta = entryKinds[kind];
                const Icon = kindMeta.icon;
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => {
                      setEntryType(entryType === kind ? null : kind);
                      setError(null);
                    }}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${kindMeta.trigger} ${
                      entryType === kind ? 'ring-2 ring-offset-1' : ''
                    }`}
                  >
                    <Icon size={16} />
                    {kindMeta.button}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {active && entryType && (
          <div className={`mt-4 rounded-lg p-4 ${active.card}`}>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">{active.prompt}</label>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={4}
              autoFocus
              className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            />
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEntryType(null)}>
                Cancel
              </Button>
              <Button
                onClick={submit}
                disabled={createOutcome.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {createOutcome.isPending ? 'Saving...' : `Save ${active.label}`}
              </Button>
            </div>
          </div>
        )}
      </div>

      {outcomes.length === 0 ? (
        <div className="rounded-lg bg-gray-50 py-16 text-center">
          <p className="text-gray-500">Nothing logged yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {outcomes.map((entry) => {
            const kindMeta = entryKinds[entry.entry_type] ?? entryKinds.TRY;
            const Icon = kindMeta.icon;
            return (
              <div key={entry.id} className={`rounded-xl border border-slate-200 p-4 ${kindMeta.card}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className={kindMeta.iconColor} />
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${kindMeta.chip}`}>
                      {kindMeta.label}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">{fmtDateTime(entry.created_at)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-900">{entry.content}</p>
                <p className="mt-2 text-xs text-gray-500">Logged by {userName(entry.logged_by_id_user)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
