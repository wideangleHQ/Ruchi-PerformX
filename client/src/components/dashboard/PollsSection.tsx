'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BarChart3, Loader2, Plus, Trash2, X } from 'lucide-react';
import type { Poll } from '@/api/polls';
import { useAuth } from '@/context/AuthContext';
import { useCreatePoll } from '@/hooks/usePolls';
import { useToast } from '@/hooks/useToast';
import { PollCard } from './PollCard';

interface PollsSectionProps {
  polls: Poll[];
}

const emptyOptions = ['', ''];

/** A week out, which is the deadline people pick when left to themselves. */
const defaultClosesAt = () => {
  const date = new Date(Date.now() + 7 * 24 * 3_600_000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

export function PollsSection({ polls }: PollsSectionProps) {
  const { user } = useAuth();
  const toast = useToast();
  const createPoll = useCreatePoll();

  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(emptyOptions);
  const [closesAt, setClosesAt] = useState(defaultClosesAt);

  const reset = () => {
    setQuestion('');
    setOptions(emptyOptions);
    setClosesAt(defaultClosesAt());
    setOpen(false);
  };

  const submit = async () => {
    const labels = options.map((label) => label.trim()).filter(Boolean);
    if (question.trim().length < 3 || labels.length < 2) {
      toast.error('A poll needs a question and at least two options');
      return;
    }

    try {
      await createPoll.mutateAsync({
        question: question.trim(),
        options: labels,
        closesAt: new Date(closesAt).toISOString(),
      });
      toast.success('Poll raised');
      reset();
    } catch {
      toast.error('Could not raise the poll');
    }
  };

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-green-700" />
          <h2 className="text-lg font-bold text-slate-900">Polls</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Closed polls drop off this section, so the archive is the way back to them. */}
          <Link
            href="/polls"
            className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            All polls
          </Link>
          {/* Any employee can raise one, not just management. */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-100"
          >
            <Plus size={15} />
            New poll
          </button>
        </div>
      </div>

      {polls.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-500">No open polls.</p>
          <p className="mt-1 text-sm text-slate-400">
            Ask the company something and the answers land here live.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {polls.map((poll) => (
            <PollCard
              key={poll.id}
              poll={poll}
              canManage={user?.id === poll.createdBy.id || user?.role === 'MD'}
            />
          ))}
        </div>
      )}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            onClick={reset}
            className="absolute inset-0 bg-slate-900/40"
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Raise a poll</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Everyone sees the question and your name against it.
                </p>
              </div>
              <button
                type="button"
                onClick={reset}
                className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Question
                </span>
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  maxLength={500}
                  placeholder="Where should the offsite be this year?"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
                />
              </label>

              <div>
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Options
                </span>
                <div className="space-y-2">
                  {options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        value={option}
                        onChange={(e) =>
                          setOptions((current) =>
                            current.map((o, i) => (i === index ? e.target.value : o)),
                          )
                        }
                        maxLength={255}
                        placeholder={`Option ${index + 1}`}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
                      />
                      {options.length > 2 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setOptions((current) => current.filter((_, i) => i !== index))
                          }
                          className="shrink-0 rounded-xl border border-slate-200 p-2.5 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
                {options.length < 10 ? (
                  <button
                    type="button"
                    onClick={() => setOptions((current) => [...current, ''])}
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-green-700 underline-offset-4 hover:underline"
                  >
                    <Plus size={14} />
                    Add option
                  </button>
                ) : null}
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Closes at
                </span>
                <input
                  type="datetime-local"
                  value={closesAt}
                  onChange={(e) => setClosesAt(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
                />
              </label>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={reset}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={createPoll.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-green-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800 disabled:opacity-70"
              >
                {createPoll.isPending ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : null}
                Raise poll
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
