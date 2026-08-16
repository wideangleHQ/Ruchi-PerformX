'use client';

import { useState } from 'react';
import { Check, Loader2, Lock, Trash2, Users } from 'lucide-react';
import type { Poll } from '@/api/polls';
import { useClosePoll, useDeletePoll, useVotePoll } from '@/hooks/usePolls';

interface PollCardProps {
  poll: Poll;
  /** Creator or MD. The server enforces this too; this only hides the controls. */
  canManage?: boolean;
}

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

const closingLabel = (poll: Poll) => {
  if (!poll.isOpen) return 'Closed';

  const msLeft = new Date(poll.closesAt).getTime() - Date.now();
  const hoursLeft = Math.ceil(msLeft / 3_600_000);
  if (hoursLeft <= 1) return 'Closes within the hour';
  if (hoursLeft < 24) return `Closes in ${hoursLeft} hours`;

  const daysLeft = Math.ceil(hoursLeft / 24);
  return daysLeft === 1 ? 'Closes tomorrow' : `Closes in ${daysLeft} days`;
};

export function PollCard({ poll, canManage = false }: PollCardProps) {
  const vote = useVotePoll();
  const closePoll = useClosePoll();
  const deletePoll = useDeletePoll();
  const [changing, setChanging] = useState(false);

  const hasVoted = poll.myVoteOptionId !== null;
  // Options are buttons until you have voted, then results. "Change vote" puts
  // the buttons back rather than sending you somewhere else.
  const showOptions = poll.isOpen && (!hasVoted || changing);

  const submitVote = async (optionId: string) => {
    await vote.mutateAsync({ id: poll.id, optionId });
    setChanging(false);
  };

  return (
    <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-bold leading-snug text-slate-900">
            {poll.question}
          </h3>
          {/* Polls are not anonymous. The name travels with the question. */}
          <div className="mt-2 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-700 text-[10px] font-bold text-white">
              {initials(poll.createdBy.fullName) || '?'}
            </span>
            <span className="truncate text-sm text-slate-500">
              Asked by{' '}
              <span className="font-semibold text-slate-700">
                {poll.createdBy.fullName}
              </span>
            </span>
          </div>
        </div>

        {canManage ? (
          <div className="flex shrink-0 items-center gap-1">
            {poll.isOpen ? (
              <button
                type="button"
                onClick={() => closePoll.mutate(poll.id)}
                disabled={closePoll.isPending}
                title="Close this poll now"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
              >
                <Lock size={13} />
                Close
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => deletePoll.mutate(poll.id)}
              disabled={deletePoll.isPending}
              title="Delete this poll"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 p-1.5 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ) : null}
      </header>

      <div className="mt-5 flex flex-col gap-2">
        {showOptions
          ? poll.options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => submitVote(option.id)}
                disabled={vote.isPending}
                aria-pressed={option.id === poll.myVoteOptionId}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:border-green-600 hover:bg-green-50 hover:text-green-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="min-w-0 truncate">{option.label}</span>
                {vote.isPending && vote.variables?.optionId === option.id ? (
                  <Loader2 size={14} className="shrink-0 animate-spin text-green-700" />
                ) : null}
              </button>
            ))
          : poll.options.map((option) => {
              const isMine = option.id === poll.myVoteOptionId;

              return (
                <div
                  key={option.id}
                  className={`relative overflow-hidden rounded-xl border px-4 py-3 ${
                    isMine ? 'border-green-600 bg-green-50/40' : 'border-slate-200'
                  }`}
                >
                  <div
                    aria-hidden
                    className={`absolute inset-y-0 left-0 transition-all duration-500 ${
                      isMine ? 'bg-green-100' : 'bg-slate-100'
                    }`}
                    style={{ width: `${option.percent}%` }}
                  />
                  <div
                    role="progressbar"
                    aria-label={option.label}
                    aria-valuenow={option.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="relative flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {isMine ? (
                        <Check size={14} className="shrink-0 text-green-700" />
                      ) : null}
                      <span
                        className={`truncate ${isMine ? 'font-semibold text-green-800' : 'font-medium text-slate-700'}`}
                      >
                        {option.label}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold text-slate-600 tabular-nums">
                      {option.percent}%
                      <span className="ml-2 font-normal text-slate-400">
                        {option.votes}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
      </div>

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium text-slate-500">
          <Users size={13} />
          {poll.totalVotes} {poll.totalVotes === 1 ? 'vote' : 'votes'}
          <span className="text-slate-300">.</span>
          <span className={poll.isOpen ? 'text-slate-500' : 'font-semibold text-slate-400'}>
            {closingLabel(poll)}
          </span>
        </span>

        {poll.isOpen && hasVoted ? (
          <button
            type="button"
            onClick={() => setChanging((current) => !current)}
            className="font-semibold text-green-700 underline-offset-4 hover:underline"
          >
            {changing ? 'See results' : 'Change vote'}
          </button>
        ) : null}
      </footer>

      {vote.isError ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          Your vote did not go through. Try again.
        </p>
      ) : null}
    </article>
  );
}
