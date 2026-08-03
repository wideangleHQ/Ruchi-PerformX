'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import {
  Activity,
  Award,
  BarChart3,
  ClipboardCheck,
  ClipboardList,
  HeartPulse,
  Medal,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCompanyHodScores, useHodScore, useHodScoreTrends } from '@/hooks/useQueries';
import {
  HOD_SCORE_COMPONENT_LABELS,
  HOD_SCORE_COMPONENT_ORDER,
  HOD_SCORE_COMPONENT_WEIGHTS,
  HodScoreBreakdown,
  HodScoreComponent,
  HodScoreRecord,
  HodScoreTrendPoint,
} from '@/api/hod-score';

const allowedRoles = ['MD', 'EA', 'PA', 'DEPARTMENT_CONTROLLER', 'HOD'];

const componentIcons: Record<HodScoreComponent, ReactNode> = {
  taskCreation: <ClipboardList size={18} />,
  selfAction: <ClipboardCheck size={18} />,
  departmentCompletion: <Award size={18} />,
  departmentHealth: <HeartPulse size={18} />,
  activeParticipation: <Activity size={18} />,
  leadershipBonus: <Medal size={18} />,
};

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

function formatScore(value: number | null | undefined) {
  if (value === null || value === undefined) return 'Neutral';
  return value.toFixed(2);
}

function scoreTone(score: number | null | undefined) {
  if (score === null || score === undefined) return 'bg-slate-100 text-slate-600';
  if (score >= 90) return 'bg-green-50 text-green-700';
  if (score >= 75) return 'bg-emerald-50 text-emerald-700';
  if (score >= 60) return 'bg-amber-50 text-amber-700';
  return 'bg-red-50 text-red-700';
}

function ProgressBar({ value }: { value: number | null }) {
  const width = Math.max(0, Math.min(100, value ?? 0));

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-green-600" style={{ width: `${width}%` }} />
    </div>
  );
}

function MetricCard({
  title,
  value,
  detail,
  icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
        </div>
        <span className="rounded-lg bg-green-50 p-2 text-green-700">{icon}</span>
      </div>
      <p className="mt-3 text-sm text-slate-500">{detail}</p>
    </div>
  );
}

function BreakdownRow({
  component,
  breakdown,
  neutralComponents,
}: {
  component: HodScoreComponent;
  breakdown: HodScoreBreakdown;
  neutralComponents: HodScoreComponent[];
}) {
  const value = breakdown[component];
  const isNeutral = neutralComponents.includes(component);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-slate-50 p-2 text-slate-600">{componentIcons[component]}</span>
          <div>
            <p className="font-semibold text-slate-900">{HOD_SCORE_COMPONENT_LABELS[component]}</p>
            <p className="text-sm text-slate-500">{HOD_SCORE_COMPONENT_WEIGHTS[component]}% weight</p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${scoreTone(value)}`}>
          {isNeutral ? 'Neutral' : formatScore(value)}
        </span>
      </div>
      <div className="mt-4">
        <ProgressBar value={value} />
      </div>
    </div>
  );
}

function TrendBars({ trend }: { trend: HodScoreTrendPoint[] }) {
  if (!trend.length) {
    return <p className="text-sm text-slate-500">No trend data available</p>;
  }

  return (
    <div className="flex h-44 items-end gap-3">
      {trend.map((point) => {
        const height = Math.max(4, Math.min(100, point.score ?? 0));
        return (
          <div key={`${point.year}-${point.month}`} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-32 w-full items-end rounded-lg bg-slate-50 px-2">
              <div
                className="w-full rounded-t-md bg-green-600"
                style={{ height: `${height}%` }}
                title={point.score === null ? 'Neutral' : `${point.score.toFixed(2)}`}
              />
            </div>
            <span className="text-xs font-medium text-slate-500">{point.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function RankingTable({ hods }: { hods: HodScoreRecord[] }) {
  if (!hods.length) {
    return (
      <div className="rounded-lg bg-slate-50 p-8 text-center">
        <p className="text-sm text-slate-600">No HOD score data available</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full">
        <thead className="border-b bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Rank</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">HOD</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Department</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Score</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Health</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Completion</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {hods.map((hod) => (
            <tr key={hod.hodId} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                {hod.companyRank ? `#${hod.companyRank}` : '-'}
              </td>
              <td className="px-4 py-3 text-sm text-slate-900">{hod.hodName}</td>
              <td className="px-4 py-3 text-sm text-slate-600">
                {hod.departments.map((department) => department.name).join(', ') || '-'}
              </td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-3 py-1 text-sm font-semibold ${scoreTone(hod.score)}`}>
                  {formatScore(hod.score)}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-slate-700">
                {formatScore(hod.breakdown.departmentHealth)}
              </td>
              <td className="px-4 py-3 text-sm text-slate-700">
                {formatScore(hod.breakdown.departmentCompletion)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function HodScorePage() {
  const { user, isLoading: authLoading } = useAuth();
  const now = new Date();
  const [period, setPeriod] = useState({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });

  const canView = Boolean(user?.role && allowedRoles.includes(user.role));
  const isHod = user?.role === 'HOD';

  const myScore = useHodScore(period, canView && isHod);
  const companyScores = useCompanyHodScores(period, canView && !isHod);
  const companyTrend = useHodScoreTrends({ ...period, months: 6 }, canView && !isHod);

  const primaryScore = isHod ? myScore.data : companyScores.data?.hods[0];
  const hodRows = useMemo(
    () => (isHod && myScore.data ? [myScore.data] : companyScores.data?.hods ?? []),
    [companyScores.data?.hods, isHod, myScore.data],
  );
  const isLoading = authLoading || myScore.isLoading || companyScores.isLoading || companyTrend.isLoading;
  const error = myScore.error || companyScores.error || companyTrend.error;

  if (!authLoading && user && !canView) {
    redirect('/dashboard');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">HOD Scores</h1>
          <p className="mt-2 text-slate-600">
            {isHod ? 'Your department performance score' : 'Company HOD performance overview'}
          </p>
        </div>

        <div className="flex gap-3">
          <select
            value={period.month}
            onChange={(event) => setPeriod((current) => ({ ...current, month: Number(event.target.value) }))}
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
            onChange={(event) => setPeriod((current) => ({ ...current, year: Number(event.target.value) }))}
            className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-100 bg-red-50 p-6">
          <p className="font-semibold text-red-800">Could not load HOD scores</p>
          <p className="mt-1 text-sm text-red-700">Please try again after a moment.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title={isHod ? 'Overall HOD Score' : 'Company Average'}
              value={isHod ? formatScore(primaryScore?.score) : formatScore(companyScores.data?.companyAverage)}
              detail={`${monthNames[period.month - 1]} ${period.year}`}
              icon={<TrendingUp size={20} />}
            />
            <MetricCard
              title="Department Completion"
              value={formatScore(primaryScore?.breakdown.departmentCompletion)}
              detail={`${primaryScore?.metrics.departmentTasksCompleted ?? 0}/${primaryScore?.metrics.departmentTasksTotal ?? 0} tasks`}
              icon={<Award size={20} />}
            />
            <MetricCard
              title="Department Health"
              value={formatScore(primaryScore?.breakdown.departmentHealth)}
              detail={`${primaryScore?.metrics.departmentTasksOverdue ?? 0} overdue tasks`}
              icon={<HeartPulse size={20} />}
            />
            <MetricCard
              title="Task Creation"
              value={formatScore(primaryScore?.breakdown.taskCreation)}
              detail={`${primaryScore?.metrics.createdTasks ?? 0}/${Math.round(primaryScore?.metrics.expectedTasks ?? 0)} target`}
              icon={<ClipboardList size={20} />}
            />
            <MetricCard
              title="Self Actions"
              value={formatScore(primaryScore?.breakdown.selfAction)}
              detail={`${primaryScore?.metrics.selfActionsCompleted ?? 0}/${primaryScore?.metrics.selfActionsTotal ?? 0} completed`}
              icon={<ClipboardCheck size={20} />}
            />
            <MetricCard
              title="Active Participation"
              value={formatScore(primaryScore?.breakdown.activeParticipation)}
              detail={`${primaryScore?.metrics.activeDays ?? 0}/${primaryScore?.metrics.workingDays ?? 0} working days`}
              icon={<Activity size={20} />}
            />
            <MetricCard
              title="Leadership Bonus"
              value={formatScore(primaryScore?.breakdown.leadershipBonus)}
              detail={`${primaryScore?.metrics.reviewedTasks ?? 0} reviews, ${primaryScore?.metrics.requestsReviewed ?? 0} requests`}
              icon={<Medal size={20} />}
            />
            <MetricCard
              title={isHod ? 'Company Rank' : 'HOD Count'}
              value={isHod ? (primaryScore?.companyRank ? `#${primaryScore.companyRank}` : '-') : String(companyScores.data?.hodCount ?? 0)}
              detail={isHod ? `Department rank ${primaryScore?.departmentRank ?? '-'}` : 'Visible score records'}
              icon={<Users size={20} />}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <BarChart3 size={20} className="text-green-700" />
                <h2 className="text-xl font-bold text-slate-900">Score Breakdown</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {primaryScore ? (
                  HOD_SCORE_COMPONENT_ORDER.map((component) => (
                    <BreakdownRow
                      key={component}
                      component={component}
                      breakdown={primaryScore.breakdown}
                      neutralComponents={primaryScore.neutralComponents}
                    />
                  ))
                ) : (
                  <div className="rounded-lg bg-slate-50 p-8 text-sm text-slate-600">No breakdown available</div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">Monthly Trend</h2>
              <div className="mt-4">
                <TrendBars trend={isHod ? myScore.data?.trend ?? [] : companyTrend.data?.trend ?? []} />
              </div>
            </div>
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Department Ranking</h2>
              <span className="text-sm text-slate-500">{hodRows.length} records</span>
            </div>
            <RankingTable hods={hodRows} />
          </div>
        </>
      )}
    </div>
  );
}
