'use client';

import { useNotifications } from '@/hooks/useQueries';

export default function NotificationsPage() {
  const { data: notificationsData, isLoading } = useNotifications({ limit: 50 });

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
      <p className="mt-2 text-gray-600">All your notifications in one place</p>

      {isLoading ? (
        <p className="mt-8">Loading notifications...</p>
      ) : notificationsData?.data && notificationsData.data.length > 0 ? (
        <div className="mt-8 space-y-3">
          {notificationsData.data.map((notification) => (
            <div
              key={notification.id}
              className={`rounded-lg border p-4 ${
                !notification.read ? 'bg-blue-50' : 'bg-white'
              }`}
            >
              <p className="font-medium text-gray-900">{notification.title}</p>
              <p className="mt-1 text-sm text-gray-600">{notification.message}</p>
              <p className="mt-2 text-xs text-gray-500">
                {new Date(notification.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-lg bg-gray-50 p-8 text-center">
          <p className="text-gray-600">No notifications</p>
        </div>
      )}
    </div>
  );
}
