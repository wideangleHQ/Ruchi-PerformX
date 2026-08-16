'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Plus } from 'lucide-react';

import { canViewEmployeeAssets } from '@/api/assets';
import { useAssets, useAssetDirectory, usePendingHandovers } from '@/hooks/useAssets';
import { useAuth } from '@/context/AuthContext';
import { AssetTable } from '@/components/assets/asset-table';
import { CreateAssetDialog } from '@/components/assets/create-asset-dialog';
import { PendingHandovers } from '@/components/assets/pending-handovers';
import { Button } from '@/components/ui/button';

type Tab = 'mine' | 'pending' | 'employees';

export default function AssetsPage() {
  const { user } = useAuth();
  const { data: assets = [], isLoading } = useAssets();
  const { data: pending = [] } = usePendingHandovers();
  const [tab, setTab] = useState<Tab>('mine');
  const [creating, setCreating] = useState(false);

  const canOffboard = canViewEmployeeAssets(user?.role);
  const { data: directory = [] } = useAssetDirectory(canOffboard);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'mine', label: 'My assets' },
    { key: 'pending', label: `Pending handovers${pending.length ? ` (${pending.length})` : ''}` },
    ...(canOffboard ? [{ key: 'employees' as Tab, label: 'Employee assets' }] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Assets</h1>
          <p className="mt-2 text-gray-600">
            Company credentials, licences and documents. Every reveal is recorded.
          </p>
        </div>
        <Button
          type="button"
          className="bg-green-700 text-white hover:bg-green-800"
          onClick={() => setCreating(true)}
        >
          <Plus size={16} /> Add asset
        </Button>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={
              tab === item.key
                ? 'border-b-2 border-green-700 px-4 py-2 text-sm font-semibold text-green-700'
                : 'border-b-2 border-transparent px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-800'
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'mine' ? (
        isLoading ? (
          <p className="text-sm text-gray-500">Loading assets...</p>
        ) : (
          <AssetTable
            assets={assets}
            canDelete
            emptyMessage="No assets yet. Add the first one to keep it out of a spreadsheet."
          />
        )
      ) : null}

      {tab === 'pending' ? <PendingHandovers /> : null}

      {tab === 'employees' && canOffboard ? (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Employee assets</h2>
            <p className="text-sm text-gray-500">
              Open an employee to see what they hold and to run an offboarding handover.
            </p>
          </div>
          <ul className="divide-y divide-gray-100">
            {directory.map((person) => (
              <li key={person.id}>
                <Link
                  href={`/assets/employee/${person.id}`}
                  className="flex items-center justify-between px-5 py-3 text-sm hover:bg-gray-50"
                >
                  <span>
                    <span className="font-medium text-gray-900">{person.fullName}</span>
                    <span className="ml-2 text-gray-500">{person.role}</span>
                  </span>
                  <ArrowRight size={16} className="text-green-700" />
                </Link>
              </li>
            ))}
            {!directory.length ? (
              <li className="px-5 py-8 text-center text-sm text-gray-500">No employees found.</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <CreateAssetDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
