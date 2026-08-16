'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { VendorDeadline } from '@/api/vendors';
import { useVendor, useVendorDeadlines } from '@/hooks/useVendors';
import { VendorAccessGate } from '@/components/vendors/VendorAccessGate';
import { formatDate, label } from '@/components/vendors/VendorChips';

/**
 * Overdue beats soon when both are set, because the row is already late and
 * saying "due soon" about it would be wrong.
 */
function flag(deadline: VendorDeadline) {
  if (deadline.is_overdue) {
    return (
      <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
        OVERDUE
      </span>
    );
  }
  if (deadline.is_soon) {
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
        DUE SOON
      </span>
    );
  }
  return <span className="text-xs text-slate-400">Scheduled</span>;
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
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
          Nothing scheduled for this vendor.
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
                    key={`${deadline.source}-${deadline.entity_id ?? deadline.date}-${deadline.label}`}
                    className="hover:bg-slate-50/60"
                  >
                    <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-900">
                      {formatDate(deadline.date)}
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
