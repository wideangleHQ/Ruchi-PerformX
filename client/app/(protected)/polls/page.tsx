'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { usePolls } from '@/hooks/usePolls';
import { PollCard } from '@/components/dashboard/PollCard';

const filters = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'closed', label: 'Closed' },
] as const;

type FilterKey = (typeof filters)[number]['key'];

/**
 * Every poll, open and closed. The dashboard only surfaces open ones, so a poll
 * that closed on Friday had nowhere to be read on Monday.
 *
 * `GET /polls` already returns the lot newest first with the caller's own vote
 * resolved, and `PollCard` already renders a closed poll as results, so this is
 * the endpoint and the card that existed with a page around them.
 */
export default function PollsArchivePage() {
  const { user } = useAuth();
  const { data: polls = [], isLoading } = usePolls();
  const [filter, setFilter] = useState<FilterKey>('all');

  const shown = useMemo(() => {
    if (filter === 'open') return polls.filter((poll) => poll.isOpen);
    if (filter === 'closed') return polls.filter((poll) => !poll.isOpen);
    return polls;
  }, [polls, filter]);

  const openCount = polls.filter((poll) => poll.isOpen).length;

  return (
    <div>
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft size={16} />
        Back to Dashboard
      </Link>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-slate-900">
            <BarChart3 size={26} className="text-green-700" />
            Polls
          </h1>
          <p className="mt-1 text-slate-600">
            {polls.length === 0
              ? 'Nothing has been asked yet.'
              : `${polls.length} in total, ${openCount} still open.`}
          </p>
        </div>

        <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
          {filters.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                filter === item.key
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-600">Loading polls...</div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-500">
            {filter === 'closed' ? 'No poll has closed yet.' : 'No polls to show.'}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Polls are raised from the dashboard, by anybody.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {shown.map((poll) => (
            <PollCard
              key={poll.id}
              poll={poll}
              canManage={user?.id === poll.createdBy.id || user?.role === 'MD'}
            />
          ))}
        </div>
      )}
    </div>
  );
}
