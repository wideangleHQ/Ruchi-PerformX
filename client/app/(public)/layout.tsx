'use client';

import { useAuth } from '@/context/AuthContext';
import { redirect } from 'next/navigation';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect to dashboard if already logged in
  if (isAuthenticated && !isLoading) {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
