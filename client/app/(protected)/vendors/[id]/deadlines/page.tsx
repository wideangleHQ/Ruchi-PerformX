'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { VendorDeadline } from '@/api/vendors';
import { useVendor, useVendorDeadlines } from '@/hooks/useVendors';
import { VendorAccessGate } from '@/components/vendors/VendorAccessGate';
import { formatDate, label } from '@/components/vendors/VendorChips';

/**
 * The server has already decided which of the three this row is, using the same
 * calculator the nightly sweep uses. Deriving it again here from the date is
 * how two screens end up a day apart and nobody can say which one is lying.
 */
function flag(deadline: VendorDeadline) {
  if (deadline.flag === 'OVERDUE') {
    return (
      <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
        OVERDUE
      </span>
    );
  }
  if (deadline.flag === 'SOON') {
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
        DUE SOON
      </span>
    );
  }
  return <span className="text-xs text-slate-400">Scheduled</span>;
}

/** "in 12 days", "tomorrow", "8 days overdue". */
function when(days: number) {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days overdue`;
}

function Deadlines({ vendorId }: { vendorId: string }) {
  const { data: vendor } = useVendor(vendorId);
  const { data: deadlines = [], isLoading, isError } = useVendorDeadlines(vendorId);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/vendors/${vendorId}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-green-700"
        >
          <ArrowLeft size={16} />
          {vendor?.name ?? 'Vendor'}
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">Deadlines</h1>
        <p className="mt-1 text-slate-500">
          Contract expiry, renewals, document expiry, assignment and project deadlines,
          deliverable due dates and reviews, soonest first.
        </p>
      </div>

      {isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          Could not load deadlines for this vendor.
        </div>
      ) : isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading deadlines...
        </div>
      ) : deadlines.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-700">Nothing scheduled for this vendor.</p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
            Deadlines are not entered here. This screen collects the dates already on
            the vendor&apos;s records, so add one of those and it appears:
          </p>
          <ul className="mx-auto mt-3 max-w-md space-y-1 text-left text-sm text-slate-500">
            <li>Contracts: the end date and the renewal date</li>
            <li>Documents: the expiry date</li>
            <li>Assignments: the due date, while the assignment is active</li>
            <li>Deliverables: the due date, until it is accepted or rejected</li>
          </ul>
          <Link
            href={`/vendors/${vendorId}`}
            className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-green-700 hover:underline"
          >
            Open the vendor profile
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['Date', 'What', 'Source', ''].map((head) => (
                    <th
                      key={head}
                      className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deadlines.map((deadline) => (
                  <tr
                    key={`${deadline.source}-${deadline.id}`}
                    className="hover:bg-slate-50/60"
                  >
                    <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-900">
                      {formatDate(deadline.date)}
                      <span className="block text-xs font-normal text-slate-400">
                        {when(deadline.days_until)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-700">{deadline.label}</td>
                    <td className="px-5 py-4 text-slate-500">{label(deadline.source)}</td>
                    <td className="px-5 py-4">{flag(deadline)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VendorDeadlinesPage() {
  const params = useParams();
  const vendorId = typeof params.id === 'string' ? params.id : '';

  return (
    <VendorAccessGate>
      <Deadlines vendorId={vendorId} />
    </VendorAccessGate>
  );
}
