'use client';

import { useAuth } from '@/context/AuthContext';

export default function AdminPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
        <p className="mt-2 text-gray-600">System administration features</p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
        <p className="mt-2 text-gray-600">
          Coming soon - Manage users, roles, and permissions
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Audit Logs</h2>
        <p className="mt-2 text-gray-600">
          Coming soon - View system activity and audit trails
        </p>
      </div>
    </div>
  );
}
