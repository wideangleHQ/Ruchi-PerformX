'use client';

import Link from 'next/link';
import { Vendor } from '@/api/vendors';
import { VendorStatusChip, formatDate } from './VendorChips';

const HEADS = [
  'Vendor',
  'Category',
  'Internal Owner',
  'Active Work',
  'Next Deadline',
  'Contract Expiry',
  'Status',
];

/**
 * The directory list, section 17.
 *
 * There is no delete column and there will not be one: a vendor's lifecycle is
 * carried by its status, which is edited on the profile.
 */
export function VendorTable({
  vendors,
  isLoading,
}: {
  vendors: Vendor[];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Loading vendors...
      </div>
    );
  }

  if (!vendors.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
        No vendors match these filters.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              {HEADS.map((head) => (
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
            {vendors.map((vendor) => (
              <tr key={vendor.id} className="hover:bg-slate-50/60">
                <td className="px-5 py-4">
                  <Link
                    href={`/vendors/${vendor.id}`}
                    className="font-semibold text-slate-900 hover:text-green-700"
                  >
                    {vendor.name}
                  </Link>
                  <p className="text-xs text-slate-400">{vendor.vendor_code}</p>
                </td>
                <td className="px-5 py-4 text-slate-600">{vendor.category?.name ?? '-'}</td>
                <td className="px-5 py-4 text-slate-600">
                  {vendor.owner_id_user?.full_name ?? '-'}
                  {vendor.department?.name ? (
                    <p className="text-xs text-slate-400">{vendor.department.name}</p>
                  ) : null}
                </td>
                <td className="px-5 py-4 text-slate-600">{vendor.active_work_count ?? 0}</td>
                <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                  {formatDate(vendor.next_deadline)}
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                  {formatDate(vendor.contract_end_date)}
                </td>
                <td className="px-5 py-4">
                  <VendorStatusChip status={vendor.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
