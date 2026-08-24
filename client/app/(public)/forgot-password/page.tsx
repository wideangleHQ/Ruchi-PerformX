'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, ForgotPasswordFormData } from '@/lib/validation';
import { authApi } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  // The next step is entering the emailed code, not a success page. The old
  // flow routed to one from the `catch` as well as the `try`, so a failed send
  // read as a sent mail and the user waited for an email that never came.
  //
  // Not revealing whether an address exists is handled on the server, which
  // answers the same way either way, so there is nothing to hide here.
  const onSubmit = async (data: ForgotPasswordFormData) => {
    setError(null);
    setIsLoading(true);
    try {
      await authApi.forgotPassword({ email: data.email });
      router.push(`/verify-otp?email=${encodeURIComponent(data.email)}&type=reset`);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string | string[] } } })
        ?.response?.data?.message;
      setError(
        Array.isArray(message)
          ? message.join(', ')
          : (message ??
              'Could not send the reset code. Ask your HOD, EA, PA or the MD to reset your password instead.'),
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Forgot Password</h1>
          <p className="mt-2 text-gray-600">Enter your email to request a password reset</p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <Input
              type="email"
              placeholder="Enter your email"
              {...form.register('email')}
              className="mt-1"
              disabled={isLoading}
            />
            {form.formState.errors.email && (
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.email.message}</p>
            )}
          </div>

          <Button type="submit" disabled={isLoading} className="w-full bg-green-600 hover:bg-green-700">
            {isLoading ? 'Submitting...' : 'Submit Request'}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <a href="/login" className="text-sm font-medium text-green-600 hover:text-green-700">
            Back to login
          </a>
        </div>
      </div>
    </div>
  );
}
