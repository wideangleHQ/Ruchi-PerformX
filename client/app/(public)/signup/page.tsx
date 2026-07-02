'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, User, Mail, Lock, Building2, Briefcase, ArrowRight, ShieldCheck } from 'lucide-react';
import { z } from 'zod';

const signupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(6, 'Minimum 6 characters'),
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
  role: z.enum(['MD', 'EA', 'PA', 'PURCHASE_HEAD', 'DEPARTMENT_CONTROLLER', 'HOD', 'EMPLOYEE'], { error: 'Please select a role' }),
  departments: z.array(z.string()),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
}).refine((data) => {
  if (['MD', 'EA', 'PA', 'PURCHASE_HEAD'].includes(data.role)) return true;
  if (data.role === 'EMPLOYEE') return data.departments.length === 1;
  if (data.role === 'HOD' || data.role === 'DEPARTMENT_CONTROLLER') return data.departments.length >= 1;
  return true;
}, {
  message: 'Invalid department selection for the chosen role',
  path: ['departments'],
});

type SignupFormData = z.infer<typeof signupSchema>;
import { authApi } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Department } from '@/api/users';

function normalizeDepartments(depts: Department[]): Department[] {
  return depts;
}

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [mdExists, setMdExists] = useState(false);
  const [eaExists, setEaExists] = useState(false);
  const [paExists, setPaExists] = useState(false);
  const [hodTakenDepts, setHodTakenDepts] = useState<Set<string>>(new Set());
  const [constraintsLoading, setConstraintsLoading] = useState(true);

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { username: '', email: '', name: '', password: '', confirmPassword: '', role: undefined, departments: [] },
  });

  const selectedRole = form.watch('role');
  const selectedDepts = form.watch('departments') || [];

  // Clear departments when role changes to MD, EA, or PA
  useEffect(() => {
    if (selectedRole && ['MD', 'EA', 'PA', 'PURCHASE_HEAD'].includes(selectedRole)) {
      form.setValue('departments', [], { shouldValidate: true });
    }
  }, [selectedRole, form]);

  useEffect(() => {
    Promise.all([authApi.checkMdExists(), authApi.checkEaExists(), authApi.checkPaExists(), authApi.getDepartments()])
      .then(([mdExistsRes, eaExistsRes, paExistsRes, list]) => {
        setMdExists(mdExistsRes);
        setEaExists(eaExistsRes);
        setPaExists(paExistsRes);
        setDepartments(normalizeDepartments(list));
      })
      .catch(() => setError('Failed to load configuration. Please refresh.'))
      .finally(() => setConstraintsLoading(false));
  }, []);

  useEffect(() => {
    if (selectedRole !== 'HOD') return;
    selectedDepts.forEach((deptId) => {
      if (hodTakenDepts.has(deptId)) return;
      authApi.checkHodExists(deptId).then((exists: boolean) => {
        if (exists) setHodTakenDepts((prev) => new Set(prev).add(deptId));
      }).catch(() => {});
    });
  }, [selectedDepts, selectedRole, hodTakenDepts]);

  const isMultiDeptRole = selectedRole === 'HOD' || selectedRole === 'DEPARTMENT_CONTROLLER';
  const anyHodBlocked = selectedRole === 'HOD' && selectedDepts.some((id) => hodTakenDepts.has(id));

  const onSubmit = async (data: SignupFormData) => {
    if (isLoading) return; 
    try {
      setError(null);
      setIsLoading(true);
      const noDepRole = ['MD', 'EA', 'PA', 'PURCHASE_HEAD'].includes(data.role);
      await authApi.register({
        username: data.username,
        email: data.email,
        fullName: data.name,
        password: data.password,
        role: data.role,
        departmentId: noDepRole ? undefined : (isMultiDeptRole ? undefined : data.departments[0]),
        departmentIds: noDepRole ? undefined : (isMultiDeptRole ? data.departments : undefined),
      });
      router.push('/register-success');
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Registration failed. Please try again.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full overflow-hidden bg-gradient-to-br from-green-50 via-white to-green-100">
      <div className="flex min-h-screen flex-col md:flex-row">
        <div className="relative hidden md:flex md:w-1/2 flex-col justify-between p-12 lg:p-16 overflow-hidden">
          <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-green-200/30 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-green-300/20 blur-3xl" />
          <div className="relative z-10">
            <h1 className="text-5xl font-bold text-green-700">RUCHI PerformX</h1>
            <p className="mt-4 max-w-md text-lg text-gray-600">Create your enterprise account and start managing workflows efficiently.</p>
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

              <div>
                <label className="block text-sm font-medium text-gray-700">Full Name</label>
                <div className="relative mt-2">
                  <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <Input placeholder="Enter your full name" {...form.register('name')} disabled={isLoading} className="pl-10" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Username</label>
                <div className="relative mt-2">
                  <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <Input placeholder="Choose a username" {...form.register('username')} disabled={isLoading} className="pl-10" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <div className="relative mt-2">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <Input type="email" placeholder="Enter your email" {...form.register('email')} disabled={isLoading} className="pl-10" />
                </div>
              </div>

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
                    <option value="MD" disabled={mdExists}>Managing Director{mdExists ? ' (position filled)' : ''}</option>
                    <option value="EA" disabled={eaExists}>Executive Assistant{eaExists ? ' (position filled)' : ''}</option>
                    <option value="PA" disabled={paExists}>Personal Assistant{paExists ? ' (position filled)' : ''}</option>
                    <option value="PURCHASE_HEAD">Purchase Head</option>
                    <option value="DEPARTMENT_CONTROLLER">Department Controller</option>
                    <option value="HOD">Head of Department</option>
                    <option value="EMPLOYEE">Employee</option>
                  </select>
                </div>
                {selectedRole === 'MD' && mdExists && (
                  <p className="mt-1 text-sm text-red-600">Managing Director already exists.</p>
                )}
                {selectedRole === 'EA' && eaExists && (
                  <p className="mt-1 text-sm text-red-600">Executive Assistant already exists.</p>
                )}
                {selectedRole === 'PA' && paExists && (
                  <p className="mt-1 text-sm text-red-600">Personal Assistant already exists.</p>
                )}
              </div>

              {selectedRole && !['MD', 'EA', 'PA', 'PURCHASE_HEAD'].includes(selectedRole) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Department(s)</label>
                  {isMultiDeptRole ? (
                    <div className="grid grid-cols-2 gap-3 p-4 rounded-lg border border-gray-200 bg-white/50">
                      {departments.map((dept) => {
                        const isTaken = selectedRole === 'HOD' && hodTakenDepts.has(dept.id);
                        return (
                          <label key={dept.id} className={`flex items-center gap-2 text-sm cursor-pointer ${isTaken ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <input
                              type="checkbox"
                              checked={selectedDepts.includes(dept.id)}
                              disabled={isLoading || isTaken}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...selectedDepts, dept.id]
                                  : selectedDepts.filter((d) => d !== dept.id);
                                form.setValue('departments', next, { shouldValidate: true });
                              }}
                              className="rounded border-gray-300 text-green-700 focus:ring-green-500"
                            />
                            <span>{dept.name}{isTaken ? ' (Filled)' : ''}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="relative">
                      <Building2 className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                      <select
                        value={selectedDepts[0] ?? ''}
                        onChange={(e) => form.setValue('departments', e.target.value ? [e.target.value] : [], { shouldValidate: true })}
                        disabled={isLoading}
                        className="w-full rounded-md border border-gray-300 bg-white py-2 pl-10 pr-3 text-gray-900"
                      >
                        <option value="">Select Department</option>
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {anyHodBlocked && (
                    <p className="mt-1 text-sm text-red-600">One or more selected departments already have an HOD assigned.</p>
                  )}
                </div>
              )}

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
                disabled={isLoading || constraintsLoading || (selectedRole === 'MD' && mdExists) || (selectedRole === 'EA' && eaExists) || (selectedRole === 'PA' && paExists) || anyHodBlocked}
                className="h-12 w-full bg-green-700 hover:bg-green-800"
              >
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </Button>

              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Already have an account?{' '}
                  <Link href="/login" className="font-semibold text-green-700 hover:underline">Login here</Link>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
