'use client';

import { useState } from 'react';
import { Check, Copy, Eye, EyeOff, FileDown, Trash2 } from 'lucide-react';

import type { CompanyAsset } from '@/api/assets';
import { useDeleteAsset, useRevealSecret } from '@/hooks/useAssets';
import { useToast } from '@/hooks/useToast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Props = {
  assets: CompanyAsset[];
  /** Show the delete column. The API is the real gate; this only hides the button. */
  canDelete?: boolean;
  emptyMessage?: string;
};

function errorMessage(error: unknown, fallback: string) {
  const response = (error as { response?: { data?: { message?: string | string[] } } }).response;
  const message = response?.data?.message;
  if (Array.isArray(message)) return message[0] ?? fallback;
  return message ?? fallback;
}

/**
 * The asset list. Labels, usernames and URLs come from the list response; the
 * secret is never in it. Copy and Show each cost one `/reveal` call and one
 * audit row, which is why neither runs on render.
 */
export function AssetTable({ assets, canDelete = false, emptyMessage }: Props) {
  const reveal = useRevealSecret();
  const remove = useDeleteAsset();
  const toast = useToast();
  const [shown, setShown] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copySecret = async (asset: CompanyAsset) => {
    try {
      const { secret } = await reveal.mutateAsync(asset.id);
      await navigator.clipboard.writeText(secret);
      setCopiedId(asset.id);
      setTimeout(() => setCopiedId((id) => (id === asset.id ? null : id)), 2000);
      toast.success('Secret copied. The access is in the audit log.');
    } catch (error) {
      toast.error(errorMessage(error, 'Could not read that secret'));
    }
  };

  const toggleShown = async (asset: CompanyAsset) => {
    if (shown[asset.id]) {
      setShown(({ [asset.id]: _hidden, ...rest }) => rest);
      return;
    }

    try {
      const { secret } = await reveal.mutateAsync(asset.id);
      setShown((current) => ({ ...current, [asset.id]: secret }));
      // Back to dots on its own, so a secret is not left on a shared screen.
      setTimeout(() => setShown(({ [asset.id]: _expired, ...rest }) => rest), 30_000);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not read that secret'));
    }
  };

  const deleteAsset = async (asset: CompanyAsset) => {
    if (!window.confirm(`Delete "${asset.label}"?`)) return;
    try {
      await remove.mutateAsync(asset.id);
      toast.success('Asset deleted');
    } catch (error) {
      toast.error(errorMessage(error, 'Could not delete that asset'));
    }
  };

  if (!assets.length) {
    return (
      <p className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        {emptyMessage ?? 'Nothing here yet.'}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3">Label</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Username</th>
            <th className="px-4 py-3">URL</th>
            <th className="px-4 py-3">Owner</th>
            <th className="px-4 py-3">Secret</th>
            {canDelete ? <th className="px-4 py-3" /> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {assets.map((asset) => (
            <tr key={asset.id} className="align-middle">
              <td className="px-4 py-3 font-medium text-gray-900">
                {asset.label}
                {asset.notes ? <p className="text-xs font-normal text-gray-500">{asset.notes}</p> : null}
              </td>
              <td className="px-4 py-3">
                <Badge variant="outline">{asset.asset_type}</Badge>
              </td>
              <td className="px-4 py-3 text-gray-700">{asset.username || '-'}</td>
              <td className="px-4 py-3">
                {asset.url ? (
                  <a
                    href={asset.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-green-700 underline underline-offset-2"
                  >
                    Open
                  </a>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
              <td className="px-4 py-3 text-gray-700">{asset.owner_name || '-'}</td>
              <td className="px-4 py-3">
                {asset.has_secret ? (
                  <div className="flex items-center gap-2">
                    <code className="min-w-24 rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700">
                      {shown[asset.id] ?? '••••••••••'}
                    </code>
                    <Button
                      type="button"
                      size="sm"
                      className="bg-green-700 text-white hover:bg-green-800"
                      onClick={() => copySecret(asset)}
                      disabled={reveal.isPending}
                    >
                      {copiedId === asset.id ? <Check size={14} /> : <Copy size={14} />}
                      {copiedId === asset.id ? 'Copied' : 'Copy'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => toggleShown(asset)}
                      disabled={reveal.isPending}
                      aria-label={shown[asset.id] ? 'Hide secret' : 'Show secret'}
                    >
                      {shown[asset.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </Button>
                  </div>
                ) : asset.file_url ? (
                  <a
                    href={asset.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-green-700 underline underline-offset-2"
                  >
                    <FileDown size={14} /> Download
                  </a>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
              {canDelete ? (
                <td className="px-4 py-3 text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteAsset(asset)}
                    disabled={remove.isPending}
                    aria-label={`Delete ${asset.label}`}
                  >
                    <Trash2 size={14} />
                  </Button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
