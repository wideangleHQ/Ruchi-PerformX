'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useUpdateVendor, useVendor } from '@/hooks/useVendors';
import { VendorAccessGate } from '@/components/vendors/VendorAccessGate';
import { VendorForm } from '@/components/vendors/VendorForm';

function EditVendor({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const { data: vendor, isLoading, isError } = useVendor(vendorId);
  const updateVendor = useUpdateVendor(vendorId);

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

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/vendors/${vendorId}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-green-700"
        >
          <ArrowLeft size={16} />
          {vendor.name}
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">Edit Vendor</h1>
        <p className="mt-1 text-slate-500">
          Status lives on the profile, contracts have their own screen.
        </p>
      </div>

      <VendorForm
        vendor={vendor}
        submitLabel="Save Changes"
        isSubmitting={updateVendor.isPending}
        error={updateVendor.isError ? 'Could not save this vendor. Check the fields and try again.' : null}
        onCancel={() => router.push(`/vendors/${vendorId}`)}
        onSubmit={(payload) =>
          updateVendor.mutate(payload, {
            onSuccess: () => router.push(`/vendors/${vendorId}`),
          })
        }
      />
    </div>
  );
}

export default function EditVendorPage() {
  const params = useParams();
  const vendorId = typeof params.id === 'string' ? params.id : '';

  return (
    <VendorAccessGate>
      <EditVendor vendorId={vendorId} />
    </VendorAccessGate>
  );
}
