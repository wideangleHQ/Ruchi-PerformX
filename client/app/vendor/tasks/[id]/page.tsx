'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarClock, Paperclip } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { VendorAction, VendorTaskStatus } from '@/api/vendorPortal';
import { useSendVendorMessage, useVendorTask, useVendorTaskStatus } from '@/hooks/useVendorPortal';

/**
 * The task, its description, attachments, the message thread, and the status
 * actions a vendor has. No department, no assignee history, no internal notes:
 * the endpoint does not return them and this screen must not grow a place to
 * put them.
 */

/** Mirrors the four vendor rows of `TRANSITIONS`. The server is still the authority. */
const ACTIONS: { action: VendorAction; label: string; from: VendorTaskStatus[]; needsReason?: boolean }[] = [
  { action: 'ACCEPTED', label: 'Accept', from: ['CREATED', 'ASSIGNED'] },
  { action: 'IN_PROGRESS', label: 'Start work', from: ['CREATED', 'ASSIGNED', 'ACCEPTED'] },
  { action: 'COMPLETED', label: 'Mark complete', from: ['IN_PROGRESS'] },
  {
    action: 'REJECTED',
    label: 'Reject',
    from: ['CREATED', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'],
    needsReason: true,
  },
];

const fmt = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function VendorTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: task, isLoading, isError } = useVendorTask(id);
  const transition = useVendorTaskStatus(id);
  const sendMessage = useSendVendorMessage();
  const [reason, setReason] = useState('');
  const [draft, setDraft] = useState('');

  if (isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-slate-200 bg-white">
        <p className="text-sm font-medium text-slate-500">Loading task...</p>
      </div>
    );
  }

  if (isError || !task) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50">
        <p className="text-sm font-medium text-red-700">This task is not available to you.</p>
        <Link href="/vendor" className="text-sm font-medium text-green-700 underline">
          Back to your portal
        </Link>
      </div>
    );
  }

  const status = (task.status ?? 'CREATED') as VendorTaskStatus;
  const available = ACTIONS.filter((a) => a.from.includes(status));

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/vendor"
        className="inline-flex w-fit items-center gap-2 text-sm font-medium text-slate-500 hover:text-green-700"
      >
        <ArrowLeft size={16} />
        Back
      </Link>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <span className="inline-flex rounded-xl bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
          {status.replace('_', ' ')}
        </span>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{task.title}</h1>
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500">
          <CalendarClock size={14} />
          Due {fmt(task.due_date)}
        </p>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {task.description}
        </p>
      </div>

      {task.attachments.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-3 text-lg font-bold text-slate-900">Attachments</h2>
          <ul className="flex flex-col gap-2">
            {task.attachments.map((file) => (
              <li key={file.id}>
                <a
                  href={file.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-green-700 hover:underline"
                >
                  <Paperclip size={14} />
                  {file.file_name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {available.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-3 text-lg font-bold text-slate-900">Update status</h2>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (required to reject)"
            className="mb-3 rounded-xl"
          />
          <div className="flex flex-wrap gap-2">
            {available.map(({ action, label, needsReason }) => (
              <Button
                key={action}
                variant={action === 'REJECTED' ? 'destructive' : 'default'}
                className={action === 'REJECTED' ? '' : 'bg-green-700 text-white hover:bg-green-800'}
                disabled={transition.isPending || (!!needsReason && !reason.trim())}
                onClick={() =>
                  transition.mutate(
                    { status: action, ...(reason.trim() ? { reason: reason.trim() } : {}) },
                    { onSuccess: () => setReason('') },
                  )
                }
              >
                {label}
              </Button>
            ))}
          </div>
          {transition.isError && (
            <p className="mt-3 text-sm font-medium text-red-700">
              That change was not accepted. Refresh and try again.
            </p>
          )}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-lg font-bold text-slate-900">Messages</h2>
        <div className="flex flex-col gap-3">
          {task.messages.length === 0 && <p className="text-sm text-slate-500">No messages yet.</p>}
          {task.messages.map((m) => (
            <div key={m.id} className={m.from_vendor ? 'text-right' : ''}>
              <p className="text-xs font-medium text-slate-400">
                {m.author_name} · {fmt(m.created_at)}
              </p>
              <p
                className={`mt-1 inline-block rounded-xl px-3 py-2 text-sm ${
                  m.from_vendor ? 'bg-green-50 text-green-900' : 'bg-slate-100 text-slate-800'
                }`}
              >
                {m.content}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message your RUCHI contact"
            className="min-h-[44px] flex-1 rounded-xl"
          />
          <Button
            className="bg-green-700 text-white hover:bg-green-800"
            disabled={!draft.trim() || sendMessage.isPending}
            onClick={() => sendMessage.mutate(draft.trim(), { onSuccess: () => setDraft('') })}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
