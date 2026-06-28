'use client';

import { usePathname } from 'next/navigation';

function getPageTitle(pathname: string) {
  const parts = pathname.split('/').filter(Boolean);
  const lastPart = parts[parts.length - 1];
  
  if (!lastPart) return 'Reception';

  return lastPart
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function ReceptionHeader() {
  const pathname = usePathname();
  const title = getPageTitle(pathname || '');
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-x-4 border-b bg-white px-6 shadow-sm">
      <div className="flex flex-1 items-center gap-x-4 lg:gap-x-6">
        <div className="flex flex-col justify-center">
          <h1 className="text-xl font-semibold leading-7 text-gray-900 font-poppins">
            {title}
          </h1>
          {/* Breadcrumb Placeholder */}
          <div className="text-xs text-gray-500">
            Reception / {title}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-x-4 lg:gap-x-6">
        <div className="hidden sm:block text-sm font-medium text-gray-500">
          {currentDate}
        </div>
        <div className="flex items-center justify-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
          Reception Desk
        </div>
        {/* Right-side placeholder for future notifications/profile */}
        <div className="h-8 w-8 rounded-full bg-gray-200" aria-hidden="true" />
      </div>
    </header>
  );
}
