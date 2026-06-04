'use client';

import { useAuth } from '@/context/AuthContext';

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
      <p className="mt-2 text-gray-600">Manage your profile information</p>

      {user && (
        <div className="mt-8 rounded-lg bg-white p-6 shadow">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700">Name</p>
              <p className="mt-1 text-gray-900">{user.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Email</p>
              <p className="mt-1 text-gray-900">{user.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Username</p>
              <p className="mt-1 text-gray-900">{user.username}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Role</p>
              <p className="mt-1 text-gray-900">{user.role}</p>
            </div>
            {user.department && (
              <div>
                <p className="text-sm font-medium text-gray-700">Department</p>
                <p className="mt-1 text-gray-900">{user.department}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
