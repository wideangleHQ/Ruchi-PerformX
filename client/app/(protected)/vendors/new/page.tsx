'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useCreateVendor } from '@/hooks/useVendors';
import { VendorAccessGate } from '@/components/vendors/VendorAccessGate';
import { VendorForm } from '@/components/vendors/VendorForm';

function CreateVendor() {
  const router = useRouter();
  const createVendor = useCreateVendor();

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
        <h1 className="text-3xl font-bold text-slate-900">New Vendor</h1>
        <p className="mt-1 text-slate-500">
          The vendor record. Contracts, documents and assignments are added from the
          profile once it exists.
        </p>
      </div>

      <VendorForm
        submitLabel="Create Vendor"
        isSubmitting={createVendor.isPending}
        error={createVendor.isError ? 'Could not create this vendor. Check the fields and try again.' : null}
        onCancel={() => router.push('/vendors')}
        onSubmit={(payload) =>
          createVendor.mutate(payload, {
            onSuccess: (vendor) => router.push(`/vendors/${vendor.id}`),
          })
        }
      />
    </div>
  );
}

export default function NewVendorPage() {
  return (
    <VendorAccessGate>
      <CreateVendor />
    </VendorAccessGate>
  );
}
