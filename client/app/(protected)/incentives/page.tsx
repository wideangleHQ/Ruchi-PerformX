'use client';

import { useAuth } from '@/context/AuthContext';
import { redirect } from 'next/navigation';

export default function IncentivesPage() {
  const { user } = useAuth();

  // Only MD can access incentives
  if (user && user.role !== 'MD') {
    redirect('/dashboard');
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900">Incentives</h1>
      <p className="mt-2 text-gray-600">Manage employee incentives - Coming soon</p>
    </div>
  );
}
