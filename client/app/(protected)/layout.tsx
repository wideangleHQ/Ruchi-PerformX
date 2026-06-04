'use client';

import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect to login if not authenticated
  // if (!isLoading && !isAuthenticated) {
  //   redirect('/login');
  // }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-gray-600">Loading...</p>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
