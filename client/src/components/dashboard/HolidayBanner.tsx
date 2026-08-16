'use client';

import { CalendarDays, PartyPopper } from 'lucide-react';
import type { UpcomingHoliday } from '@/api/types';

interface HolidayBannerProps {
  holiday: UpcomingHoliday | null | undefined;
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(value));

/** "Today" and "Tomorrow" read better than "in 0 days", which reads like a bug. */
const countdownLabel = (days: number) => {
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
};

export function HolidayBanner({ holiday }: HolidayBannerProps) {
  if (!holiday) return null;

  const isImminent = holiday.daysAway <= 1;

  return (
    <section className="flex flex-col gap-4 overflow-hidden rounded-2xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50/40 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-700 text-white">
          {isImminent ? <PartyPopper size={22} /> : <CalendarDays size={22} />}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
            Next holiday
          </p>
          <p className="mt-0.5 text-lg font-bold text-slate-900">{holiday.name}</p>
          <p className="text-sm text-slate-600">{formatDate(holiday.holidayDate)}</p>
        </div>
      </div>

      <div className="flex items-baseline gap-2 rounded-xl border border-green-200 bg-white px-4 py-3 sm:flex-col sm:items-end sm:gap-0">
        <span className="text-2xl font-bold tracking-tight text-green-700">
          {countdownLabel(holiday.daysAway)}
        </span>
        {holiday.daysAway > 1 ? (
          <span className="text-xs font-medium text-slate-500">to go</span>
        ) : null}
      </div>
    </section>
  );
}
