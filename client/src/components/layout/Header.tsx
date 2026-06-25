'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Bell, UserCircle2 } from 'lucide-react';

export function Header() {
  const { user } = useAuth();
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6 lg:px-8">
      <div className="hidden sm:block">
        <h2 className="text-lg font-semibold text-slate-900">
          Welcome, {user?.fullName || 'Michael'}
        </h2>
        <p className="text-sm text-slate-500">{formattedDate}</p>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 sm:gap-4 sm:flex-none">
        <button className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100">
          <Bell size={20} />
          <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-600" />
        </button>
        <Link
          href="/profile"
          className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 md:hidden"
          aria-label="Profile"
        >
          <UserCircle2 size={20} />
        </Link>
        <Link
          href="/profile"
          className="hidden md:flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100"
          aria-label="Profile"
        >
          <UserCircle2 size={20} />
        </Link>
      </div>
    </header>
  );
}
