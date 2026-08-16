'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CreateRndReportPayload, RndReport } from '@/api/rnd';

type Props = {
  open: boolean;
  /** Present for an edit, absent for a new submission. */
  report?: RndReport | null;
  categories: string[];
  onClose: () => void;
  onSubmit: (values: CreateRndReportPayload) => Promise<void>;
  isPending?: boolean;
  error?: string | null;
};

const EMPTY: CreateRndReportPayload = {
  category: '',
  product_area: '',
  findings: '',
  recommendation: '',
  supporting_data: '',
};

/**
 * Four structured fields plus the category, for both submitting and correcting.
 * The category is fixed once submitted: moving a report into another category
 * moves it into a thread other people read.
 */
export function RndReportFormDialog({
  open,
  report,
  categories,
  onClose,
  onSubmit,
  isPending,
  error,
}: Props) {
  const [values, setValues] = useState<CreateRndReportPayload>(EMPTY);

  useEffect(() => {
    if (!open) return;
    setValues(
      report
        ? {
            category: report.category,
            product_area: report.product_area,
            findings: report.findings,
            recommendation: report.recommendation,
            supporting_data: report.supporting_data ?? '',
          }
        : EMPTY,
    );
  }, [open, report]);

  if (!open) return null;

  const set = (field: keyof CreateRndReportPayload) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setValues((current) => ({ ...current, [field]: event.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-full w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {report ? 'Edit Report' : 'Submit Report'}
            </h2>
            <p className="text-sm text-slate-500">
              {report
                ? 'Corrections are allowed until the MD office reads this report.'
                : 'Structured so reports in the same category stay comparable.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        <form
          className="flex-1 space-y-4 overflow-y-auto p-5"
          onSubmit={async (event) => {
            event.preventDefault();
            await onSubmit({
              ...values,
              category: values.category.trim(),
              supporting_data: values.supporting_data?.trim() ?? '',
            });
          }}
        >
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Research category *
            </label>
            <Input
              value={values.category}
              onChange={set('category')}
              list="rnd-category-options"
              placeholder="packaging, pricing, shelf life..."
              maxLength={100}
              required
              disabled={Boolean(report)}
            />
            <datalist id="rnd-category-options">
              {categories.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
            <p className="mt-1 text-xs text-slate-500">
              {report
                ? 'The category cannot be changed after submission.'
                : 'Pick an existing thread or name a new one.'}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Product or area researched *
            </label>
            <Input
              value={values.product_area}
              onChange={set('product_area')}
              maxLength={255}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Findings *
            </label>
            <textarea
              value={values.findings}
              onChange={set('findings')}
              required
              rows={5}
              className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Recommendation *
            </label>
            <textarea
              value={values.recommendation}
              onChange={set('recommendation')}
              required
              rows={4}
              className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Supporting data
            </label>
            <textarea
              value={values.supporting_data ?? ''}
              onChange={set('supporting_data')}
              rows={4}
              placeholder="Figures, sources, sample sizes, links."
              className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-green-600 hover:bg-green-700"
              disabled={isPending}
            >
              {isPending ? 'Saving...' : report ? 'Save Changes' : 'Submit Report'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
