'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  ClipboardList,
  FolderKanban,
  MessageSquare,
  PackageCheck,
  Send,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  useSendVendorMessage,
  useSubmitDeliverable,
  useVendorDashboard,
} from '@/hooks/useVendorPortal';

const STATUS_ORDER = ['ASSIGNED', 'CREATED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'];

const statusTone: Record<string, string> = {
  CREATED: 'bg-slate-100 text-slate-700',
  ASSIGNED: 'bg-amber-50 text-amber-700',
  ACCEPTED: 'bg-blue-50 text-blue-700',
  IN_PROGRESS: 'bg-green-50 text-green-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-rose-50 text-rose-700',
};

const fmt = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function VendorDashboardPage() {
  const { data, isLoading, isError } = useVendorDashboard();
  const submit = useSubmitDeliverable();
  const sendMessage = useSendVendorMessage();
  const [draft, setDraft] = useState('');

  if (isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-slate-200 bg-white">
        <p className="text-sm font-medium text-slate-500">Loading your portal...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-red-200 bg-red-50">
        <p className="text-sm font-medium text-red-700">
          We could not load your portal. If this keeps happening, contact your RUCHI point of contact.
        </p>
      </div>
    );
  }

  const groups = STATUS_ORDER.filter((s) => (data.tasksByStatus[s] ?? []).length > 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Your work with RUCHI</h1>
        <p className="mt-1 text-sm text-slate-500">
          Everything assigned to you, and nothing else.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Assigned tasks', value: data.counts.tasks, icon: ClipboardList },
          { label: 'Projects', value: data.counts.projects, icon: FolderKanban },
          { label: 'Deliverables due', value: data.counts.deliverablesPending, icon: PackageCheck },
          { label: 'Messages', value: data.counts.messages, icon: MessageSquare },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-700">
              <Icon size={20} />
            </div>
            <p className="text-2xl font-bold tracking-tight text-slate-900">{value}</p>
            <p className="text-sm text-slate-500">{label}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-slate-900">Tasks</h2>
        {groups.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            No tasks are assigned to you right now.
          </p>
        )}
        {groups.map((status) => (
          <div key={status} className="flex flex-col gap-2">
            <span
              className={`inline-flex w-fit rounded-xl px-2.5 py-1 text-xs font-semibold ${statusTone[status] ?? 'bg-slate-100 text-slate-700'}`}
            >
              {status.replace('_', ' ')} · {(data.tasksByStatus[status] ?? []).length}
            </span>
            <div className="grid gap-3 sm:grid-cols-2">
              {(data.tasksByStatus[status] ?? []).map((task) => (
                <Link
                  key={task.id}
                  href={`/vendor/tasks/${task.id}`}
                  className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-green-300"
                >
                  <p className="font-semibold text-slate-900">{task.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{task.description}</p>
                  <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <CalendarClock size={14} />
                    Due {fmt(task.due_date)}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-slate-900">Projects</h2>
        {data.projects.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            No projects are assigned to you.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.projects.map((project) => (
              <div key={project.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-medium text-slate-400">{project.project_code}</p>
                <p className="font-semibold text-slate-900">{project.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">{project.objective}</p>
                <p className="mt-3 text-xs font-medium text-slate-500">Deadline {fmt(project.deadline)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-slate-900">Deliverables</h2>
        {data.deliverables.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            You have no deliverables.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {data.deliverables.map((d) => (
              <div
                key={d.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-900">{d.name}</p>
                  <p className="text-sm text-slate-500">
                    Due {fmt(d.due_date)} · {d.status.replace('_', ' ')}
                  </p>
                </div>
                {(d.status === 'PENDING' || d.status === 'IN_PROGRESS' || d.status === 'OVERDUE') && (
                  <Button
                    className="bg-green-700 text-white hover:bg-green-800"
                    disabled={submit.isPending}
                    onClick={() => submit.mutate({ id: d.id })}
                  >
                    Submit
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-slate-900">Messages</h2>
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
          {data.messages.length === 0 && (
            <p className="text-sm text-slate-500">No messages yet.</p>
          )}
          {data.messages.map((m) => (
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
          <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row">
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
              <Send size={16} />
              Send
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
