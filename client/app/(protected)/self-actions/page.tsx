import { Suspense } from 'react';
import { SelfActionsClient } from '@/components/self-actions/self-actions-client';

export default function SelfActionsPage() {
  return (
    <Suspense fallback={<div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">Loading self actions...</div>}>
      <SelfActionsClient />
    </Suspense>
  );
}
