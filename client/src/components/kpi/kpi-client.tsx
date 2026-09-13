'use client';

import { useState } from 'react';
import { AlertTriangle, Plus, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { CreateKpiPayload } from '@/api/kpi';
import { useCreateKpi, useKpis, useMyPsScore } from '@/hooks/useKpi';
import { KpiDetailSheet } from '@/components/kpi/kpi-detail-sheet';
import { KpiFormDialog } from '@/components/kpi/kpi-form-dialog';
import {
  MODE_LABELS,
  formatNumber,
  formatPercent,
  formatValue,
  scoreBand,
  statusLabel,
  statusTone,
} from '@/components/kpi/display';

const AUTHOR_ROLES = ['MD', 'EA', 'PA', 'DEPARTMENT_CONTROLLER', 'HOD'];

function errorMessage(error: unknown) {
  const response = (error as { response?: { data?: { message?: string | string[] } } })
    .response;
  const message = response?.data?.message;
  return Array.isArray(message) ? message[0] : message || 'Something went wrong';
}

/**
 * One page for the module: the caller's PS Score at the top, the KPIs they can
 * see below it.
 *
 * The PS Score is shown on its own and never averaged with the Action Tracker
 * score. An employee can complete every task on time and still miss the target
 * their role exists to hit, and one blended number would hide which of the two
 * is the problem.
 */
export function KpiClient() {
  const { user } = useAuth();
  const canAuthor = !!user && AUTHOR_ROLES.includes(user.role);

  const { data: psScore } = useMyPsScore();
  const { data: kpis = [], isLoading } = useKpis({});
  const createKpi = useCreateKpi();

  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [openKpiId, setOpenKpiId] = useState<string | null>(null);

  const submit = async (payload: CreateKpiPayload) => {
    setFormError(null);
    try {
      await createKpi.mutateAsync(payload);
      setFormOpen(false);
    } catch (caught) {
      setFormError(errorMessage(caught));
    }
  };

  const band = psScore ? scoreBand(psScore.ps_score) : null;
  const weightGap =
    psScore && Math.abs(psScore.declared_weight - 100) > 0.05
      ? psScore.declared_weight
      : null;

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">KPIs and PS Score</h1>
          <p className="text-sm text-slate-500">
            Whether your role is delivering the outcomes it exists to deliver.
            Separate from the Action Tracker score, on purpose.
          </p>
        </div>
        {canAuthor ? (
          <Button type="button" onClick={() => setFormOpen(true)}>
            <Plus size={16} /> Define a KPI
          </Button>
        ) : null}
      </header>

      {psScore ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">
                PS Score, {psScore.month}/{psScore.year}
              </p>
              <p className="text-4xl font-bold text-slate-900">
                {formatNumber(psScore.ps_score)}
              </p>
              {band ? (
                <p className={`text-sm font-medium ${band.tone}`}>{band.label}</p>
              ) : null}
            </div>
            <p className="text-xs text-slate-500">
              Scored on {formatNumber(psScore.counted_weight)}% of weight
              {psScore.counted_weight < psScore.declared_weight
                ? ', the rest is not measured yet and is left out rather than counted as zero'
                : ''}
            </p>
          </div>

          {weightGap !== null ? (
            <p className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertTriangle size={15} />
              This KPI set weighs {formatNumber(weightGap)}%, not 100%. The score is
              normalised over what is there, so it still reads out of 100.
            </p>
          ) : null}

          {psScore.kpis.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2">KPI</th>
                    <th className="py-2">Target</th>
                    <th className="py-2">Actual</th>
                    <th className="py-2">Achievement</th>
                    <th className="py-2">Score</th>
                    <th className="py-2">Weight</th>
                    <th className="py-2">Contribution</th>
                  </tr>
                </thead>
                <tbody>
                  {psScore.kpis.map((line) => (
                    <tr
                      key={line.id}
                      className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                      onClick={() => setOpenKpiId(line.id)}
                    >
                      <td className="py-2">
                        <span className="text-slate-800">{line.name}</span>
                        {!line.counted ? (
                          <span className="ml-2 text-xs text-slate-400">
                            {line.status === 'CANCELLED' ? 'cancelled' : 'not measured'}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 text-slate-600">
                        {formatValue(line.target_value, line.unit_symbol)}
                      </td>
                      <td className="py-2 text-slate-600">
                        {formatValue(line.actual_value, line.unit_symbol)}
                      </td>
                      <td className="py-2 text-slate-600">
                        {formatPercent(line.achievement)}
                      </td>
                      <td className="py-2 text-slate-600">
                        {line.score === null ? '-' : formatNumber(line.score)}
                      </td>
                      <td className="py-2 text-slate-600">
                        {formatNumber(line.weight)}%
                        {line.contribution_share < 100 ? (
                          <span className="ml-1 text-xs text-slate-400">
                            &times; {formatNumber(line.contribution_share)}% share
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 font-medium text-slate-800">
                        {line.contribution === null ? '-' : formatNumber(line.contribution)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              No KPI covers this month yet.
            </p>
          )}
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">All KPIs you can see</h2>
        </div>

        {isLoading ? (
          <p className="p-5 text-sm text-slate-500">Loading KPIs...</p>
        ) : kpis.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <Target size={28} className="text-slate-300" />
            <p className="text-sm text-slate-500">
              No KPIs yet. A HOD defines them and the MD office approves them.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {kpis.map((kpi) => (
              <li key={kpi.id}>
                <button
                  type="button"
                  onClick={() => setOpenKpiId(kpi.id)}
                  className="flex w-full flex-wrap items-center gap-3 px-5 py-3 text-left hover:bg-slate-50"
                >
                  <span className="flex-1 text-sm font-medium text-slate-800">
                    {kpi.name}
                  </span>
                  <span className="text-xs text-slate-500">
                    {kpi.owner_user_id_user?.full_name ?? kpi.scope.toLowerCase()}
                  </span>
                  <span className="text-xs text-slate-500">{MODE_LABELS[kpi.mode]}</span>
                  <span className="text-xs text-slate-500">
                    {formatNumber(kpi.weight)}%
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${statusTone(kpi.status)}`}
                  >
                    {statusLabel(kpi.status)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <KpiFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={submit}
        isPending={createKpi.isPending}
        error={formError}
      />

      {openKpiId ? (
        <KpiDetailSheet id={openKpiId} onClose={() => setOpenKpiId(null)} />
      ) : null}
    </div>
  );
}
