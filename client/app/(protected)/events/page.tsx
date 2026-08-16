'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BarChart3, Plus, Trash2 } from 'lucide-react';
import { useEvents, useCreateEvent, useDeleteEvent } from '@/hooks/useEvents';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { CreateEventDialog } from '@/components/events/CreateEventDialog';
import { formatDate, formatMoney, statusTone } from '@/components/events/format';

export default function EventsPage() {
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: events = [], isLoading } = useEvents();
  const createEvent = useCreateEvent();
  const deleteEvent = useDeleteEvent();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Events</h1>
          <p className="mt-1 text-gray-500">Company events, their coordinators, and what they cost</p>
        </div>
        <Button className="gap-2 bg-green-700 hover:bg-green-800" onClick={() => setCreating(true)}>
          <Plus size={18} />
          New Event
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading events...
        </div>
      ) : !events.length ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
          No events yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['Event', 'Date', 'Venue', 'Status', 'Estimated', 'Created By', ''].map((head) => (
                    <th key={head} className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      <Link href={`/events/${event.id}`} className="hover:text-green-700">
                        {event.name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">{formatDate(event.event_date)}</td>
                    <td className="px-5 py-4 text-slate-600">{event.venue ?? '-'}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[event.status]}`}>
                        {event.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">{formatMoney(event.budget_estimated)}</td>
                    <td className="px-5 py-4 text-slate-600">{event.created_by_id_user?.full_name ?? '-'}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <Link href={`/events/${event.id}/budget`}>
                          <Button variant="outline" size="icon-sm" title="Budget report">
                            <BarChart3 size={16} />
                          </Button>
                        </Link>
                        {user?.role === 'MD' || user?.id === event.created_by_id ? (
                          <Button
                            variant="destructive"
                            size="icon-sm"
                            title="Delete event"
                            disabled={deleteEvent.isPending}
                            onClick={() => deleteEvent.mutate(event.id)}
                          >
                            <Trash2 size={16} />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CreateEventDialog
        open={creating}
        onClose={() => setCreating(false)}
        isPending={createEvent.isPending}
        error={error}
        onSubmit={async (values) => {
          setError(null);
          try {
            await createEvent.mutateAsync(values);
            setCreating(false);
          } catch {
            setError('Could not create the event. Check the budget is a plain amount and try again.');
          }
        }}
      />
    </div>
  );
}
