'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { canViewEmployeeAssets } from '@/api/assets';
import { useAssetDirectory, useEmployeeAssets } from '@/hooks/useAssets';
import { useAuth } from '@/context/AuthContext';
import { AssetTable } from '@/components/assets/asset-table';
import { HandoverPanel } from '@/components/assets/handover-panel';

/**
 * One employee's assets, for HR, EA, PA and MD. This is the offboarding view:
 * the list on top, the handover pickers below it. The API refuses anyone else,
 * the role check here only keeps the page from rendering an empty shell.
 */
export default function EmployeeAssetsPage() {
  const params = useParams<{ userId: string }>();
  const userId = typeof params?.userId === 'string' ? params.userId : null;
  const { user } = useAuth();

  const canOffboard = canViewEmployeeAssets(user?.role);
  const { data, isLoading, error } = useEmployeeAssets(canOffboard ? userId : null);
  const { data: directory = [] } = useAssetDirectory(canOffboard);

  const employee = directory.find((person) => person.id === userId);

  if (!canOffboard) {
    return (
      <p className="rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-600 shadow-sm">
        Employee assets are visible to HR, EA, PA and the MD.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/assets"
        className="inline-flex items-center gap-1 text-sm text-green-700 hover:underline"
      >
        <ArrowLeft size={16} /> All assets
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">{employee?.fullName ?? 'Employee'} assets</h1>
        <p className="mt-2 text-gray-600">
          Everything this person holds, and the handover state of each one.
        </p>
      </div>

      {isLoading ? <p className="text-sm text-gray-500">Loading assets...</p> : null}
      {error ? (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          Could not load this employee&apos;s assets.
        </p>
      ) : null}

      {data && userId ? (
        <>
          <AssetTable assets={data.assets} emptyMessage="This employee holds no assets." />
          <HandoverPanel
            employeeId={userId}
            assets={data.assets}
            handovers={data.handovers}
            directory={directory}
          />
        </>
      ) : null}
    </div>
  );
}
