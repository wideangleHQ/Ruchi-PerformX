'use client';

import { Eye, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SelfAction, SelfActionPriority, SelfActionStatus } from '@/api/self-actions';

type Props = {
  actions: SelfAction[];
  isLoading?: boolean;
  onView: (action: SelfAction) => void;
  onEdit: (action: SelfAction) => void;
  onDelete: (action: SelfAction) => void;
  onStatusChange: (action: SelfAction, status: SelfActionStatus) => void;
};

const priorityTone: Record<SelfActionPriority, string> = {
  LOW: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  MEDIUM: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  HIGH: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  CRITICAL: 'bg-red-50 text-red-700 ring-1 ring-red-200',
};

const statusTone: Record<SelfActionStatus, string> = {
  OPEN: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
  ONGOING: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  COMPLETED: 'bg-green-50 text-green-700 ring-1 ring-green-200',
  ABORTED: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function SelfActionsTable({
  actions,
  isLoading,
  onView,
  onEdit,
  onDelete,
  onStatusChange,
}: Props) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Loading self actions...
      </div>
    );
  }

  if (!actions.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
        No self actions found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              {['Title', 'Description', 'Priority', 'Status', 'Created By', 'Department', 'Created Date', 'Updated Date', 'Actions'].map((head) => (
                <th key={head} className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {actions.map((action) => (
              <tr key={action.id} className="hover:bg-slate-50/60">
                <td className="max-w-[220px] px-5 py-4 font-semibold text-slate-900">
                  <button type="button" className="text-left hover:text-green-700" onClick={() => onView(action)}>
                    {action.title}
                  </button>
                </td>
                <td className="max-w-[320px] px-5 py-4 text-slate-600">
                  <p className="line-clamp-2">{action.description}</p>
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${priorityTone[action.priority]}`}>
                    {action.priority}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <select
                    value={action.status}
                    onChange={(event) => onStatusChange(action, event.target.value as SelfActionStatus)}
                    className={`rounded-full border-0 px-2.5 py-1 text-xs font-semibold outline-none ${statusTone[action.status]}`}
                  >
                    <option value="OPEN">OPEN</option>
                    <option value="ONGOING">ONGOING</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="ABORTED">ABORTED</option>
                  </select>
                </td>
                <td className="px-5 py-4 text-slate-600">{action.users?.full_name ?? '-'}</td>
                <td className="px-5 py-4 text-slate-600">{action.departments?.name ?? '-'}</td>
                <td className="px-5 py-4 text-slate-600 whitespace-nowrap">{formatDate(action.created_at)}</td>
                <td className="px-5 py-4 text-slate-600 whitespace-nowrap">{formatDate(action.updated_at)}</td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="icon-sm" onClick={() => onView(action)}>
                      <Eye size={16} />
                    </Button>
                    <Button variant="outline" size="icon-sm" onClick={() => onEdit(action)}>
                      <Pencil size={16} />
                    </Button>
                    <Button variant="destructive" size="icon-sm" onClick={() => onDelete(action)}>
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
