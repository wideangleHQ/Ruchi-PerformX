'use client';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { User } from '@/api/types';

interface UserTableProps {
  users: User[];
  isLoading?: boolean;
  onEdit?: (user: User) => void;
  onDelete?: (userId: string) => void;
}

export function UserTable({
  users,
  isLoading,
  onEdit,
  onDelete,
}: UserTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-gray-600">Loading users...</p>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-600">No users found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full">
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
              Name
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
              Email
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
              Username
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
              Role
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
              Department
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, index) => (
            <tr
              key={user.id}
              className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
            >
              <td className="px-6 py-4 text-sm text-gray-900">{user.name}</td>
              <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
              <td className="px-6 py-4 text-sm text-gray-600">{user.username}</td>
              <td className="px-6 py-4">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                    user.role === 'ADMIN'
                      ? 'bg-red-100 text-red-800'
                      : user.role === 'MD'
                        ? 'bg-purple-100 text-purple-800'
                        : user.role === 'PURCHASE_HEAD'
                          ? 'bg-indigo-100 text-indigo-800'
                          : user.role === 'DEPARTMENT_CONTROLLER'
                            ? 'bg-teal-100 text-teal-800'
                          : user.role === 'HOD'
                            ? 'bg-blue-100 text-blue-800'
                            : user.role === 'EA'
                              ? 'bg-orange-100 text-orange-800'
                              : user.role === 'PA'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-green-100 text-green-800'
                  }`}
                >
                  {user.role}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">
                {user.department || '-'}
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit?.(user)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete?.(user.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
