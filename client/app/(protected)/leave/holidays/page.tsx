'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authApi } from '@/api/auth';
import type { Holiday } from '@/api/holidays';
import {
  useCreateHoliday,
  useDeleteHoliday,
  useHolidays,
  useUpcomingHolidays,
} from '@/hooks/useHolidays';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const COMMON = 'COMMON';

function formatDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function countdown(days: number) {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `in ${days} days`;
}

export default function HolidaysPage() {
  const { user } = useAuth();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [form, setForm] = useState({
    name: '',
    date: '',
    tier: COMMON,
    isOptional: false,
  });
  const [error, setError] = useState<string | null>(null);

  const { data: holidays = [], isLoading } = useHolidays(year);
  const { data: upcoming = [] } = useUpcomingHolidays(1);
  const createHoliday = useCreateHoliday();
  const deleteHoliday = useDeleteHoliday();

  // HR and ADMIN maintain both tiers. A HOD maintains their own departments
  // only, which the API enforces regardless of what this screen renders.
  const setsCommon = user?.role === 'HR' || user?.role === 'ADMIN';
  const ownDepartmentIds = useMemo(
    () => user?.departmentIds ?? [],
    [user?.departmentIds],
  );
  const isHod = user?.role === 'HOD' && ownDepartmentIds.length > 0;
  const canEdit = setsCommon || isHod;

  const { data: departments = [] } = useQuery({
    queryKey: ['holiday-departments'],
    queryFn: () => authApi.getDepartments(),
    enabled: canEdit,
  });

  const writableDepartments = useMemo(
    () =>
      setsCommon
        ? departments
        : departments.filter((department) =>
            ownDepartmentIds.includes(department.id),
          ),
    [departments, ownDepartmentIds, setsCommon],
  );

  const canDelete = (holiday: Holiday) =>
    setsCommon ||
    (isHod &&
      holiday.departmentId !== null &&
      ownDepartmentIds.includes(holiday.departmentId));

  const commonHolidays = holidays.filter((holiday) => holiday.tier === COMMON);
  const departmentHolidays = holidays.filter(
    (holiday) => holiday.tier === 'DEPARTMENT',
  );
  const nextHoliday = upcoming[0];

  const submit = () => {
    setError(null);
    createHoliday.mutate(
      {
        name: form.name.trim(),
        date: form.date,
        isOptional: form.isOptional,
        ...(form.tier === COMMON ? {} : { departmentId: form.tier }),
      },
      {
        onSuccess: () => {
          setForm({
            name: '',
            date: '',
            tier: setsCommon ? COMMON : form.tier,
            isOptional: false,
          });
          setYear(new Date(`${form.date}T00:00:00.000Z`).getUTCFullYear());
        },
        onError: (err: unknown) => setError(readError(err, 'Could not add the holiday')),
      },
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Holiday Calendar</h1>
          <p className="mt-2 text-gray-600">
            Company-wide holidays and the ones set for your department.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Year</label>
          <select
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {[thisYear - 1, thisYear, thisYear + 1].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      {nextHoliday ? (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
          <CalendarDays className="h-5 w-5 text-green-700" />
          <div className="text-sm text-green-900">
            Next up: <span className="font-semibold">{nextHoliday.name}</span> on{' '}
            {formatDate(nextHoliday.date)},{' '}
            <span className="font-semibold">{countdown(nextHoliday.daysUntil)}</span>
          </div>
        </div>
      ) : null}

      {canEdit ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Add a Holiday</h2>
          <p className="mt-1 text-sm text-gray-500">
            {setsCommon
              ? 'Company-wide holidays apply to everyone. Department holidays apply only to that department.'
              : 'You can add holidays for your own department. Company-wide holidays are set by HR.'}
          </p>

          {error ? (
            <div className="mt-4 rounded-md bg-red-50 p-4 text-sm text-red-800">{error}</div>
          ) : null}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <Input
                value={form.name}
                onChange={(event) =>
                  setForm((value) => ({ ...value, name: event.target.value }))
                }
                className="mt-1"
                placeholder="Republic Day"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Date</label>
              <Input
                type="date"
                value={form.date}
                onChange={(event) =>
                  setForm((value) => ({ ...value, date: event.target.value }))
                }
                className="mt-1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Applies to</label>
              <select
                value={form.tier}
                onChange={(event) =>
                  setForm((value) => ({ ...value, tier: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                {setsCommon ? <option value={COMMON}>Everyone (company-wide)</option> : null}
                {writableDepartments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.isOptional}
                  onChange={(event) =>
                    setForm((value) => ({ ...value, isOptional: event.target.checked }))
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                Optional holiday
              </label>
            </div>
          </div>

          <div className="mt-6">
            <Button
              className="bg-green-600 hover:bg-green-700"
              disabled={
                createHoliday.isPending ||
                !form.name.trim() ||
                !form.date ||
                (!setsCommon && form.tier === COMMON)
              }
              onClick={submit}
            >
              <Plus className="h-4 w-4" />
              {createHoliday.isPending ? 'Adding...' : 'Add Holiday'}
            </Button>
          </div>
        </div>
      ) : null}

      <HolidaySection
        title="Common Holidays"
        subtitle="Apply to everyone in the company."
        holidays={commonHolidays}
        isLoading={isLoading}
        canDelete={canDelete}
        onDelete={(id) => deleteHoliday.mutate(id)}
        busy={deleteHoliday.isPending}
      />

      <HolidaySection
        title="Department-wise Holidays"
        subtitle="Apply only to the department they are set for."
        holidays={departmentHolidays}
        isLoading={isLoading}
        canDelete={canDelete}
        onDelete={(id) => deleteHoliday.mutate(id)}
        busy={deleteHoliday.isPending}
      />
    </div>
  );
}

function HolidaySection({
  title,
  subtitle,
  holidays,
  isLoading,
  canDelete,
  onDelete,
  busy,
}: {
  title: string;
  subtitle: string;
  holidays: Holiday[];
  isLoading: boolean;
  canDelete: (holiday: Holiday) => boolean;
  onDelete: (id: string) => void;
  busy: boolean;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>

      {isLoading ? (
        <div className="rounded-xl bg-gray-50 p-8 text-center text-gray-600">Loading...</div>
      ) : holidays.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {holidays.map((holiday) => (
            <div
              key={holiday.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="space-y-1">
                <div className="text-sm font-semibold text-green-700">{holiday.name}</div>
                <div className="text-sm text-gray-700">{formatDate(holiday.date)}</div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {holiday.departmentName ? (
                    <Badge variant="outline">{holiday.departmentName}</Badge>
                  ) : null}
                  {holiday.isOptional ? <Badge variant="secondary">Optional</Badge> : null}
                </div>
              </div>
              {canDelete(holiday) ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={busy}
                  aria-label={`Delete ${holiday.name}`}
                  onClick={() => {
                    if (window.confirm(`Delete "${holiday.name}"?`)) onDelete(holiday.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl bg-gray-50 p-8 text-center text-gray-600">
          Nothing on this list for the selected year.
        </div>
      )}
    </section>
  );
}

/** Pull the API's message out of an axios error without widening it to `any`. */
function readError(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: string | string[] } } })
    ?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? fallback;
}
