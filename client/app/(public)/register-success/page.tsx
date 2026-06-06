'use client';

import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RegisterSuccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 via-white to-green-100 px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-white/50 bg-white/80 p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <CheckCircle className="h-7 w-7 text-green-700" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900">
          Registration request submitted successfully.
        </h1>

        <p className="mt-4 whitespace-pre-line text-gray-600">
          Your account is awaiting HOD approval.

          You will be able to sign in once approved.
        </p>

        <Link href="/login" className="block">
  <Button className="mt-6 w-full bg-green-700 hover:bg-green-800">
    Back to Login
  </Button>
</Link>
      </div>
    </main>
  );
}
