'use client';

import { useMemo, useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';

import type { AssetHandover, AssetUser, CompanyAsset } from '@/api/assets';
import { useCreateHandovers } from '@/hooks/useAssets';
import { useToast } from '@/hooks/useToast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Props = {
  employeeId: string;
  assets: CompanyAsset[];
  handovers: AssetHandover[];
  directory: AssetUser[];
};

function Progress({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}

/**
 * Offboarding. Every asset the leaver still owns gets a new-owner picker and
 * the whole list is submitted once. Ownership does not move here: it moves when
 * the new owner confirms, which is what the counters above the table track.
 */
export function HandoverPanel({ employeeId, assets, handovers, directory }: Props) {
  const createHandovers = useCreateHandovers();
  const toast = useToast();
  const [picks, setPicks] = useState<Record<string, string>>({});

  const pendingByAsset = useMemo(
    () => new Map(handovers.filter((row) => !row.completed_at).map((row) => [row.asset_id, row])),
    [handovers],
  );

  const confirmed = handovers.filter((row) => row.completed_at).length;
  const awaiting = pendingByAsset.size;
  const outstanding = assets.filter((asset) => !pendingByAsset.has(asset.id)).length;

  const recipients = directory.filter((person) => person.id !== employeeId);
  const chosen = Object.entries(picks).filter(([, toUserId]) => toUserId);

  const submit = async () => {
    try {
      await createHandovers.mutateAsync(
        chosen.map(([assetId, toUserId]) => ({ assetId, toUserId })),
      );
      setPicks({});
      toast.success(`${chosen.length} handover${chosen.length === 1 ? '' : 's'} opened`);
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string | string[] } } }).response
        ?.data?.message;
      toast.error(
        Array.isArray(message) ? (message[0] ?? 'Could not open the handovers') : (message ?? 'Could not open the handovers'),
      );
    }
  };

  return (
    <section className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Progress label="Outstanding" value={outstanding} tone="text-gray-900" />
        <Progress label="Handed over, awaiting confirmation" value={awaiting} tone="text-amber-600" />
        <Progress label="Confirmed" value={confirmed} tone="text-green-700" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Asset</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">New owner</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {assets.map((asset) => {
              const pending = pendingByAsset.get(asset.id);

              return (
                <tr key={asset.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">{asset.label}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{asset.asset_type}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {pending ? (
                      <span className="text-sm text-amber-700">
                        Waiting on {pending.to_user_name ?? 'the new owner'}
                      </span>
                    ) : (
                      <select
                        value={picks[asset.id] ?? ''}
                        onChange={(event) =>
                          setPicks((current) => ({ ...current, [asset.id]: event.target.value }))
                        }
                        className="h-8 w-full max-w-xs rounded-lg border border-input bg-white px-3 text-sm outline-none"
                      >
                        <option value="">Not handed over</option>
                        {recipients.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.fullName} ({person.role})
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              );
            })}

            {!assets.length ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-500">
                  This employee holds no assets.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          className="bg-green-700 text-white hover:bg-green-800"
          onClick={submit}
          disabled={!chosen.length || createHandovers.isPending}
        >
          <ArrowRightLeft size={14} />
          {createHandovers.isPending
            ? 'Opening...'
            : `Hand over ${chosen.length || ''} asset${chosen.length === 1 ? '' : 's'}`.trim()}
        </Button>
      </div>

      {handovers.length ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Handover history</h3>
          <ul className="mt-2 space-y-1 text-sm text-gray-600">
            {handovers.map((row) => (
              <li key={row.id}>
                {row.asset_label ?? 'Asset'} to {row.to_user_name ?? 'a colleague'}
                {row.completed_at ? (
                  <span className="text-green-700"> confirmed</span>
                ) : (
                  <span className="text-amber-600"> awaiting confirmation</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
