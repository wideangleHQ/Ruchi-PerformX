'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { VendorProfile, VendorStatus } from '@/api/vendors';
import {
  useSetVendorStatus,
  useVendor,
  useVendorAccess,
  useVendorAssignments,
} from '@/hooks/useVendors';
import { VendorAccessGate } from '@/components/vendors/VendorAccessGate';
import { VendorProfileTabs } from '@/components/vendors/VendorProfileTabs';
import {
  RatingStars,
  VENDOR_STATUSES,
  VendorStatusChip,
  formatDate,
  label,
} from '@/components/vendors/VendorChips';

function HeaderFact({ name, value }: { name: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-400">{name}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function Count({
  name,
  value,
  icon,
}: {
  name: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-700">
        {icon}
      </div>
      <p className="text-sm font-medium text-slate-500">{name}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

/**
 * The status control is the whole lifecycle affordance. There is deliberately
 * no delete: history has to survive a vendor going EXPIRED or TERMINATED, so
 * the status carries it instead.
 */
function StatusControl({ vendor }: { vendor: VendorProfile }) {
  const setStatus = useSetVendorStatus(vendor.id);

  return (
    <div className="flex items-center gap-2">
      <select
        value={vendor.status}
        disabled={setStatus.isPending}
        onChange={(event) => setStatus.mutate(event.target.value as VendorStatus)}
        className="h-8 rounded-lg border border-input bg-white px-3 text-sm font-semibold text-slate-700 outline-none"
      >
        {VENDOR_STATUSES.map((status) => (
          <option key={status} value={status}>
            {label(status)}
          </option>
        ))}
      </select>
      {setStatus.isError ? (
        <span className="text-xs text-rose-600">Status change failed</span>
      ) : null}
    </div>
  );
}

/**
 * Active assignments and projects with progress, section 16.
 *
 * Shares the assignments query with the tabs below, so this is a cache read
 * rather than a second request.
 */
function CurrentWork({ vendorId }: { vendorId: string }) {
  const { data: assignments = [] } = useVendorAssignments(vendorId);
  const active = assignments.filter(
    (assignment) => assignment.status.toUpperCase() === 'ACTIVE',
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-slate-700">Current work</h2>
      {active.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing active for this vendor right now.</p>
      ) : (
        <ul className="space-y-3">
          {active.map((assignment) => (
            <li
              key={assignment.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {assignment.entity_title ?? label(assignment.entity_type)}
                </p>
                <p className="text-xs text-slate-500">
                  {label(assignment.entity_type)} · due {formatDate(assignment.deadline)}
                </p>
              </div>
              {assignment.progress === null || assignment.progress === undefined ? null : (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-32 rounded-full bg-slate-200">
                    <div
                      className="h-1.5 rounded-full bg-green-600"
                      style={{ width: `${Math.min(100, Math.max(0, assignment.progress))}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-500">
                    {assignment.progress}%
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Profile({ vendorId }: { vendorId: string }) {
  const { data: vendor, isLoading, isError } = useVendor(vendorId);
  const access = useVendorAccess();
  const { user } = useAuth();

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Loading vendor...
      </div>
    );
  }

  if (isError || !vendor) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        Could not load this vendor.
      </div>
    );
  }

  const counts = vendor.counts ?? {};
  const performance = vendor.performance ?? {};
  // PATCH /vendors/:id also allows the vendor's own internal owner. The status
  // endpoint does not, so the two affordances have different gates.
  const canEdit = access.canWrite || vendor.owner_id === user?.id;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/vendors"
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-green-700"
        >
          <ArrowLeft size={16} />
          Vendor directory
        </Link>
      </div>

      <header className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-900">{vendor.name}</h1>
              <VendorStatusChip status={vendor.status} />
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {vendor.vendor_code}
              {vendor.vendor_type ? ` · ${vendor.vendor_type}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/vendors/${vendor.id}/deadlines`}>
              <Button variant="outline" className="gap-2">
                <CalendarClock size={16} />
                Deadlines
              </Button>
            </Link>
            {canEdit && (
              <Link href={`/vendors/${vendor.id}/edit`}>
                <Button variant="outline" className="gap-2">
                  <Pencil size={16} />
                  Edit
                </Button>
              </Link>
            )}
            {access.canWrite && <StatusControl vendor={vendor} />}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 md:grid-cols-3 xl:grid-cols-5">
          <HeaderFact name="Category" value={vendor.category?.name ?? '-'} />
          <HeaderFact name="Internal owner" value={vendor.owner_id_user?.full_name ?? '-'} />
          <HeaderFact name="Department" value={vendor.department?.name ?? '-'} />
          <HeaderFact
            name="Contract start"
            value={formatDate(vendor.current_contract?.start_date)}
          />
          <HeaderFact
            name="Contract end"
            value={formatDate(vendor.current_contract?.end_date ?? vendor.contract_end_date)}
          />
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Count
          name="Active assignments"
          value={counts.active_assignments ?? 0}
          icon={<ClipboardList size={22} />}
        />
        <Count name="Completed" value={counts.completed ?? 0} icon={<CheckCircle2 size={22} />} />
        <Count name="Overdue" value={counts.overdue ?? 0} icon={<AlertTriangle size={22} />} />
        <Count
          name="Upcoming deadlines"
          value={counts.upcoming_deadlines ?? 0}
          icon={<CalendarClock size={22} />}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">Contract</h2>
          <p className="mt-3 text-xs uppercase tracking-wide text-slate-400">Current expiry</p>
          <p className="mt-0.5 text-2xl font-bold text-slate-900">
            {formatDate(vendor.current_contract?.end_date ?? vendor.contract_end_date)}
          </p>
          {vendor.current_contract?.contract_number ? (
            <p className="mt-2 text-sm text-slate-500">
              {vendor.current_contract.contract_number}
            </p>
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <FileText size={16} className="text-green-600" />
            Documents
          </h2>
          <div className="mt-3 flex gap-8">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">On file</p>
              <p className="mt-0.5 text-2xl font-bold text-slate-900">
                {vendor.documents?.total ?? 0}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Expiring soon</p>
              <p className="mt-0.5 text-2xl font-bold text-amber-600">
                {vendor.documents?.expiring_soon ?? 0}
              </p>
            </div>
          </div>
        </div>
      </section>

      <CurrentWork vendorId={vendor.id} />

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Performance</h2>
        <div className="mt-3 flex flex-wrap items-center gap-10">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">On time</p>
            <p className="mt-0.5 text-2xl font-bold text-slate-900">
              {performance.on_time_percent === null || performance.on_time_percent === undefined
                ? '-'
                : `${Math.round(performance.on_time_percent)}%`}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Rating</p>
            <div className="mt-1.5">
              <RatingStars rating={performance.rating} />
            </div>
          </div>
        </div>
      </section>

      <VendorProfileTabs vendorId={vendor.id} />
    </div>
  );
}

export default function VendorProfilePage() {
  const params = useParams();
  const vendorId = typeof params.id === 'string' ? params.id : '';

  return (
    <VendorAccessGate>
      <Profile vendorId={vendorId} />
    </VendorAccessGate>
  );
}
