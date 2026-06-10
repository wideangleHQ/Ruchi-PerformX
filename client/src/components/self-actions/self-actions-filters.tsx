'use client';

import { useEffect, useState } from 'react';
import { Filter, RotateCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SelfActionFilters } from '@/api/self-actions';
import { Department } from '@/api/users';
import { User } from '@/api/types';

type Props = {
  initialValues: SelfActionFilters;
  departments: Department[];
  users: User[];
  onApply: (values: SelfActionFilters) => void;
  onReset: () => void;
};

export function SelfActionsFilters({
  initialValues,
  departments,
  users,
  onApply,
  onReset,
}: Props) {
  const [values, setValues] = useState<SelfActionFilters>(initialValues);

  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Filter size={16} className="text-green-600" />
        Filters
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={values.search ?? ''}
            onChange={(event) => setValues((current) => ({ ...current, search: event.target.value }))}
            placeholder="Search title or description"
            className="pl-9"
          />
        </div>

        <select
          value={values.status ?? ''}
          onChange={(event) => setValues((current) => ({ ...current, status: event.target.value as SelfActionFilters['status'] }))}
          className="h-8 rounded-lg border border-input bg-white px-3 text-sm text-slate-700 outline-none"
        >
          <option value="">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="ONGOING">Ongoing</option>
          <option value="COMPLETED">Completed</option>
          <option value="ABORTED">Aborted</option>
        </select>

        <select
          value={values.priority ?? ''}
          onChange={(event) => setValues((current) => ({ ...current, priority: event.target.value as SelfActionFilters['priority'] }))}
          className="h-8 rounded-lg border border-input bg-white px-3 text-sm text-slate-700 outline-none"
        >
          <option value="">All Priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical</option>
        </select>

        <select
          value={values.departmentId ?? ''}
          onChange={(event) => setValues((current) => ({ ...current, departmentId: event.target.value }))}
          className="h-8 rounded-lg border border-input bg-white px-3 text-sm text-slate-700 outline-none"
        >
          <option value="">All Departments</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>

        <select
          value={values.createdById ?? ''}
          onChange={(event) => setValues((current) => ({ ...current, createdById: event.target.value }))}
          className="h-8 rounded-lg border border-input bg-white px-3 text-sm text-slate-700 outline-none"
        >
          <option value="">All Creators</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.fullName}
            </option>
          ))}
        </select>

        <Input
          type="date"
          value={values.dateFrom ?? ''}
          onChange={(event) => setValues((current) => ({ ...current, dateFrom: event.target.value }))}
        />

        <Input
          type="date"
          value={values.dateTo ?? ''}
          onChange={(event) => setValues((current) => ({ ...current, dateTo: event.target.value }))}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={() => onApply(values)} className="gap-2 bg-green-600 hover:bg-green-700">
          Apply Filters
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setValues({});
            onReset();
          }}
          className="gap-2"
        >
          <RotateCcw size={14} />
          Reset Filters
        </Button>
      </div>
    </div>
  );
}
