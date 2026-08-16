'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

import { ASSET_TYPES, type AssetType } from '@/api/assets';
import { useCreateAsset } from '@/hooks/useAssets';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Props = {
  open: boolean;
  onClose: () => void;
};

const BLANK = {
  assetType: 'PASSWORD' as AssetType,
  label: '',
  username: '',
  secret: '',
  url: '',
  notes: '',
};

/**
 * Add one asset owned by the caller. The secret is posted once and encrypted
 * server side; nothing here keeps it after submit.
 */
export function CreateAssetDialog({ open, onClose }: Props) {
  const create = useCreateAsset();
  const toast = useToast();
  const [form, setForm] = useState(BLANK);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(BLANK);
      setFile(null);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const isDocument = form.assetType === 'DOCUMENT';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      await create.mutateAsync({
        assetType: form.assetType,
        label: form.label.trim(),
        username: form.username.trim() || undefined,
        secret: form.secret || undefined,
        url: form.url.trim() || undefined,
        notes: form.notes.trim() || undefined,
        file,
      });
      toast.success('Asset saved');
      onClose();
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string | string[] } } }).response
        ?.data?.message;
      setError(Array.isArray(message) ? (message[0] ?? 'Could not save') : (message ?? 'Could not save'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-xl rounded-xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Add an asset</h2>
            <p className="text-sm text-gray-500">
              Passwords are encrypted before they are stored and only you, an EA, a PA or the MD
              can read them back.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form className="space-y-4 p-5" onSubmit={submit}>
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Type *</label>
              <select
                value={form.assetType}
                onChange={(event) =>
                  setForm((current) => ({ ...current, assetType: event.target.value as AssetType }))
                }
                className="h-8 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none"
              >
                {ASSET_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Label *</label>
              <Input
                value={form.label}
                onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                required
                placeholder="Bank portal"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Username</label>
              <Input
                value={form.username}
                onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                autoComplete="off"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">URL</label>
              <Input
                value={form.url}
                onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))}
                placeholder="https://"
              />
            </div>
          </div>

          {isDocument ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">File *</label>
              <Input
                type="file"
                required
                accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Secret {form.assetType === 'PASSWORD' ? '*' : ''}
              </label>
              <Input
                type="password"
                value={form.secret}
                onChange={(event) => setForm((current) => ({ ...current, secret: event.target.value }))}
                required={form.assetType === 'PASSWORD'}
                autoComplete="new-password"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-green-700 text-white hover:bg-green-800"
              disabled={create.isPending}
            >
              {create.isPending ? 'Saving...' : 'Save asset'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
