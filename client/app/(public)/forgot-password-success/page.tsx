'use client';

import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ForgotPasswordSuccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <CheckCircle className="h-7 w-7 text-green-600" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900">
          Password reset request submitted successfully.
        </h1>

        <p className="mt-4 text-gray-600">
          Please contact your HOD for approval.
        </p>

        <Button asChild className="mt-6 w-full bg-green-600 hover:bg-green-700">
          <Link href="/login">Back to Login</Link>
        </Button>
      </div>
    </main>
  );
}
