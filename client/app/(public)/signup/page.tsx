'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signupSchema, SignupFormData, DEPARTMENTS } from '@/lib/validation';
import { authApi } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      username: '',
      email: '',
      name: '',
      password: '',
      confirmPassword: '',
      role: undefined,
      departments: [],
    },
  });

  const onSubmit = async (data: SignupFormData) => {
    try {
      setError(null);
      setIsLoading(true);

      await authApi.register({
        username: data.username,
        email: data.email,
        fullName: data.name,
        password: data.password,
        role: data.role,
        departmentId: data.departments[0] || undefined,
      });

      // Pass email to verify-otp page via query param
      router.push(`/verify-otp?email=${encodeURIComponent(data.email)}&type=registration`);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Registration failed. Please try again.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Create Account</h1>
          <p className="mt-2 text-gray-600">Join RUCHI PerformX</p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">Full Name</label>
            <Input
              placeholder="Enter your full name"
              {...form.register('name')}
              className="mt-1"
              disabled={isLoading}
            />
            {form.formState.errors.name && (
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Username</label>
            <Input
              placeholder="Choose a username"
              {...form.register('username')}
              className="mt-1"
              disabled={isLoading}
            />
            {form.formState.errors.username && (
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.username.message}</p>
            )}
          </div>

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

          <div>
            <label className="block text-sm font-medium text-gray-700">Role</label>
            <select
              {...form.register('role')}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-green-500 focus:outline-none focus:ring-green-500 disabled:bg-gray-50"
              disabled={isLoading}
            >
              <option value="">Select a role</option>
              <option value="MD">Managing Director</option>
              <option value="HOD">Head of Department</option>
              <option value="EMPLOYEE">Employee</option>
            </select>
            {form.formState.errors.role && (
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.role.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Department (optional)</label>
            <select
              value={form.watch('departments')[0] ?? ''}
              onChange={(e) =>
                form.setValue('departments', e.target.value ? [e.target.value] : [], {
                  shouldValidate: true,
                })
              }
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-green-500 focus:outline-none focus:ring-green-500 disabled:bg-gray-50"
              disabled={isLoading}
            >
              <option value="">Select department</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            {form.formState.errors.departments && (
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.departments.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <Input
              type="password"
              placeholder="Min. 8 characters"
              {...form.register('password')}
              className="mt-1"
              disabled={isLoading}
            />
            {form.formState.errors.password && (
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.password.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
            <Input
              type="password"
              placeholder="Confirm your password"
              {...form.register('confirmPassword')}
              className="mt-1"
              disabled={isLoading}
            />
            {form.formState.errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.confirmPassword.message}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            {isLoading ? 'Creating Account...' : 'Sign Up'}
          </Button>

          <p className="text-center text-sm text-gray-600">
            Already have an account?{' '}
            <a href="/login" className="font-medium text-green-600 hover:text-green-700">
              Login here
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
