'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScoreFilters } from '@/api/kpi';
import { useKpiScores } from '@/hooks/useKpi';
import { useUserOptions } from '@/components/pickers';
import { formatNumber } from '@/components/kpi/display';

const PAGE_SIZE = 20;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const thisYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => thisYear - i);

const EMPTY: ScoreFilters = { page: 1, limit: PAGE_SIZE };

function ratio(done: number | null, total: number | null) {
  return `${done ?? 0} / ${total ?? 0}`;
}

/**
 * The View Score tab: the existing PS Score rows, searched and filtered on the
 * server within the caller's department scope.
 *
 * Every number shown comes from `performance_scores` as stored. Nothing is
 * recalculated here, so this table and the scoring pages cannot disagree.
 * With no month or year chosen it shows every period, newest first, rather
 * than guessing one.
 */
export function KpiScoreTab() {
  const [filters, setFilters] = useState<ScoreFilters>(EMPTY);
  const [search, setSearch] = useState('');
  const { data, isLoading, isError } = useKpiScores(filters);
  const users = useUserOptions();

  const set = (patch: Partial<ScoreFilters>) =>
    setFilters((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));

  const page = filters.page ?? 1;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const departmentIds = new Set((data?.departments ?? []).map((d) => d.id));
  const userOptions = users.filter(
    (u) =>
      (!filters.department_id || u.departmentId === filters.department_id) &&
      (!u.departmentId || departmentIds.size === 0 || departmentIds.has(u.departmentId)),
  );

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <form
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
        onSubmit={(event) => {
          event.preventDefault();
          set({ q: search.trim() || undefined });
        }}
      >
        <div className="relative lg:col-span-2">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Name, username, or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <FilterSelect
          value={filters.department_id ?? ''}
          onChange={(value) => set({ department_id: value || undefined, user_id: undefined })}
          options={[
            ['', 'All departments'],
            ...(data?.departments ?? []).map((d) => [d.id, d.name] as [string, string]),
          ]}
        />

        <FilterSelect
          value={filters.user_id ?? ''}
          onChange={(value) => set({ user_id: value || undefined })}
          options={[
            ['', 'All employees'],
            ...userOptions.map((u) => [u.id, u.fullName] as [string, string]),
          ]}
        />

        <FilterSelect
          value={filters.month ? String(filters.month) : ''}
          onChange={(value) => set({ month: value ? Number(value) : undefined })}
          options={[
            ['', 'Any month'],
            ...MONTHS.map((name, i) => [String(i + 1), name] as [string, string]),
          ]}
        />

        <FilterSelect
          value={filters.year ? String(filters.year) : ''}
          onChange={(value) => set({ year: value ? Number(value) : undefined })}
          options={[
            ['', 'Any year'],
            ...YEARS.map((year) => [String(year), String(year)] as [string, string]),
          ]}
        />

        <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
          <Button type="submit" size="sm">
            Search
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setSearch('');
              setFilters(EMPTY);
            }}
          >
            Clear filters
          </Button>
          {data ? (
            <span className="ml-auto self-center text-xs text-slate-500">
              {data.total} score{data.total === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>
      </form>

      {isError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Scores could not be loaded.
        </p>
      ) : isLoading ? (
        <p className="text-sm text-slate-500">Loading scores...</p>
      ) : !data || data.items.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          No PS Scores match these filters.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-3">Employee</th>
                <th className="py-2 pr-3">Department</th>
                <th className="py-2 pr-3">Period</th>
                <th className="py-2 pr-3">PS Score</th>
                <th className="py-2 pr-3">Self productivity</th>
                <th className="py-2 pr-3">Assigned tasks</th>
                <th className="py-2 pr-3">Self actions</th>
                <th className="py-2 pr-3">Tasks done</th>
                <th className="py-2 pr-3">Overdue</th>
                <th className="py-2">Finalized</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="py-2 pr-3">
                    <p className="text-slate-800">{row.user.full_name}</p>
                    <p className="text-xs text-slate-400">{row.user.email}</p>
                  </td>
                  <td className="py-2 pr-3 text-slate-600">{row.department?.name ?? '-'}</td>
                  <td className="py-2 pr-3 text-slate-600">
                    {MONTHS[row.month - 1]?.slice(0, 3)} {row.year}
                  </td>
                  <td className="py-2 pr-3 font-semibold text-slate-900">
                    {row.final_score === null ? '-' : formatNumber(row.final_score)}
                  </td>
                  <td className="py-2 pr-3 text-slate-600">
                    {row.self_productivity_score === null
                      ? '-'
                      : formatNumber(row.self_productivity_score)}
                  </td>
                  <td className="py-2 pr-3 text-slate-600">
                    {row.assigned_task_score === null
                      ? '-'
                      : formatNumber(row.assigned_task_score)}
                  </td>
                  <td className="py-2 pr-3 text-slate-600">
                    {ratio(row.self_actions_completed, row.self_actions_total)}
                  </td>
                  <td className="py-2 pr-3 text-slate-600">
                    {ratio(row.assigned_tasks_completed, row.assigned_tasks_total)}
                  </td>
                  <td className="py-2 pr-3 text-slate-600">{row.overdue_tasks_count ?? 0}</td>
                  <td className="py-2 text-slate-600">{row.is_finalized ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => set({ page: page - 1 })}
          >
            Previous
          </Button>
          <span className="text-slate-500">
            Page {page} of {pages}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page >= pages}
            onClick={() => set({ page: page + 1 })}
          >
            Next
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  );
}
