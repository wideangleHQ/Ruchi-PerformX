'use client';

import { CheckCircle2, ClipboardList, CircleDot, Clock3 } from 'lucide-react';

type SelfActionStatsProps = {
  total: number;
  open: number;
  ongoing: number;
  completed: number;
};

const cards = [
  { key: 'total', label: 'Total Actions', icon: ClipboardList },
  { key: 'open', label: 'Open Actions', icon: CircleDot },
  { key: 'ongoing', label: 'Ongoing Actions', icon: Clock3 },
  { key: 'completed', label: 'Completed Actions', icon: CheckCircle2 },
] as const;

export function SelfActionsStats({ total, open, ongoing, completed }: SelfActionStatsProps) {
  const values = { total, open, ongoing, completed };

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ key, label, icon: Icon }) => (
        <div
          key={label}
          className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-700">
            <Icon size={22} />
          </div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            {values[key].toLocaleString()}
          </p>
        </div>
      ))}
    </section>
  );
}
