'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { KpiPayload, ProjectKpi } from '@/api/projects';
import { useCreateKpi, useUpdateKpi } from '@/hooks/useProjects';
import { compactPayload, kpiSchema, type KpiFormData } from '@/lib/projectValidation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Chip } from '@/components/projects/ProjectMeta';
import { Plus } from 'lucide-react';

const kpiChip: Record<string, string> = {
  ON_TARGET: 'bg-green-100 text-green-700',
  BEHIND: 'bg-amber-100 text-amber-800',
  MISSED: 'bg-red-100 text-red-700',
  MET: 'bg-green-100 text-green-700',
};

/** Read-only rows, reused by the overview so KPI performance needs no extra tab. */
export function KpiRows({ kpis }: { kpis: ProjectKpi[] }) {
  if (kpis.length === 0) {
    return <p className="text-sm text-gray-500">No KPIs set for this project</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {['Metric', 'Target', 'Actual', 'Status'].map((column) => (
              <th
                key={column}
                className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {kpis.map((kpi) => (
            <tr key={kpi.id}>
              <td className="px-3 py-2 font-medium text-gray-900">{kpi.metric}</td>
              <td className="px-3 py-2 text-gray-600">{kpi.target ?? '—'}</td>
              <td className="px-3 py-2 text-gray-600">{kpi.actual ?? '—'}</td>
              <td className="px-3 py-2">
                {kpi.status ? (
                  <Chip className={kpiChip[kpi.status] ?? 'bg-gray-100 text-gray-700'}>
                    {kpi.status.replace(/_/g, ' ')}
                  </Chip>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KpisPanel({
  projectId,
  kpis,
  isLoading,
  canManage,
}: {
  projectId: string;
  kpis: ProjectKpi[];
  isLoading?: boolean;
  canManage: boolean;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const createKpi = useCreateKpi(projectId);
  const updateKpi = useUpdateKpi(projectId);

  const form = useForm<KpiFormData>({
    resolver: zodResolver(kpiSchema),
    defaultValues: { metric: '', target: '', actual: '', status: '' },
  });

  const onAdd = async (values: KpiFormData) => {
    await createKpi.mutateAsync(compactPayload(values) as KpiPayload);
    form.reset();
    setShowAdd(false);
  };

  if (isLoading) {
    return <div className="py-12 text-center text-gray-500">Loading KPIs...</div>;
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button
            variant={showAdd ? 'outline' : 'default'}
            className={showAdd ? '' : 'gap-2 bg-green-600 hover:bg-green-700'}
            onClick={() => setShowAdd(!showAdd)}
          >
            {showAdd ? (
              'Cancel'
            ) : (
              <>
                <Plus size={16} />
                Add KPI
              </>
            )}
          </Button>
        </div>
      )}

      {showAdd && canManage && (
        <form onSubmit={form.handleSubmit(onAdd)} className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600">Metric</label>
              <Input {...form.register('metric')} placeholder="What is being measured?" />
              {form.formState.errors.metric && (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.metric.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Target</label>
              <Input {...form.register('target')} placeholder="e.g. 20% uplift" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Actual</label>
              <Input {...form.register('actual')} placeholder="Leave blank until measured" />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={createKpi.isPending} className="bg-green-600 hover:bg-green-700">
              {createKpi.isPending ? 'Adding...' : 'Add KPI'}
            </Button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-4">
        <KpiRows kpis={kpis} />
      </div>

      {canManage && kpis.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-900">Record actuals</h3>
          <div className="mt-3 space-y-2">
            {kpis.map((kpi) => (
              <KpiActualRow
                key={kpi.id}
                kpi={kpi}
                onSave={(payload) => updateKpi.mutate({ kpiId: kpi.id, payload })}
                isPending={updateKpi.isPending}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiActualRow({
  kpi,
  onSave,
  isPending,
}: {
  kpi: ProjectKpi;
  onSave: (payload: Partial<KpiPayload>) => void;
  isPending: boolean;
}) {
  const [actual, setActual] = useState(kpi.actual ?? '');
  const [status, setStatus] = useState(kpi.status ?? '');

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="min-w-[160px] flex-1 text-sm text-gray-700">{kpi.metric}</span>
      <Input
        value={actual}
        onChange={(event) => setActual(event.target.value)}
        placeholder="Actual"
        className="max-w-[160px]"
      />
      <select
        value={status}
        onChange={(event) => setStatus(event.target.value)}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="">No status</option>
        <option value="ON_TARGET">On target</option>
        <option value="BEHIND">Behind</option>
        <option value="MET">Met</option>
        <option value="MISSED">Missed</option>
      </select>
      <Button
        type="button"
        variant="outline"
        disabled={isPending || (actual === (kpi.actual ?? '') && status === (kpi.status ?? ''))}
        onClick={() => onSave({ actual, status })}
      >
        Save
      </Button>
    </div>
  );
}
