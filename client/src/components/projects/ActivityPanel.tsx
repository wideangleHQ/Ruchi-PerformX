'use client';

import type { ActivityLogEntry } from '@/api/projects';
import { Chip, fmtDateTime, userName } from '@/components/projects/ProjectMeta';

const actionChip: Record<string, string> = {
  MEMBER: 'bg-blue-100 text-blue-700',
  STATUS: 'bg-purple-100 text-purple-700',
  CHECKLIST: 'bg-green-100 text-green-700',
  DEADLINE: 'bg-amber-100 text-amber-800',
  MILESTONE: 'bg-indigo-100 text-indigo-700',
  OUTCOME: 'bg-orange-100 text-orange-700',
};

/** Immutable history. Read-only by design — nothing here is editable. */
export function ActivityPanel({ entries, isLoading }: { entries: ActivityLogEntry[]; isLoading?: boolean }) {
  if (isLoading) {
    return <div className="py-12 text-center text-gray-500">Loading activity...</div>;
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-lg bg-gray-50 py-16 text-center">
        <p className="text-gray-500">No activity recorded yet</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {entries.map((entry) => (
        <div key={entry.id} className="flex items-start justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Chip className={actionChip[entry.action_type] ?? 'bg-gray-100 text-gray-700'}>{entry.action_type}</Chip>
              <span className="text-sm text-gray-900">{entry.description}</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">{userName(entry.actor_id_user)}</p>
          </div>
          <span className="whitespace-nowrap text-xs text-gray-500">{fmtDateTime(entry.created_at)}</span>
        </div>
      ))}
    </div>
  );
}
