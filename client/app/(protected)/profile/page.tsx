'use client';

import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Building2, Mail, PencilLine, Phone, Save, Shield, UserCircle2, UserRound, Loader2 } from 'lucide-react';
import { profileApi, type UpdateProfilePayload } from '@/api/profile';
import { useToast } from '@/hooks/useToast';

type ProfileFormState = {
  fullName: string;
  username: string;
  email: string;
  mobileNumber: string;
};

const emptyForm: ProfileFormState = {
  fullName: '',
  username: '',
  email: '',
  mobileNumber: '',
};

const getErrorMessage = (error: any) =>
  error?.response?.data?.message || error?.message || 'Failed to load profile';

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<ProfileFormState>(emptyForm);

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: () => profileApi.getProfile(),
  });

  useEffect(() => {
    if (profileQuery.data) {
      setForm({
        fullName: profileQuery.data.fullName || '',
        username: profileQuery.data.username || '',
        email: profileQuery.data.email || '',
        mobileNumber: profileQuery.data.mobileNumber || '',
      });
    }
  }, [profileQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateProfilePayload) => profileApi.updateProfile(payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(['profile'], updated);
      setForm({
        fullName: updated.fullName || '',
        username: updated.username || '',
        email: updated.email || '',
        mobileNumber: updated.mobileNumber || '',
      });
      toast.success('Profile updated successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error));
    },
  });

  const profile = profileQuery.data;
  const initials = useMemo(() => {
    const source = profile?.fullName || 'RPX';
    return source
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }, [profile?.fullName]);

  const handleChange = (field: keyof ProfileFormState) => (e: ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, [field]: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!profile) return;

    const fullName = form.fullName.trim();
    const username = form.username.trim();
    const email = form.email.trim();
    const mobileNumber = form.mobileNumber.trim();

    if (!fullName || !username || !email) return;

    const payload: UpdateProfilePayload = {
      fullName,
      username,
      email,
      mobileNumber: mobileNumber || undefined,
    };

    await updateMutation.mutateAsync(payload);
  };

  const isLoading = profileQuery.isLoading;
  const errorMessage = profileQuery.error ? getErrorMessage(profileQuery.error) : null;
  const emptyState = !isLoading && !errorMessage && !profile;

  const summaryItems = profile
    ? [
        { label: 'Username', value: profile.username || '—' },
        { label: 'Email', value: profile.email || '—', icon: Mail },
        { label: 'Mobile Number', value: profile.mobileNumber || '—', icon: Phone },
        { label: 'Designation', value: profile.designation || '—', icon: Shield },
        { label: 'Role', value: profile.role || '—', icon: UserRound },
        { label: 'Department', value: profile.departmentId || '—', icon: Building2 },
        { label: 'Department Name', value: profile.departmentName || '—', icon: Building2 },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
            <UserCircle2 size={16} />
            Profile
          </div>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">My Profile</h1>
          <p className="mt-1 text-slate-500">Manage your account details</p>
        </div>
        <Link
          href="#edit-profile"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-700 transition hover:bg-green-100"
        >
          <PencilLine size={16} />
          Edit Profile
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="animate-pulse space-y-4">
              <div className="h-20 w-20 rounded-full bg-slate-200" />
              <div className="h-6 w-40 rounded bg-slate-200" />
              <div className="h-4 w-56 rounded bg-slate-100" />
              <div className="space-y-3 pt-4">
                <div className="h-12 rounded-lg bg-slate-100" />
                <div className="h-12 rounded-lg bg-slate-100" />
                <div className="h-12 rounded-lg bg-slate-100" />
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="animate-pulse space-y-4">
              <div className="h-6 w-36 rounded bg-slate-200" />
              <div className="h-10 rounded-lg bg-slate-100" />
              <div className="h-10 rounded-lg bg-slate-100" />
              <div className="h-10 rounded-lg bg-slate-100" />
              <div className="h-10 rounded-lg bg-slate-100" />
            </div>
          </div>
        </div>
      ) : errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5" size={18} />
            <div>
              <p className="font-semibold">Unable to load profile</p>
              <p className="mt-1 text-sm">{errorMessage}</p>
            </div>
          </div>
        </div>
      ) : emptyState ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-slate-600">No profile data found.</p>
        </div>
      ) : profile ? (
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-green-700 to-green-500 text-2xl font-bold text-white shadow-sm">
                  {initials || 'RP'}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{profile.fullName || '—'}</h2>
                  <p className="mt-1 text-sm text-slate-500">@{profile.username || '—'}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                      {profile.designation || '—'}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {profile.departmentName || 'No department'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {summaryItems.map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {Icon ? <Icon size={14} /> : null}
                      {item.label}
                    </div>
                    <p className="mt-1 break-words text-sm font-semibold text-slate-900">{item.value}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section id="edit-profile" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Edit Profile</h2>
                <p className="mt-1 text-sm text-slate-500">Only editable fields will be saved.</p>
              </div>
              {updateMutation.isPending ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                  <Loader2 size={14} className="animate-spin" />
                  Saving
                </span>
              ) : null}
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {updateMutation.error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {getErrorMessage(updateMutation.error)}
                </div>
              ) : null}

              <Field label="Full Name">
                <input
                  value={form.fullName}
                  onChange={handleChange('fullName')}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
                />
              </Field>

              <Field label="Username">
                <input
                  value={form.username}
                  onChange={handleChange('username')}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
                />
              </Field>

              <Field label="Email">
                <input
                  type="email"
                  value={form.email}
                  onChange={handleChange('email')}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
                />
              </Field>

              <Field label="Mobile Number">
                <input
                  value={form.mobileNumber}
                  onChange={handleChange('mobileNumber')}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <ReadonlyField label="Designation" value={profile.designation || '—'} />
                <ReadonlyField label="Role" value={profile.role || '—'} />
                <ReadonlyField label="Department" value={profile.departmentId || '—'} />
                <ReadonlyField label="Department Name" value={profile.departmentName || '—'} />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {updateMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save Changes
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
