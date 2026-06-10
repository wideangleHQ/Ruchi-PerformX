'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SelfAction, SelfActionPriority } from '@/api/self-actions';

type Props = {
  open: boolean;
  action?: SelfAction | null;
  onClose: () => void;
  onSubmit: (values: { title: string; description: string; priority: SelfActionPriority }) => Promise<void>;
  isPending?: boolean;
  error?: string | null;
};

export function EditSelfActionDialog({ open, action, onClose, onSubmit, isPending, error }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<SelfActionPriority>('MEDIUM');

  useEffect(() => {
    if (open && action) {
      setTitle(action.title);
      setDescription(action.description);
      setPriority(action.priority);
    }
  }, [open, action]);

  if (!open || !action) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Edit Action</h2>
            <p className="text-sm text-slate-500">Update the selected self action.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <form
          className="space-y-4 p-5"
          onSubmit={async (event) => {
            event.preventDefault();
            await onSubmit({ title, description, priority });
          }}
        >
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Title *</label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description *</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
              rows={5}
              className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Priority *</label>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as SelfActionPriority)}
              className="h-8 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none"
            >
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
