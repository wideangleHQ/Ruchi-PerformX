'use client';

import { Cake } from 'lucide-react';
import type { Birthday } from '@/api/types';

interface BirthdayCardsProps {
  birthdays: Birthday[];
}

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

/**
 * Nothing renders on a day with no birthdays. An empty "No birthdays today"
 * panel would take permanent space on the busiest screen to say nothing.
 */
export function BirthdayCards({ birthdays }: BirthdayCardsProps) {
  if (birthdays.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Cake size={18} className="text-green-700" />
        <h2 className="text-lg font-bold text-slate-900">
          {birthdays.length === 1 ? 'Birthday today' : 'Birthdays today'}
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {birthdays.map((person) => (
          <article
            key={person.id}
            className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-green-200 hover:shadow-md"
          >
            <div
              aria-hidden
              className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-green-50 transition-transform group-hover:scale-110"
            />
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-green-700 to-emerald-500 text-lg font-bold text-white shadow-sm">
              {initials(person.fullName) || <Cake size={22} />}
            </div>
            <div className="relative min-w-0">
              <p className="truncate text-base font-bold text-slate-900">
                {person.fullName}
              </p>
              <p className="truncate text-sm text-slate-500">
                {person.departmentName ?? 'No department'}
              </p>
              <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                <Cake size={12} />
                Happy birthday
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
