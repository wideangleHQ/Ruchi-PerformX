'use client';

import { useAuth } from '@/context/AuthContext';

export function Header() {
  const { user } = useAuth();
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  return (
    <header className="mb-8 flex items-center justify-between">
      <div>
        <h2 className="font-headline-lg text-headline-lg text-on-surface">
          Welcome, {user?.fullName || 'Michael'}
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant">{formattedDate}</p>
      </div>

      <div className="flex items-center gap-4">
        <button className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high">
          <span className="material-symbols-outlined">search</span>
        </button>
        <button className="relative flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high">
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
        </button>
        <button className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high">
          <span className="material-symbols-outlined">settings</span>
        </button>
      </div>
    </header>
  );
}
