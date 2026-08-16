'use client';

import { CheckCircle2 } from 'lucide-react';

import { useConfirmHandover, usePendingHandovers } from '@/hooks/useAssets';
import { useToast } from '@/hooks/useToast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/**
 * What is waiting for the current user to take over. Confirming is what moves
 * `owner_id`, so the asset only appears under My assets afterwards.
 */
export function PendingHandovers() {
  const { data: handovers = [], isLoading } = usePendingHandovers();
  const confirm = useConfirmHandover();
  const toast = useToast();

  const accept = async (id: string, label: string | null) => {
    try {
      await confirm.mutateAsync(id);
      toast.success(`${label ?? 'The asset'} is yours now`);
    } catch {
      toast.error('Could not confirm that handover');
    }
  };

  if (isLoading) {
    return <p className="text-sm text-gray-500">Loading handovers...</p>;
  }

  if (!handovers.length) {
    return (
      <p className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        Nothing is waiting for you to confirm.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {handovers.map((handover) => (
        <div
          key={handover.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div>
            <p className="font-medium text-gray-900">{handover.asset_label ?? 'Asset'}</p>
            <p className="text-sm text-gray-500">
              From {handover.from_user_name ?? 'a colleague'}, opened by{' '}
              {handover.initiated_by_name ?? 'HR'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {handover.asset_type ? <Badge variant="outline">{handover.asset_type}</Badge> : null}
            <Button
              type="button"
              size="sm"
              className="bg-green-700 text-white hover:bg-green-800"
              onClick={() => accept(handover.id, handover.asset_label)}
              disabled={confirm.isPending}
            >
              <CheckCircle2 size={14} /> Confirm receipt
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
