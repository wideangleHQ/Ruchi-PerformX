'use client';

import Link from 'next/link';
import { useNotifications, useMarkNotificationRead } from '@/hooks/useQueries';

export default function NotificationsPage() {
  const { data: notificationsData, isLoading, isError } = useNotifications({ limit: 50 });
  const markRead = useMarkNotificationRead();

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
      <p className="mt-2 text-gray-600">All your notifications in one place</p>

      {isLoading ? (
        <p className="mt-8 text-gray-600">Loading notifications...</p>
      ) : isError ? (
        <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-medium text-red-700">
            Could not load notifications. Refresh to try again.
          </p>
        </div>
      ) : notificationsData?.data && notificationsData.data.length > 0 ? (
        <ul className="mt-8 space-y-3">
          {notificationsData.data.map((notification) => (
            <li
              key={notification.id}
              className={`rounded-lg border p-4 ${
                notification.isRead ? 'bg-white' : 'border-blue-200 bg-blue-50'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{notification.title}</p>
                  <p className="mt-1 text-sm text-gray-600">{notification.message}</p>
                  <p className="mt-2 text-xs text-gray-500">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </div>
                {!notification.isRead && (
                  <button
                    type="button"
                    onClick={() => markRead.mutate(notification.id)}
                    disabled={markRead.isPending}
                    className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50"
                  >
                    Mark read
                  </button>
                )}
              </div>
              {notification.taskId && (
                <Link
                  href={`/tasks/${notification.taskId}`}
                  className="mt-3 inline-block text-sm font-medium text-blue-700 hover:underline"
                >
                  Open task
                </Link>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-8 rounded-lg bg-gray-50 p-8 text-center">
          <p className="text-gray-600">No notifications</p>
        </div>
      )}
    </div>
  );
}
