'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Paperclip, TrendingDown, TrendingUp } from 'lucide-react';
import { useBudgetReport } from '@/hooks/useEvents';
import { formatDate, formatMoney, statusTone } from '@/components/events/format';

export default function EventBudgetPage() {
  const { id } = useParams<{ id: string }>();
  const { data: report, isLoading } = useBudgetReport(id);

  if (isLoading || !report) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        {isLoading ? 'Loading budget report...' : 'Event not found.'}
      </div>
    );
  }

  const { event, over_budget: overBudget } = report;
  const varianceTone = overBudget ? 'text-rose-600' : 'text-green-700';
  const VarianceIcon = overBudget ? TrendingUp : TrendingDown;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/events/${id}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-green-700"
        >
          <ArrowLeft size={16} />
          {event.name}
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">Budget Report</h1>
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[event.status]}`}>
            {event.status}
          </span>
        </div>
        <p className="mt-1 text-gray-500">
          {formatDate(event.event_date)}
          {event.venue ? ` at ${event.venue}` : ''}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estimated</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{formatMoney(report.estimated)}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actual</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{formatMoney(report.actual)}</p>
          <p className="mt-1 text-xs text-slate-500">
            {report.items.length} {report.items.length === 1 ? 'expense' : 'expenses'} logged
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Variance</p>
          <p className={`mt-2 flex items-center gap-2 text-2xl font-bold tabular-nums ${varianceTone}`}>
            <VarianceIcon size={22} />
            {formatMoney(report.variance)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {report.variance_pct === null
              ? 'No estimate to compare against'
              : `${report.variance_pct.replace('-', '')}% ${overBudget ? 'over' : 'under'} the estimate`}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">Itemised Spend</h2>
        </div>

        {!report.items.length ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">Nothing has been spent against this event.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['Item', 'Amount', 'Receipt', 'Logged By', 'Logged On'].map((head) => (
                    <th key={head} className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.items.map((expense) => (
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
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                <tr>
                  <td className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Total</td>
                  <td className="whitespace-nowrap px-5 py-4 font-bold tabular-nums text-slate-900">
                    {formatMoney(report.actual)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
