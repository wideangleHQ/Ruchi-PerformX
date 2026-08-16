'use client';

import { useMemo } from 'react';
import { FlaskConical, Layers } from 'lucide-react';
import { RndReport } from '@/api/rnd';

type Props = {
  reports: RndReport[];
  isLoading?: boolean;
  /** MD, EA, and PA get "unread" wording; everyone else sees their own status. */
  isOversight: boolean;
  onOpen: (report: RndReport) => void;
};

export function formatRndDate(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

/**
 * History grouped by category, newest first inside each group and by most
 * recent activity between them, so the thread somebody is working in today sits
 * at the top.
 */
export function RndReportHistory({ reports, isLoading, isOversight, onOpen }: Props) {
  const groups = useMemo(() => {
    const byCategory = new Map<string, RndReport[]>();
    for (const report of reports) {
      const bucket = byCategory.get(report.category);
      if (bucket) bucket.push(report);
      else byCategory.set(report.category, [report]);
    }
    return [...byCategory.entries()]
      .map(([category, items]) => ({
        category,
        items: [...items].sort((a, b) => b.created_at.localeCompare(a.created_at)),
      }))
      .sort((a, b) =>
        (b.items[0]?.created_at ?? '').localeCompare(a.items[0]?.created_at ?? ''),
      );
  }, [reports]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Loading reports...
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <FlaskConical size={28} className="text-green-600" />
        <p className="font-semibold text-slate-900">No research yet</p>
        <p className="max-w-md text-sm text-slate-500">
          Reports appear here grouped by research category, so a thread can be read
          end to end.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => {
        const unread = group.items.filter((item) => !item.md_viewed_at).length;
        return (
          <section
            key={group.category}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-green-700" />
                <h2 className="font-semibold text-slate-900">{group.category}</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {group.items.length}
                </span>
              </div>
              {isOversight && unread > 0 ? (
                <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                  {unread} unread
                </span>
              ) : null}
            </header>

            <ul className="divide-y divide-slate-100">
              {group.items.map((report) => (
                <li key={report.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(report)}
                    className="flex w-full flex-col gap-1 px-5 py-4 text-left transition-colors hover:bg-slate-50"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">
                        {report.product_area}
                      </span>
                      {report.md_viewed_at ? null : (
                        <span className="rounded-full bg-green-600 px-2 py-0.5 text-xs font-semibold text-white">
                          {isOversight ? 'Unread' : 'Awaiting MD'}
                        </span>
                      )}
                    </div>
                    <p className="line-clamp-2 text-sm text-slate-600">
                      {report.findings}
                    </p>
                    <p className="text-xs text-slate-500">
                      {report.submitted_by_id_user?.full_name ?? 'Unknown'} ·{' '}
                      {formatRndDate(report.created_at)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
