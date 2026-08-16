'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUsers } from '@/hooks/useQueries';

type Values = {
  name: string;
  eventDate: string;
  venue?: string;
  budgetEstimated?: string;
  coordinatorIds?: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: Values) => Promise<void>;
  isPending?: boolean;
  error?: string | null;
};

export function CreateEventDialog({ open, onClose, onSubmit, isPending, error }: Props) {
  const [name, setName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [venue, setVenue] = useState('');
  const [budget, setBudget] = useState('');
  const [coordinatorIds, setCoordinatorIds] = useState<string[]>([]);

  const { data: users } = useUsers({ limit: 200 });
  const people = users?.data ?? [];

  useEffect(() => {
    if (open) {
      setName('');
      setEventDate('');
      setVenue('');
      setBudget('');
      setCoordinatorIds([]);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">New Event</h2>
            <p className="text-sm text-slate-500">Name it, date it, and set what you expect to spend.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <form
          className="space-y-4 p-5"
          onSubmit={async (event) => {
            event.preventDefault();
            await onSubmit({
              name,
              eventDate: new Date(eventDate).toISOString(),
              ...(venue.trim() ? { venue: venue.trim() } : {}),
              ...(budget.trim() ? { budgetEstimated: budget.trim() } : {}),
              ...(coordinatorIds.length ? { coordinatorIds } : {}),
            });
          }}
        >
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Event Name *</label>
            <Input value={name} onChange={(event) => setName(event.target.value)} required maxLength={255} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Date *</label>
              <Input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Venue</label>
              <Input value={venue} onChange={(event) => setVenue(event.target.value)} maxLength={255} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Estimated Budget</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
            />
            <p className="mt-1 text-xs text-slate-500">Rupees. Leave it blank if nobody has agreed a number yet.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Coordinators</label>
            <div className="mt-2 grid max-h-48 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3">
              {people.length ? (
                people.map((person) => (
                  <label key={person.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={coordinatorIds.includes(person.id)}
                      onChange={(event) =>
                        setCoordinatorIds(
                          event.target.checked
                            ? [...coordinatorIds, person.id]
                            : coordinatorIds.filter((id) => id !== person.id),
                        )
                      }
                      className="h-4 w-4 rounded border-slate-300 text-green-700"
                    />
                    {person.fullName}
                    <span className="text-xs text-slate-400">{person.role}</span>
                  </label>
                ))
              ) : (
                <p className="text-sm text-slate-500">No users to pick from.</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-green-700 hover:bg-green-800" disabled={isPending}>
              {isPending ? 'Saving...' : 'Create Event'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
