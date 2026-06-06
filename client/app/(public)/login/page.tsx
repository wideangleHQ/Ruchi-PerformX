'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Eye,
  EyeOff,
  User,
  Lock,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { loginSchema, LoginFormData } from '@/lib/validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setError(null);
      setIsLoading(true);

      const user = await login(data);

      if (user.role === 'ADMIN') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      const status = err?.response?.data?.status;
      const backendMessage = err?.response?.data?.message;
      const errorMessage =
        status === 'PENDING'
          ? 'Your account is awaiting HOD approval.'
          : status === 'REJECTED'
            ? 'Your registration request has been rejected.'
            : backendMessage || 'Login failed';

      setError(
        Array.isArray(errorMessage)
          ? errorMessage.join(', ')
          : errorMessage,
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full overflow-hidden bg-gradient-to-br from-green-50 via-white to-green-100">
      <div className="flex min-h-screen flex-col md:flex-row">
        {/* Left Branding Section */}
        <div className="relative hidden md:flex md:w-1/2 flex-col justify-between p-12 lg:p-16 overflow-hidden">
          {/* Decorative Blobs */}
          <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-green-200/30 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-green-300/20 blur-3xl" />

          <div className="relative z-10">
            <h1 className="text-5xl font-bold tracking-tight text-green-700">
              RUCHI PerformX
            </h1>

            <p className="mt-4 max-w-md text-lg text-gray-600">
              Enterprise workflow management platform built for
              performance, accountability and growth.
            </p>
          </div>

          <div className="relative z-10 space-y-8">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100">
                <ArrowRight className="h-6 w-6 text-green-700" />
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Accelerate Operations
                </h3>

                <p className="mt-1 text-gray-600">
                  Monitor workflows, tasks and team performance in
                  real-time.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100">
                <ShieldCheck className="h-6 w-6 text-green-700" />
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Enterprise Security
                </h3>

                <p className="mt-1 text-gray-600">
                  Secure authentication, role-based access and
                  protected business workflows.
                </p>
              </div>
            </div>
          </div>

          <div className="relative z-10">
            <p className="text-sm text-gray-500">
              © {new Date().getFullYear()} RUCHI PerformX. All rights
              reserved.
            </p>
          </div>
        </div>

        {/* Login Section */}
        <div className="relative flex w-full items-center justify-center p-6 md:w-1/2 md:p-10">
          {/* Mobile Background Glow */}
          <div className="absolute top-0 left-0 h-64 w-64 rounded-full bg-green-200/30 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-green-300/20 blur-3xl" />

          <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/50 bg-white/80 p-8 shadow-2xl backdrop-blur-xl md:p-10">
            {/* Mobile Logo */}
            <div className="mb-8 text-center md:hidden">
              <h1 className="text-3xl font-bold text-green-700">
                RUCHI PerformX
              </h1>

              <p className="mt-2 text-sm text-gray-500">
                Enterprise workflow management
              </p>
            </div>

            {/* Header */}
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900">
                Welcome Back
              </h2>

              <p className="mt-2 text-gray-500">
                Enter your credentials to access your dashboard.
              </p>
            </div>

            {/* Form */}
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-5"
            >
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-medium text-red-700">
                    {error}
                  </p>
                </div>
              )}

              {/* Username */}
              <div>
                <label
                  htmlFor="username"
                  className="block text-sm font-medium text-gray-700"
                >
                  Username
                </label>

                <div className="relative mt-2">
                  <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />

                  <Input
                    id="username"
                    placeholder="Enter your username"
                    {...form.register('username')}
                    disabled={isLoading}
                    className="h-12 pl-10"
                  />
                </div>

                {form.formState.errors.username && (
                  <p className="mt-1 text-sm text-red-600">
                    {
                      form.formState.errors.username
                        .message
                    }
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Password
                  </label>

                  <Link
                    href="/forgot-password"
                    className="text-sm font-medium text-green-700 hover:text-green-800"
                  >
                    Forgot password?
                  </Link>
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />

                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    {...form.register('password')}
                    disabled={isLoading}
                    className="h-12 pl-10 pr-12"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(!showPassword)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 transition hover:text-gray-700"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>

                {form.formState.errors.password && (
                  <p className="mt-1 text-sm text-red-600">
                    {
                      form.formState.errors.password
                        .message
                    }
                  </p>
                )}
              </div>

              {/* Login Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="h-12 w-full bg-green-700 text-white hover:bg-green-800"
              >
                {isLoading ? (
                  'Logging in...'
                ) : (
                  <div className="flex items-center gap-2">
                    Login
                    <ArrowRight className="h-4 w-4" />
                  </div>
                )}
              </Button>

              {/* Signup */}
              <div className="pt-2 text-center">
                <p className="text-sm text-gray-600">
                  Don&apos;t have an account?{' '}
                  <Link
                    href="/signup"
                    className="font-semibold text-green-700 hover:underline"
                  >
                    Sign up here
                  </Link>
                </p>
              </div>
            </form>

            {/* Footer Badges */}
            <div className="mt-8 flex justify-center gap-4 border-t pt-6 text-xs text-gray-500">
              <span>Secure Login</span>
              <span>•</span>
              <span>Role Based Access</span>
              <span>•</span>
              <span>PerformX</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
