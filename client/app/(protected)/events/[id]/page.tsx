'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, BarChart3, Paperclip, Plus, Trash2, X } from 'lucide-react';
import {
  useAddCoordinator,
  useCreateExpense,
  useDeleteExpense,
  useEvent,
  useRemoveCoordinator,
  useUpdateEvent,
} from '@/hooks/useEvents';
import { useUsers } from '@/hooks/useQueries';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EventStatus } from '@/api/events';
import { formatDate, formatMoney, statusTone } from '@/components/events/format';

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const { data: event, isLoading } = useEvent(id);
  const { data: users } = useUsers({ limit: 200 });
  const updateEvent = useUpdateEvent(id);
  const addCoordinator = useAddCoordinator(id);
  const removeCoordinator = useRemoveCoordinator(id);
  const createExpense = useCreateExpense(id);
  const deleteExpense = useDeleteExpense(id);

  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [newCoordinator, setNewCoordinator] = useState('');

  if (isLoading || !event) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        {isLoading ? 'Loading event...' : 'Event not found.'}
      </div>
    );
  }

  const isCreator = user?.id === event.created_by_id;
  const isMd = user?.role === 'MD';
  const canManage =
    isMd || isCreator || event.coordinators.some((coordinator) => coordinator.user_id === user?.id);
  const unassigned = (users?.data ?? []).filter(
    (person) => !event.coordinators.some((coordinator) => coordinator.user_id === person.id),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/events" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-green-700">
            <ArrowLeft size={16} />
            All events
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">{event.name}</h1>
          <p className="mt-1 text-gray-500">
            {formatDate(event.event_date)}
            {event.venue ? ` at ${event.venue}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[event.status]}`}>
            {event.status}
          </span>
          <Link href={`/events/${id}/budget`}>
            <Button className="gap-2 bg-green-700 hover:bg-green-800">
              <BarChart3 size={18} />
              Budget Report
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Estimated Budget</h2>
          <p className="mt-2 text-2xl font-bold text-slate-900">{formatMoney(event.budget_estimated)}</p>

          {canManage ? (
            <form
              className="mt-4 flex gap-2"
              onSubmit={(submitted) => {
                submitted.preventDefault();
                const next = new FormData(submitted.currentTarget).get('budgetEstimated');
                if (typeof next === 'string' && next.trim()) {
                  updateEvent.mutate({ budgetEstimated: next.trim() });
                  submitted.currentTarget.reset();
                }
              }}
            >
              <Input name="budgetEstimated" type="number" min="0" step="0.01" placeholder="Revise estimate" />
              <Button type="submit" variant="outline" disabled={updateEvent.isPending}>
                Save
              </Button>
            </form>
          ) : null}

          {canManage ? (
            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
              <select
                value={event.status}
                onChange={(changed) => updateEvent.mutate({ status: changed.target.value as EventStatus })}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none"
              >
                <option value="PLANNED">PLANNED</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Coordinators</h2>

          <div className="mt-3 flex flex-wrap gap-2">
            {event.coordinators.length ? (
              event.coordinators.map((coordinator) => (
                <span
                  key={coordinator.id}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
                >
                  {coordinator.user_id_user?.full_name ?? 'Unknown user'}
                  {isMd || isCreator ? (
                    <button
                      type="button"
                      onClick={() => removeCoordinator.mutate(coordinator.user_id)}
                      className="text-slate-400 hover:text-rose-600"
                      title="Remove coordinator"
                    >
                      <X size={14} />
                    </button>
                  ) : null}
                </span>
              ))
            ) : (
              <p className="text-sm text-slate-500">Nobody is coordinating this yet.</p>
            )}
          </div>

          {isMd || isCreator ? (
            <div className="mt-4 flex gap-2">
              <select
                value={newCoordinator}
                onChange={(changed) => setNewCoordinator(changed.target.value)}
                className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none"
              >
                <option value="">Add a coordinator...</option>
                {unassigned.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.fullName}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                disabled={!newCoordinator || addCoordinator.isPending}
                onClick={() => {
                  addCoordinator.mutate(newCoordinator);
                  setNewCoordinator('');
                }}
              >
                <Plus size={16} />
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">Expense Log</h2>
          <p className="text-sm text-slate-500">Every rupee spent, with the receipt attached to it.</p>
        </div>

        {canManage ? (
          <form
            className="flex flex-wrap items-end gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-4"
            onSubmit={async (submitted) => {
              submitted.preventDefault();
              // Held before the await: currentTarget is gone by the time the
              // upload resolves, and the file input only clears via reset().
              const form = submitted.currentTarget;
              await createExpense.mutateAsync({ item, amount, receipt });
              setItem('');
              setAmount('');
              setReceipt(null);
              form.reset();
            }}
          >
            <div className="min-w-[220px] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">Item *</label>
              <Input value={item} onChange={(changed) => setItem(changed.target.value)} required maxLength={255} />
            </div>
            <div className="w-40">
              <label className="mb-1 block text-xs font-medium text-slate-600">Amount *</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(changed) => setAmount(changed.target.value)}
                required
              />
            </div>
            <div className="min-w-[220px]">
              <label className="mb-1 block text-xs font-medium text-slate-600">Receipt</label>
              <Input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                onChange={(changed) => setReceipt(changed.target.files?.[0] ?? null)}
              />
            </div>
            <Button type="submit" className="bg-green-700 hover:bg-green-800" disabled={createExpense.isPending}>
              {createExpense.isPending ? 'Saving...' : 'Log Expense'}
            </Button>
          </form>
        ) : null}

        {!event.expenses.length ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">Nothing logged against this event yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['Item', 'Amount', 'Receipt', 'Logged By', 'Logged On', ''].map((head) => (
                    <th key={head} className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {event.expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-4 font-medium text-slate-900">{expense.item}</td>
                    <td className="whitespace-nowrap px-5 py-4 tabular-nums text-slate-900">
                      {formatMoney(expense.amount)}
                    </td>
                    <td className="px-5 py-4">
                      {expense.receipt_url ? (
                        <a
                          href={expense.receipt_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-green-700 hover:underline"
                        >
                          <Paperclip size={14} />
                          View
                        </a>
                      ) : (
                        <span className="text-slate-400">None</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{expense.logged_by_id_user?.full_name ?? '-'}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">{formatDate(expense.created_at)}</td>
                    <td className="px-5 py-4">
                      {isMd || expense.logged_by_id === user?.id ? (
                        <Button
                          variant="destructive"
                          size="icon-sm"
                          title="Delete expense"
                          disabled={deleteExpense.isPending}
                          onClick={() => deleteExpense.mutate(expense.id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
