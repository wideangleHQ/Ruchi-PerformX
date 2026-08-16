'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, ClipboardCheck, ClipboardList, Info, Sigma, TrendingUp } from 'lucide-react';
import { useMyScore, useMyScoreTrend } from '@/hooks/useAnalytics';
import type { ScoreTrendPoint } from '@/api/scoring';

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
 * The employee score is unbounded points, so nothing on this page draws it as a
 * fraction: no percentage, no rating out of ten, and no progress bar with a
 * maximum. Trend bars are scaled to the tallest month in the caller's own
 * series and every bar carries its number.
 */
function CountCard({
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
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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

function PointsTrend({ trend }: { trend: ScoreTrendPoint[] }) {
  if (!trend.length) {
    return (
      <div className="rounded-lg bg-slate-50 p-8 text-center">
        <p className="text-sm text-slate-600">No score history yet</p>
        <p className="mt-1 text-xs text-slate-500">
          Scores are written nightly. The first one appears after your first scored month.
        </p>
      </div>
    );
  }

  const peak = Math.max(...trend.map((point) => point.points ?? 0), 1);

  return (
    <div className="flex h-52 items-end gap-3">
      {trend.map((point) => (
        <div key={`${point.year}-${point.month}`} className="flex flex-1 flex-col items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">
            {point.hasScore ? point.points : '-'}
          </span>
          <div className="flex h-32 w-full items-end rounded-lg bg-slate-50 px-2">
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

function CompositionTable({ trend }: { trend: ScoreTrendPoint[] }) {
  if (!trend.length) {
    return <p className="text-sm text-slate-500">Nothing stored yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full">
        <thead className="border-b bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Month</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">
              Assigned tasks completed
            </th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">
              Self actions completed
            </th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">
              Overdue tasks
            </th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Points</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {[...trend].reverse().map((point) => (
            <tr key={`${point.year}-${point.month}`} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-sm font-medium text-slate-900">{point.label}</td>
              {point.hasScore ? (
                <>
                  <td className="px-4 py-3 text-right text-sm text-slate-700">
                    {point.assignedTasksCompleted}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-slate-700">
                    {point.selfActionsCompleted}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-slate-700">
                    {point.overdueTasksCount}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                    {point.points}
                  </td>
                </>
              ) : (
                <td className="px-4 py-3 text-right text-sm text-slate-400" colSpan={4}>
                  No score stored for this month
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ScoringPage() {
  const now = new Date();
  const [period, setPeriod] = useState({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });

  const score = useMyScore(period);
  const trend = useMyScoreTrend({ ...period, months: TREND_MONTHS });

  const isLoading = score.isLoading || trend.isLoading;
  const error = score.error || trend.error;
  const series = trend.data?.trend ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Performance</h1>
          <p className="mt-2 text-slate-600">Your monthly points and what was counted toward them</p>
        </div>

        <div className="flex gap-3">
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
          Points accumulate. There is no maximum, so the total is not a percentage and not a rating
          out of anything. The three counts below are what is stored each month; the points total
          also reflects review credit and an overdue penalty that are not stored per month.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-6">
          <p className="font-semibold text-red-800">Could not load your score</p>
          <p className="mt-1 text-sm text-red-700">Please try again after a moment.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <CountCard
              title="Points"
              value={score.data?.hasScore ? String(score.data.points) : 'Not scored'}
              detail={`${monthNames[period.month - 1]} ${period.year}`}
              icon={<Sigma size={20} />}
            />
            <CountCard
              title="Assigned tasks completed"
              value={String(score.data?.assignedTasksCompleted ?? 0)}
              detail="Tasks you closed this month"
              icon={<ClipboardList size={20} />}
            />
            <CountCard
              title="Self actions completed"
              value={String(score.data?.selfActionsCompleted ?? 0)}
              detail="Self actions you logged and finished"
              icon={<ClipboardCheck size={20} />}
            />
            <CountCard
              title="Overdue tasks"
              value={String(score.data?.overdueTasksCount ?? 0)}
              detail="Open tasks past their due date, all time"
              icon={<AlertTriangle size={20} />}
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <TrendingUp size={20} className="text-green-700" />
              <h2 className="text-xl font-bold text-slate-900">Points over the last {TREND_MONTHS} months</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Bars are scaled to your own highest month. A dashed slot is a month with no stored
              score, which is not the same as zero.
            </p>
            <div className="mt-4">
              <PointsTrend trend={series} />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">What was counted</h2>
            <CompositionTable trend={series} />
          </div>
        </>
      )}
    </div>
  );
}
