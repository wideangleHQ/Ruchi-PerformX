'use client';

import { useEffect, useState } from 'react';
import { Filter, RotateCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VendorFilters, VendorStatus } from '@/api/vendors';
import { useVendorCategories } from '@/hooks/useVendors';
import { useDepartmentOptions, useUserOptions } from './pickers';

const selectClass =
  'h-8 rounded-lg border border-input bg-white px-3 text-sm text-slate-700 outline-none';

/**
 * Status here is the four-way control from section 17 rather than the full
 * enum. PROSPECT and TERMINATED are reachable from the profile status control;
 * the directory filter is the one the client asked for.
 */
const STATUS_OPTIONS: Array<{ value: '' | VendorStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'EXPIRED', label: 'Expired' },
];

export function VendorDirectoryFilters({
  initialValues,
  onApply,
  onReset,
}: {
  initialValues: VendorFilters;
  onApply: (values: VendorFilters) => void;
  onReset: () => void;
}) {
  const [values, setValues] = useState<VendorFilters>(initialValues);
  const { data: categories } = useVendorCategories();
  const departments = useDepartmentOptions();
  const users = useUserOptions();

  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  const set = (patch: Partial<VendorFilters>) =>
    setValues((current) => ({ ...current, ...patch }));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Filter size={16} className="text-green-600" />
        Filters
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <Input
            value={values.search ?? ''}
            onChange={(event) => set({ search: event.target.value })}
            placeholder="Search vendor name or code"
            className="pl-9"
          />
        </div>

        <select
          value={values.status ?? ''}
          onChange={(event) => set({ status: (event.target.value || undefined) as VendorStatus | undefined })}
          className={selectClass}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={values.categoryId ?? ''}
          onChange={(event) => set({ categoryId: event.target.value || undefined })}
          className={selectClass}
        >
          <option value="">All categories</option>
          {(categories ?? []).map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        <select
          value={values.departmentId ?? ''}
          onChange={(event) => set({ departmentId: event.target.value || undefined })}
          className={selectClass}
        >
          <option value="">All departments</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>

        <select
          value={values.ownerId ?? ''}
          onChange={(event) => set({ ownerId: event.target.value || undefined })}
          className={selectClass}
        >
          <option value="">All internal owners</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.fullName}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label="Contract expiry from"
            value={values.expiryFrom ?? ''}
            onChange={(event) => set({ expiryFrom: event.target.value || undefined })}
          />
          <span className="text-xs text-slate-400">to</span>
          <Input
            type="date"
            aria-label="Contract expiry to"
            value={values.expiryTo ?? ''}
            onChange={(event) => set({ expiryTo: event.target.value || undefined })}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => onApply(values)}
          className="gap-2 bg-green-600 hover:bg-green-700"
        >
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
