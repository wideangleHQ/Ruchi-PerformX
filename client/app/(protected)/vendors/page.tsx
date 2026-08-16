'use client';

import { useState } from 'react';
import Link from 'next/link';
import { KeyRound, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VendorFilters } from '@/api/vendors';
import { useVendorAccess, useVendors } from '@/hooks/useVendors';
import { VendorAccessGate } from '@/components/vendors/VendorAccessGate';
import { VendorDirectoryFilters } from '@/components/vendors/VendorDirectoryFilters';
import { VendorTable } from '@/components/vendors/VendorTable';

function Directory() {
  const [filters, setFilters] = useState<VendorFilters>({});
  const { data: vendors = [], isLoading, isError } = useVendors(filters);
  const access = useVendorAccess();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Vendor Management</h1>
          <p className="mt-1 text-slate-500">
            RUCHI&apos;s record of its vendors and agencies, their work, contracts and
            deadlines.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {access.canManageAccess && (
            <Link href="/vendors/access">
              <Button variant="outline" className="gap-2">
                <KeyRound size={16} />
                Access Management
              </Button>
            </Link>
          )}
          {access.canWrite && (
            <Link href="/vendors/new">
              <Button className="gap-2 bg-green-600 hover:bg-green-700">
                <Plus size={18} />
                New Vendor
              </Button>
            </Link>
          )}
        </div>
      </div>

      <VendorDirectoryFilters
        initialValues={filters}
        onApply={setFilters}
        onReset={() => setFilters({})}
      />

      {isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          Could not load the vendor directory. Try again in a moment.
        </div>
      ) : (
        <VendorTable vendors={vendors} isLoading={isLoading} />
      )}
    </div>
  );
}

export default function VendorsPage() {
  return (
    <VendorAccessGate>
      <Directory />
    </VendorAccessGate>
  );
}
