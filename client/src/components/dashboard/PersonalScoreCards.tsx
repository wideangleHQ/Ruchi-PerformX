'use client';

import { useState } from 'react';
import { useMyScoreProfile } from '@/hooks/useScoring';
import { useAuth } from '@/context/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function PersonalScoreCards() {
  const { user } = useAuth();
  const now = new Date();
  const [period, setPeriod] = useState({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });

  const [atBreakdownOpen, setAtBreakdownOpen] = useState(false);
  const [psBreakdownOpen, setPsBreakdownOpen] = useState(false);

  const { data: profile, isLoading } = useMyScoreProfile(period);

  const isHod = user?.role === 'HOD';

  const atScore = profile?.atScore?.score ?? 0;
  const psScore = profile?.psScore?.ps_score ?? 0;

  const monthLabel = MONTH_NAMES[period.month - 1];

  return (
    <section className="mb-6 space-y-4">
      {/* Header and Period Selector */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Performance Overview</h2>
          <p className="text-xs text-slate-500">
            Action Tracker (Execution) and Performance (KPI Outcome) measurements
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period.month}
            onChange={(e) => setPeriod((prev) => ({ ...prev, month: Number(e.target.value) }))}
            aria-label="Select month"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-500/20"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={period.year}
            onChange={(e) => setPeriod((prev) => ({ ...prev, year: Number(e.target.value) }))}
            aria-label="Select year"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-500/20"
          >
            {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* The Two Side-by-Side Cards (rounded-2xl matching other dashboard cards) */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Card 1: Action Tracker (AT) Score */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-green-200 hover:shadow-md">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-green-700">
                Action Tracker Score
              </span>
              <h3 className="mt-0.5 text-base font-bold text-slate-900">
                Operational Delivery
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              {monthLabel} {period.year}
            </span>
          </div>

          <div className="my-5">
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-4xl font-bold tracking-tight text-green-700">
                  {isLoading ? '—' : atScore.toFixed(1)}
                </span>
                <span className="text-sm font-semibold text-slate-400">/ 100</span>
              </div>
              {profile?.atScore?.isNormalized && (
                <span className="text-xs font-medium text-slate-500">
                  Normalized
                </span>
              )}
            </div>

            {/* Clean solid green progress track */}
            <div className="mt-3.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-green-700 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, atScore))}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs">
            <span className="text-slate-500">
              {isHod ? '4 Components (HOD Leader)' : '3 Components (Self, Tasks, Projects)'}
            </span>
            <button
              onClick={() => setAtBreakdownOpen(true)}
              className="font-semibold text-green-700 transition hover:text-green-800 hover:underline"
            >
              View Breakdown
            </button>
          </div>
        </div>

        {/* Card 2: Performance (PS) Score */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-green-200 hover:shadow-md">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-green-700">
                Performance Score
              </span>
              <h3 className="mt-0.5 text-base font-bold text-slate-900">
                KPI Achievement
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              {monthLabel} {period.year}
            </span>
          </div>

          <div className="my-5">
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-4xl font-bold tracking-tight text-green-700">
                  {isLoading ? '—' : psScore.toFixed(1)}
                </span>
                <span className="text-sm font-semibold text-slate-400">/ 100</span>
              </div>
              <span className="text-xs font-medium text-slate-500">
                {profile?.psScore?.kpis?.length ?? 0} KPIs Scored
              </span>
            </div>

            {/* Clean solid green progress track */}
            <div className="mt-3.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-green-700 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, psScore))}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs">
            <span className="text-slate-500">
              {profile?.psScore ? `Counted ${profile.psScore.counted_weight}% weight` : 'KPI Outcomes'}
            </span>
            <button
              onClick={() => setPsBreakdownOpen(true)}
              className="font-semibold text-green-700 transition hover:text-green-800 hover:underline"
            >
              View Breakdown
            </button>
          </div>
        </div>
      </div>

      {/* Modal: AT Score Breakdown (rounded-2xl) */}
      <Dialog open={atBreakdownOpen} onOpenChange={setAtBreakdownOpen}>
        <DialogContent className="max-w-2xl bg-white p-6 sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">
              Action Tracker Score Breakdown
            </DialogTitle>
            <p className="text-xs text-slate-500">
              {profile?.user.fullName} ({profile?.user.role}) • {monthLabel} {period.year}
            </p>
          </DialogHeader>

          {profile?.atScore && (
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
                <div>
                  <p className="text-xs font-medium text-slate-500">Composite AT Score</p>
                  <p className="font-mono text-2xl font-bold text-green-700">
                    {profile.atScore.score.toFixed(1)}{' '}
                    <span className="font-sans text-xs font-normal text-slate-400">/ 100</span>
                  </p>
                </div>
                {profile.atScore.isNormalized && (
                  <span className="text-xs font-medium text-slate-600">
                    Weights normalized (No active projects in period)
                  </span>
                )}
              </div>

              {/* Component Rows */}
              <div className="space-y-3">
                {/* Self Action Component */}
                {profile.atScore.components.selfAction && (
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">Self Actions</span>
                        <span className="text-xs text-slate-500">
                          ({profile.atScore.components.selfAction.weight}% weight)
                        </span>
                      </div>
                      <span className="font-mono font-bold text-slate-900">
                        {profile.atScore.components.selfAction.score.toFixed(1)} / 100
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                      {Object.entries(profile.atScore.components.selfAction.subcomponents).map(
                        ([key, sub]) => (
                          <div key={key} className="rounded-lg bg-slate-50 p-2.5">
                            <span className="capitalize text-slate-500">{key}</span>
                            <p className="font-mono font-semibold text-slate-800">{sub.score.toFixed(0)}%</p>
                            {sub.value && (
                              <p className="text-[10px] text-slate-400">{sub.value}</p>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}

                {/* Assigned Task Component */}
                {profile.atScore.components.assignedTask && (
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">Assigned Tasks</span>
                        <span className="text-xs text-slate-500">
                          ({profile.atScore.components.assignedTask.weight}% weight)
                        </span>
                      </div>
                      <span className="font-mono font-bold text-slate-900">
                        {profile.atScore.components.assignedTask.score.toFixed(1)} / 100
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                      {Object.entries(profile.atScore.components.assignedTask.subcomponents).map(
                        ([key, sub]) => (
                          <div key={key} className="rounded-lg bg-slate-50 p-2.5">
                            <span className="capitalize text-slate-500">{key}</span>
                            <p className="font-mono font-semibold text-slate-800">{sub.score.toFixed(0)}%</p>
                            {sub.value && (
                              <p className="text-[10px] text-slate-400">{sub.value}</p>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}

                {/* Project Component */}
                {profile.atScore.components.project && (
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">Projects</span>
                        <span className="text-xs text-slate-500">
                          ({profile.atScore.components.project.weight}% weight)
                        </span>
                      </div>
                      <span className="font-mono font-bold text-slate-900">
                        {profile.atScore.components.project.applicable
                          ? `${profile.atScore.components.project.score.toFixed(1)} / 100`
                          : 'Not Applicable'}
                      </span>
                    </div>
                    {profile.atScore.components.project.applicable && (
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                        {Object.entries(profile.atScore.components.project.subcomponents).map(
                          ([key, sub]) => (
                            <div key={key} className="rounded-lg bg-slate-50 p-2.5">
                              <span className="capitalize text-slate-500">{key}</span>
                              <p className="font-mono font-semibold text-slate-800">{sub.score.toFixed(0)}%</p>
                              {sub.value && (
                                <p className="text-[10px] text-slate-400">{sub.value}</p>
                              )}
                            </div>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* HOD Department Execution */}
                {profile.atScore.components.departmentExecution && (
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          Department Execution (HOD)
                        </span>
                        <span className="text-xs text-slate-500">
                          ({profile.atScore.components.departmentExecution.weight}% weight)
                        </span>
                      </div>
                      <span className="font-mono font-bold text-slate-900">
                        {profile.atScore.components.departmentExecution.score.toFixed(1)} / 100
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      {Object.entries(
                        profile.atScore.components.departmentExecution.subcomponents,
                      ).map(([key, sub]) => (
                        <div key={key} className="rounded-lg bg-slate-50 p-2.5">
                          <span className="capitalize text-slate-500">{key}</span>
                          <p className="font-mono font-semibold text-slate-800">{sub.score.toFixed(0)}%</p>
                          {sub.value && <p className="text-[10px] text-slate-400">{sub.value}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* HOD Leadership Discipline */}
                {profile.atScore.components.leadership && (
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          Leadership Discipline (HOD)
                        </span>
                        <span className="text-xs text-slate-500">
                          ({profile.atScore.components.leadership.weight}% weight)
                        </span>
                      </div>
                      <span className="font-mono font-bold text-slate-900">
                        {profile.atScore.components.leadership.score.toFixed(1)} / 100
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(profile.atScore.components.leadership.subcomponents).map(
                        ([key, sub]) => (
                          <div key={key} className="rounded-lg bg-slate-50 p-2.5">
                            <span className="capitalize text-slate-500">{key}</span>
                            <p className="font-mono font-semibold text-slate-800">{sub.score.toFixed(0)}%</p>
                            {sub.value && <p className="text-[10px] text-slate-400">{sub.value}</p>}
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: PS Score Breakdown (rounded-2xl) */}
      <Dialog open={psBreakdownOpen} onOpenChange={setPsBreakdownOpen}>
        <DialogContent className="max-w-3xl bg-white p-6 sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">
              Performance / KPI Score Breakdown
            </DialogTitle>
            <p className="text-xs text-slate-500">
              {profile?.user.fullName} • {monthLabel} {period.year}
            </p>
          </DialogHeader>

          {profile?.psScore && (
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
                <div>
                  <p className="text-xs font-medium text-slate-500">Composite PS Score</p>
                  <p className="font-mono text-2xl font-bold text-green-700">
                    {profile.psScore.ps_score.toFixed(1)}{' '}
                    <span className="font-sans text-xs font-normal text-slate-400">/ 100</span>
                  </p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>Counted Weight: {profile.psScore.counted_weight}%</p>
                  <p>Declared Weight: {profile.psScore.declared_weight}%</p>
                </div>
              </div>

              {/* KPI Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3.5 py-2.5 font-semibold">KPI Name</th>
                      <th className="px-3.5 py-2.5 font-semibold">Target</th>
                      <th className="px-3.5 py-2.5 font-semibold">Actual</th>
                      <th className="px-3.5 py-2.5 font-semibold">Achievement</th>
                      <th className="px-3.5 py-2.5 font-semibold">KPI Score</th>
                      <th className="px-3.5 py-2.5 font-semibold">Weight</th>
                      <th className="px-3.5 py-2.5 font-semibold">Contribution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {profile.psScore.kpis.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                          No active KPIs assigned for this period.
                        </td>
                      </tr>
                    ) : (
                      profile.psScore.kpis.map((kpi) => (
                        <tr key={kpi.id} className="hover:bg-slate-50/50">
                          <td className="px-3.5 py-2.5 font-medium text-slate-900">{kpi.name}</td>
                          <td className="px-3.5 py-2.5 text-slate-600">
                            {kpi.target_value ?? '—'} {kpi.unit_symbol ?? ''}
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-600">
                            {kpi.actual_value ?? '—'} {kpi.unit_symbol ?? ''}
                          </td>
                          <td className="px-3.5 py-2.5 font-mono text-slate-600">
                            {kpi.achievement !== null ? `${kpi.achievement.toFixed(1)}%` : '—'}
                          </td>
                          <td className="px-3.5 py-2.5 font-mono font-semibold text-slate-800">
                            {kpi.score !== null ? kpi.score.toFixed(1) : '—'}
                          </td>
                          <td className="px-3.5 py-2.5 font-mono text-slate-600">{kpi.effective_weight}%</td>
                          <td className="px-3.5 py-2.5 font-mono font-bold text-green-700">
                            {kpi.contribution !== null ? kpi.contribution.toFixed(1) : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
