'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/useToast';
import { launchCareerX } from '@/api/career';
import { Loader2 } from 'lucide-react';

export default function CareerPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  // Guard against StrictMode double-fire and re-renders
  const launched = useRef(false);

  useEffect(() => {
    if (isLoading) return;

    const isHRDepartment = user?.departmentName?.toLowerCase() === 'hr';

    if (!user || !isHRDepartment) {
      router.replace('/dashboard');
      return;
    }

    if (launched.current) return;
    launched.current = true;

    const token = localStorage.getItem('accessToken');

    if (!token) {
      toast.error('Authentication token not found. Please log in again.');
      router.replace('/dashboard');
      return;
    }

    launchCareerX(token).catch((error: any) => {
      toast.error(error.message || 'CareerX authentication could not be completed.');
      router.replace('/dashboard');
    });
  }, [user, isLoading, router, toast]);

  return (
    <div className="flex h-[80vh] w-full items-center justify-center flex-col gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      <p className="text-slate-500 font-medium animate-pulse">Redirecting to CareerX...</p>
      <p className="text-xs text-slate-400">Establishing secure connection...</p>
    </div>
  );
}
