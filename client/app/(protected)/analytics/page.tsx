'use client';

import { useAuth } from '@/context/AuthContext';
import { redirect } from 'next/navigation';

export default function AnalyticsPage() {
  const { user } = useAuth();

  // Only MD can access analytics
  if (user && user.role !== 'MD') {
    redirect('/dashboard');
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
      <p className="mt-2 text-gray-600">Company-wide analytics and insights - Coming soon</p>
    </div>
  );
}
