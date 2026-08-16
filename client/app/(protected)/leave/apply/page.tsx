'use client';

import Link from 'next/link';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import { ApplyLeaveForm } from '@/components/leave/ApplyLeaveForm';

export default function ApplyLeavePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/leave" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-green-700">
          <ArrowLeft size={16} />
          Back to my leave
        </Link>
        <div className="mt-3 mb-2 inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
          <CalendarDays size={14} />
          Leave
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Apply for Leave</h1>
        <p className="mt-1 text-sm text-slate-500">
          Holidays and weekly offs are excluded from the day count before it reaches your balance.
        </p>
      </div>

      <ApplyLeaveForm />
    </div>
  );
}
