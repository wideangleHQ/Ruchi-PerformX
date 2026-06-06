'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Eye,
  EyeOff,
  User,
  Mail,
  Lock,
  Building2,
  Briefcase,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

import {
  signupSchema,
  SignupFormData,
  DEPARTMENTS,
} from '@/lib/validation';

import { authApi } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function SignupPage() {
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Role constraint state
  const [mdExists, setMdExists] = useState(false);
  const [hodTakenDepts, setHodTakenDepts] = useState<Set<string>>(new Set());
  const [constraintsLoading, setConstraintsLoading] = useState(true);

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

  const selectedRole = form.watch('role');
  const selectedDept = form.watch('departments')?.[0];

  // Load MD existence once on mount
  useEffect(() => {
    authApi.checkMdExists()
      .then((exists) => setMdExists(exists))
      .catch(() => {})
      .finally(() => setConstraintsLoading(false));
  }, []);

  // Check HOD for selected department
  useEffect(() => {
    if (selectedRole !== 'HOD' || !selectedDept) return;
    if (hodTakenDepts.has(selectedDept)) return;

    authApi.checkHodExistsByName(selectedDept).then((exists) => {
      if (exists) {
        setHodTakenDepts((prev) => new Set(prev).add(selectedDept));
      }
    }).catch(() => {});
  }, [selectedDept, selectedRole]);

  const hodBlocked = selectedRole === 'HOD' && !!selectedDept && hodTakenDepts.has(selectedDept);

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
        departmentId: data.role === 'MD' ? undefined : data.departments[0] || undefined,
      });

      router.push('/register-success');
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
    <main className="min-h-screen w-full overflow-hidden bg-gradient-to-br from-green-50 via-white to-green-100">
      <div className="flex min-h-screen flex-col md:flex-row">
        {/* Left Branding */}
        <div className="relative hidden md:flex md:w-1/2 flex-col justify-between p-12 lg:p-16 overflow-hidden">
          <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-green-200/30 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-green-300/20 blur-3xl" />

          <div className="relative z-10">
            <h1 className="text-5xl font-bold text-green-700">RUCHI PerformX</h1>
            <p className="mt-4 max-w-md text-lg text-gray-600">
              Create your enterprise account and start managing workflows efficiently.
            </p>
          </div>

          <div className="relative z-10 space-y-8">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100">
                <ArrowRight className="h-6 w-6 text-green-700" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">Performance Driven</h3>
                <p className="text-gray-600">Track productivity, goals and team performance in one place.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100">
                <ShieldCheck className="h-6 w-6 text-green-700" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">Secure & Reliable</h3>
                <p className="text-gray-600">Enterprise-grade authentication and role-based access control.</p>
              </div>
            </div>
          </div>

          <div className="relative z-10">
            <p className="text-sm text-gray-500">© {new Date().getFullYear()} RUCHI PerformX</p>
          </div>
        </div>

        {/* Signup Card */}
        <div className="relative flex w-full items-center justify-center p-6 md:w-1/2 md:p-10">
          <div className="absolute top-0 left-0 h-64 w-64 rounded-full bg-green-200/30 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-green-300/20 blur-3xl" />

          <div className="relative z-10 w-full max-w-xl rounded-3xl border border-white/50 bg-white/80 p-8 shadow-2xl backdrop-blur-xl md:p-10">
            <div className="mb-8 text-center md:hidden">
              <h1 className="text-3xl font-bold text-green-700">RUCHI PerformX</h1>
              <p className="mt-2 text-sm text-gray-500">Enterprise workflow management</p>
            </div>

            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900">Create Account</h2>
              <p className="mt-2 text-gray-500">Join RUCHI PerformX and unlock your productivity.</p>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Full Name</label>
                <div className="relative mt-2">
                  <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <Input placeholder="Enter your full name" {...form.register('name')} disabled={isLoading} className="pl-10" />
                </div>
              </div>

              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Username</label>
                <div className="relative mt-2">
                  <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <Input placeholder="Choose a username" {...form.register('username')} disabled={isLoading} className="pl-10" />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <div className="relative mt-2">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <Input type="email" placeholder="Enter your email" {...form.register('email')} disabled={isLoading} className="pl-10" />
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <div className="relative mt-2">
                  <Briefcase className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <select
                    {...form.register('role')}
                    disabled={isLoading || constraintsLoading}
                    className="w-full rounded-md border border-gray-300 bg-white py-2 pl-10 pr-3 text-gray-900 disabled:opacity-50"
                  >
                    <option value="">Select role</option>
                    <option value="MD" disabled={mdExists}>
                      Managing Director{mdExists ? ' (position filled)' : ''}
                    </option>
                    <option value="HOD">Head of Department</option>
                    <option value="EMPLOYEE">Employee</option>
                  </select>
                </div>
                {selectedRole === 'MD' && mdExists && (
                  <p className="mt-1 text-sm text-red-600">Managing Director already exists.</p>
                )}
              </div>

              {/* Department */}
              {selectedRole !== 'MD' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Department</label>
                  <div className="relative mt-2">
                    <Building2 className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <select
                      value={form.watch('departments')[0] ?? ''}
                      onChange={(e) =>
                        form.setValue('departments', e.target.value ? [e.target.value] : [], { shouldValidate: true })
                      }
                      disabled={isLoading}
                      className="w-full rounded-md border border-gray-300 bg-white py-2 pl-10 pr-3 text-gray-900"
                    >
                      <option value="">Select Department</option>
                      {DEPARTMENTS.map((dept) => {
                        const isTaken = selectedRole === 'HOD' && hodTakenDepts.has(dept);
                        return (
                          <option key={dept} value={dept} disabled={isTaken}>
                            {dept}{isTaken ? ' (HOD position filled)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  {hodBlocked && (
                    <p className="mt-1 text-sm text-red-600">HOD already exists for this department.</p>
                  )}
                </div>
              )}

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <div className="relative mt-2">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Minimum 8 characters"
                    {...form.register('password')}
                    disabled={isLoading}
                    className="pl-10 pr-12"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">
                    {showPassword ? <EyeOff className="h-5 w-5 text-gray-500" /> : <Eye className="h-5 w-5 text-gray-500" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
                <div className="relative mt-2">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm password"
                    {...form.register('confirmPassword')}
                    disabled={isLoading}
                    className="pl-10 pr-12"
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">
                    {showConfirmPassword ? <EyeOff className="h-5 w-5 text-gray-500" /> : <Eye className="h-5 w-5 text-gray-500" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading || constraintsLoading || (selectedRole === 'MD' && mdExists) || hodBlocked}
                className="h-12 w-full bg-green-700 hover:bg-green-800"
              >
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </Button>

              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Already have an account?{' '}
                  <Link href="/login" className="font-semibold text-green-700 hover:underline">
                    Login here
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
