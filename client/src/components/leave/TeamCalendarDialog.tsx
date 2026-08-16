'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { leaveTypeName } from '@/api/leave';
import { useLeaveCalendar, useLeaveTypes } from '@/hooks/useLeave';
import { WEEKLY_OFF_DAYS, dayKey } from '@/lib/leaveValidation';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * Who is on leave in a month, scoped by the API to what the viewer may see.
 * Plain date arithmetic on a CSS grid; a calendar library would be a dependency
 * for one screen that only needs a weekday offset and a day count.
 */
export function TeamCalendarDialog({ open, onClose }: Props) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: applications = [], isLoading } = useLeaveCalendar({ month, year }, open);
  const { data: types = [] } = useLeaveTypes();

  const days = useMemo(() => {
    const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();

    return Array.from({ length: firstWeekday + dayCount }, (_, index) => {
      if (index < firstWeekday) return null;
      const dayOfMonth = index - firstWeekday + 1;
      const key = `${year}-${String(month).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
      return {
        key,
        dayOfMonth,
        isWeeklyOff: WEEKLY_OFF_DAYS.includes(index % 7),
        onLeave: applications
          .filter((item) => dayKey(item.start_date) <= key && key <= dayKey(item.end_date))
          .map((item) => ({
            id: item.id,
            name: item.user_id_user?.full_name ?? 'Employee',
            type: leaveTypeName(types, item.leave_type_id),
          })),
      };
    });
  }, [applications, types, month, year]);

  const shiftMonth = (step: number) => {
    const next = new Date(Date.UTC(year, month - 1 + step, 1));
    setMonth(next.getUTCMonth() + 1);
    setYear(next.getUTCFullYear());
  };

  if (!open) return null;

  const monthLabel = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Team Calendar</h2>
            <p className="text-sm text-slate-500">Who is on leave, before you decide.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center justify-between px-5 py-3">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
          >
            <ChevronLeft size={16} />
          </button>
          <p className="text-sm font-semibold text-slate-900">{monthLabel}</p>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-5">
          <div className="grid grid-cols-7 gap-px rounded-xl border border-slate-200 bg-slate-200 text-xs">
            {WEEKDAYS.map((weekday) => (
              <div key={weekday} className="bg-slate-50 px-2 py-2 text-center font-semibold text-slate-500">
                {weekday}
              </div>
            ))}
            {days.map((day, index) =>
              day ? (
                <div
                  key={day.key}
                  className={`min-h-[88px] p-2 ${day.isWeeklyOff ? 'bg-slate-50' : 'bg-white'}`}
                >
                  <span className="text-xs font-semibold text-slate-500">{day.dayOfMonth}</span>
                  <div className="mt-1 space-y-1">
                    {day.onLeave.map((entry) => (
                      <div
                        key={entry.id}
                        title={entry.type}
                        className="truncate rounded-md bg-green-50 px-1.5 py-0.5 text-[11px] font-medium text-green-700 ring-1 ring-green-200"
                      >
                        {entry.name}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div key={`blank-${index}`} className="min-h-[88px] bg-white" />
              ),
            )}
          </div>

          {isLoading ? <p className="mt-3 text-sm text-slate-500">Loading calendar...</p> : null}
          {!isLoading && !applications.length ? (
            <p className="mt-3 text-sm text-slate-500">Nobody is on leave this month.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
