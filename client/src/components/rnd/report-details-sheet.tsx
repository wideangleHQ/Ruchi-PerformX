'use client';

import { Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RndReport } from '@/api/rnd';
import { useRndReport } from '@/hooks/useRnd';
import { formatRndDate } from '@/components/rnd/report-history';

type Props = {
  reportId: string | null;
  /** The caller's user id, to decide whether the edit button belongs here. */
  currentUserId?: string;
  onClose: () => void;
  onEdit: (report: RndReport) => void;
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-slate-700">{value}</p>
    </div>
  );
}

/**
 * Opening this is a write for MD, EA, and PA: the detail endpoint stamps
 * `md_viewed_at`, which is what ends the submitter's edit window. That is why
 * the sheet fetches by id rather than displaying the row from the list.
 */
export function RndReportDetailsSheet({
  reportId,
  currentUserId,
  onClose,
  onEdit,
}: Props) {
  const { data: report, isLoading, isError } = useRndReport(reportId);

  if (!reportId) return null;

  const canEdit =
    !!report && report.submitted_by_id === currentUserId && !report.md_viewed_at;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40">
      <div className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Research Report</h2>
            <p className="text-sm text-slate-500">
              {report ? report.category : 'Loading...'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onEdit(report)}
              >
                <Pencil size={14} className="mr-2" />
                Edit
              </Button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 text-sm">
          {isLoading ? <p className="text-slate-500">Loading report...</p> : null}
          {isError ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">
              This report is in another research thread.
            </p>
          ) : null}

          {report ? (
            <div className="space-y-5">
              <Field label="Product or area researched" value={report.product_area} />
              <Field label="Findings" value={report.findings} />
              <Field label="Recommendation" value={report.recommendation} />
              <Field
                label="Supporting data"
                value={report.supporting_data ?? '-'}
              />

              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Submitted by
                  </p>
                  <p className="mt-1 text-slate-700">
                    {report.submitted_by_id_user?.full_name ?? 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Submitted
                  </p>
                  <p className="mt-1 text-slate-700">
                    {formatRndDate(report.created_at)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Read by MD office
                  </p>
                  <p className="mt-1 text-slate-700">
                    {formatRndDate(report.md_viewed_at)}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
