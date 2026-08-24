'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle } from 'lucide-react';
import { authApi } from '@/api/auth';
import { changePasswordSchema, type ChangePasswordFormData } from '@/lib/validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * The only way to set a password that does not go through email.
 *
 * `POST /auth/change-password` was implemented on day one and never called;
 * Settings said "Coming soon". With the OTP path depending on a verified Resend
 * domain, this is the path that works today.
 */
export function ChangePasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const form = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (data: ChangePasswordFormData) => {
    setError(null);
    try {
      await authApi.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      form.reset();
      setDone(true);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string | string[] } } })
        ?.response?.data?.message;
      setError(
        Array.isArray(message) ? message.join(', ') : (message ?? 'Could not change your password.'),
      );
    }
  };

  const field = (name: keyof ChangePasswordFormData) => form.formState.errors[name]?.message;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 max-w-md space-y-4">
      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {done && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-4"
        >
          <CheckCircle className="h-4 w-4 text-green-600" />
          <p className="text-sm text-green-800">
            Password changed. It applies the next time you sign in.
          </p>
        </div>
      )}

      <div>
        <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">
          Current password
        </label>
        <Input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          className="mt-1"
          {...form.register('currentPassword')}
        />
        {field('currentPassword') && (
          <p className="mt-1 text-sm text-red-600">{field('currentPassword')}</p>
        )}
      </div>

      <div>
        <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
          New password
        </label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          className="mt-1"
          {...form.register('newPassword')}
        />
        {field('newPassword') && (
          <p className="mt-1 text-sm text-red-600">{field('newPassword')}</p>
        )}
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
          Confirm new password
        </label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          className="mt-1"
          {...form.register('confirmPassword')}
        />
        {field('confirmPassword') && (
          <p className="mt-1 text-sm text-red-600">{field('confirmPassword')}</p>
        )}
      </div>

      <Button
        type="submit"
        disabled={form.formState.isSubmitting}
        className="bg-green-600 hover:bg-green-700"
      >
        {form.formState.isSubmitting ? 'Changing...' : 'Change Password'}
      </Button>
    </form>
  );
}
