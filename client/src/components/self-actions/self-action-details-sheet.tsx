'use client';

import { X } from 'lucide-react';
import { SelfAction } from '@/api/self-actions';

type Props = {
  action?: SelfAction | null;
  open: boolean;
  onClose: () => void;
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function SelfActionDetailsSheet({ action, open, onClose }: Props) {
  if (!open || !action) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40">
      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Action Details</h2>
            <p className="text-sm text-slate-500">Full record snapshot.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 p-5 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Title</p>
            <p className="mt-1 font-semibold text-slate-900">{action.title}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</p>
            <p className="mt-1 whitespace-pre-wrap text-slate-700">{action.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Priority</p>
              <p className="mt-1 text-slate-700">{action.priority}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
              <p className="mt-1 text-slate-700">{action.status}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Creator</p>
              <p className="mt-1 text-slate-700">{action.users?.full_name ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Department</p>
              <p className="mt-1 text-slate-700">{action.departments?.name ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Created</p>
              <p className="mt-1 text-slate-700">{formatDate(action.created_at)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Updated</p>
              <p className="mt-1 text-slate-700">{formatDate(action.updated_at)}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attachments</p>
            <div className="mt-2 space-y-2">
              {action.task_attachments?.length ? (
                action.task_attachments.map((file) => (
                  <a
                    key={file.id}
                    href={file.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl border border-slate-200 px-4 py-3 text-slate-700 hover:bg-slate-50"
                  >
                    <div className="font-medium">{file.file_name}</div>
                    <div className="text-xs text-slate-500">{(file.file_size_kb ?? 0).toLocaleString()} KB</div>
                  </a>
                ))
              ) : (
                <p className="text-slate-500">No attachments.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
