'use client';

import { useEffect, useMemo, useState } from 'react';
import { redirect } from 'next/navigation';
import { BarChart3, Info, Trophy, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCompanyHodScores, useHodScore, useHodScoreTrends } from '@/hooks/useQueries';
import { useDepartmentScoreTrend, useScoreLeaderboard } from '@/hooks/useAnalytics';
import type { HodScoreDepartment, HodScoreTrendPoint } from '@/api/hod-score';
import type { DepartmentMemberTrend, ScoreTrendPoint } from '@/api/scoring';

const allowedRoles = ['MD', 'EA', 'PA', 'DEPARTMENT_CONTROLLER', 'HOD'];
const TREND_MONTHS = 6;

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Two engines, two scales, drawn apart on purpose.
 *
 * The HOD score is a weighted 0-100 value, so its bars are scaled to 100.
 * Employee points are unbounded, so their bars are scaled to the tallest month
 * on screen and every bar carries its number. Nothing here averages the two or
 * shows either as a percentage of the other.
 */
function HodScoreTrend({ trend }: { trend: HodScoreTrendPoint[] }) {
  if (!trend.length) {
    return <p className="text-sm text-slate-500">No HOD score history for this period</p>;
  }

  return (
    <div className="flex h-48 items-end gap-3">
      {trend.map((point) => (
        <div key={`${point.year}-${point.month}`} className="flex flex-1 flex-col items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">
            {point.score === null ? '-' : point.score.toFixed(1)}
          </span>
          <div className="flex h-28 w-full items-end rounded-lg bg-slate-50 px-2">
            <div
              className="w-full rounded-t-md bg-green-700"
              style={{ height: `${Math.max(4, Math.min(100, point.score ?? 0))}%` }}
              title={point.score === null ? 'Neutral' : `${point.score.toFixed(2)} of 100`}
            />
          </div>
          <span className="text-xs font-medium text-slate-500">{point.label}</span>
        </div>
      ))}
    </div>
  );
}

function PointsTrend({ trend, peak }: { trend: ScoreTrendPoint[]; peak: number }) {
  if (!trend.length) {
    return (
      <div className="rounded-lg bg-slate-50 p-8 text-center text-sm text-slate-600">
        No stored employee scores for this department
      </div>
    );
  }

  return (
    <div className="flex h-48 items-end gap-3">
      {trend.map((point) => (
        <div key={`${point.year}-${point.month}`} className="flex flex-1 flex-col items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">
            {point.hasScore ? point.points : '-'}
          </span>
          <div className="flex h-28 w-full items-end rounded-lg bg-slate-50 px-2">
            {point.hasScore ? (
              <div
                className="w-full rounded-t-md bg-green-700"
                style={{ height: `${Math.max(4, ((point.points ?? 0) / peak) * 100)}%` }}
                title={`${point.points} points`}
              />
            ) : (
              <div
                className="mb-1 w-full rounded-md border border-dashed border-slate-300"
                style={{ height: '8%' }}
                title="No score stored for this month"
              />
            )}
          </div>
          <span className="text-xs font-medium text-slate-500">{point.label}</span>
        </div>
      ))}
    </div>
  );
}

function MemberRow({ member, peak }: { member: DepartmentMemberTrend; peak: number }) {
  const latest = [...member.trend].reverse().find((point) => point.hasScore);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold text-slate-900">{member.fullName}</p>
        <span className="rounded-full bg-green-50 px-3 py-1 text-sm font-semibold text-green-700">
          {latest ? `${latest.points} points` : 'Not scored'}
        </span>
      </div>
      <div className="mt-4 flex h-20 items-end gap-2">
        {member.trend.map((point) => (
          <div key={`${point.year}-${point.month}`} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-12 w-full items-end rounded bg-slate-50">
              {point.hasScore ? (
                <div
                  className="w-full rounded-t bg-green-700"
                  style={{ height: `${Math.max(6, ((point.points ?? 0) / peak) * 100)}%` }}
                  title={`${point.label}: ${point.points} points`}
                />
              ) : (
                <div
                  className="mb-0.5 w-full rounded border border-dashed border-slate-300"
                  style={{ height: '10%' }}
                  title={`${point.label}: no score stored`}
                />
              )}
            </div>
            <span className="text-[10px] font-medium text-slate-400">{point.label.slice(0, 3)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const now = new Date();
  const [period, setPeriod] = useState({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });
  const [departmentId, setDepartmentId] = useState<string | null>(null);

  const canView = Boolean(user?.role && allowedRoles.includes(user.role));
  const isHod = user?.role === 'HOD';

  const myScore = useHodScore(period, canView && isHod);
  const companyScores = useCompanyHodScores(period, canView && !isHod);

  // Departments come from the HOD score payload the page already loads, so the
  // picker costs no extra request.
  const departments = useMemo<HodScoreDepartment[]>(() => {
    const source = isHod
      ? myScore.data?.departments ?? []
      : (companyScores.data?.hods ?? []).flatMap((hod) => hod.departments);
    return [...new Map(source.map((department) => [department.id, department])).values()].sort(
      (a, b) => a.name.localeCompare(b.name),
    );
  }, [companyScores.data?.hods, isHod, myScore.data?.departments]);

  useEffect(() => {
    if (!departmentId && departments.length) {
      setDepartmentId(departments[0].id);
    }
  }, [departmentId, departments]);

  const hodTrend = useHodScoreTrends(
    { ...period, months: TREND_MONTHS, departmentId: departmentId ?? undefined },
    canView && Boolean(departmentId),
  );
  const pointsTrend = useDepartmentScoreTrend(
    departmentId,
    { ...period, months: TREND_MONTHS },
    canView,
  );
  const leaderboard = useScoreLeaderboard(period, canView);

  const peak = useMemo(() => {
    const data = pointsTrend.data;
    if (!data) return 1;
    const values = [
      ...data.trend.map((point) => point.points ?? 0),
      ...data.members.flatMap((member) => member.trend.map((point) => point.points ?? 0)),
    ];
    return Math.max(...values, 1);
  }, [pointsTrend.data]);

  if (!authLoading && user && !canView) {
    redirect('/dashboard');
  }

  const error = hodTrend.error || pointsTrend.error || leaderboard.error;
  const selectedDepartment = departments.find((department) => department.id === departmentId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Analytics</h1>
          <p className="mt-2 text-slate-600">Department and individual performance trends</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={departmentId ?? ''}
            onChange={(event) => setDepartmentId(event.target.value || null)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {departments.length ? (
              departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))
            ) : (
              <option value="">No departments</option>
            )}
          </select>
          <select
            value={period.month}
            onChange={(event) =>
              setPeriod((current) => ({ ...current, month: Number(event.target.value) }))
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {monthNames.map((month, index) => (
              <option key={month} value={index + 1}>
                {month}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={2020}
            max={now.getFullYear()}
            value={period.year}
            onChange={(event) =>
              setPeriod((current) => ({ ...current, year: Number(event.target.value) }))
            }
            className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <Info size={18} className="mt-0.5 shrink-0 text-green-700" />
        <p className="text-sm text-slate-600">
          Two separate scales. The HOD score is a weighted value out of 100. Employee points are an
          unbounded running total, so they are shown as counts and never as a percentage. The two
          are not comparable.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-6">
          <p className="font-semibold text-red-800">Could not load analytics</p>
          <p className="mt-1 text-sm text-red-700">Please try again after a moment.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <BarChart3 size={20} className="text-green-700" />
                <h2 className="text-xl font-bold text-slate-900">HOD score trend</h2>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {selectedDepartment?.name ?? 'No department'}, out of 100, last {TREND_MONTHS} months
              </p>
              <div className="mt-4">
                {hodTrend.isLoading ? (
                  <div className="h-48 animate-pulse rounded-lg bg-slate-100" />
                ) : (
                  <HodScoreTrend trend={hodTrend.data?.trend ?? []} />
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Users size={20} className="text-green-700" />
                <h2 className="text-xl font-bold text-slate-900">Employee points trend</h2>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Department average per month across {pointsTrend.data?.memberCount ?? 0} scored
                people. Bars are scaled to the tallest month shown.
              </p>
              <div className="mt-4">
                {pointsTrend.isLoading ? (
                  <div className="h-48 animate-pulse rounded-lg bg-slate-100" />
                ) : (
                  <PointsTrend trend={pointsTrend.data?.trend ?? []} peak={peak} />
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Individual trends</h2>
              <span className="text-sm text-slate-500">
                {pointsTrend.data?.members.length ?? 0} people
              </span>
            </div>
            {pointsTrend.isLoading ? (
              <div className="grid gap-3 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-40 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : pointsTrend.data?.members.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {pointsTrend.data.members.map((member) => (
                  <MemberRow key={member.userId} member={member} peak={peak} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-600">
                Nobody in this department has a stored score yet
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Trophy size={20} className="text-green-700" />
              <h2 className="text-xl font-bold text-slate-900">Top points, company wide</h2>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full">
                <thead className="border-b bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">#</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Role</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                      Department
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">
                      Points
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(leaderboard.data?.entries ?? []).map((entry, index) => (
                    <tr key={entry.userId} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">{index + 1}</td>
                      <td className="px-4 py-3 text-sm text-slate-900">{entry.fullName}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{entry.role}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{entry.department ?? '-'}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                        {entry.points}
                      </td>
                    </tr>
                  ))}
                  {!leaderboard.isLoading && !leaderboard.data?.entries.length ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-sm text-slate-600" colSpan={5}>
                        No stored scores for this month
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
