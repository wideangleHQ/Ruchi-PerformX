'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/hooks/useQueries';
import { Bell, Settings } from 'lucide-react';
import { useState } from 'react';

export function Header() {
  const { user } = useAuth();
  const { data: notificationsData } = useNotifications({ limit: 5 });
  const [showNotifications, setShowNotifications] = useState(false);

  const unreadCount = notificationsData?.data?.filter((n) => !n.read)?.length || 0;

  return (
    <header className="border-b bg-white">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Welcome, {user?.name}
          </h2>
          <p className="text-sm text-gray-500">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative rounded-lg p-2 hover:bg-gray-100"
            >
              <Bell size={20} className="text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute right-0 top-0 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-semibold text-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border bg-white shadow-lg">
                <div className="border-b px-4 py-3">
                  <h3 className="font-semibold text-gray-900">Notifications</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notificationsData?.data && notificationsData.data.length > 0 ? (
                    <ul className="divide-y">
                      {notificationsData.data.map((notification) => (
                        <li
                          key={notification.id}
                          className={`px-4 py-3 text-sm hover:bg-gray-50 ${
                            !notification.read ? 'bg-blue-50' : ''
                          }`}
                        >
                          <p className="font-medium text-gray-900">
                            {notification.title}
                          </p>
                          <p className="text-gray-600">{notification.message}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="px-4 py-6 text-center text-sm text-gray-500">
                      No notifications
                    </div>
                  )}
                </div>
                <div className="border-t px-4 py-2">
                  <Link
                    href="/notifications"
                    className="text-sm font-medium text-green-600 hover:text-green-700"
                    onClick={() => setShowNotifications(false)}
                  >
                    View all notifications
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Settings Link */}
          <Link
            href="/settings"
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            <Settings size={20} className="text-gray-600" />
          </Link>
        </div>
      </div>
    </header>
  );
}
