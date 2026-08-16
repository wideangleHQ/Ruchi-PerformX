import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  assetsApi,
  type CreateAssetInput,
  type UpdateAssetInput,
} from '@/api/assets';

/** Own assets, or every asset for EA, PA and MD. */
export const useAssets = () =>
  useQuery({
    queryKey: ['assets'],
    queryFn: () => assetsApi.getAssets(),
  });

/** One employee's assets and handover history. Skipped until a userId exists. */
export const useEmployeeAssets = (userId: string | null) =>
  useQuery({
    queryKey: ['assets', 'employee', userId],
    queryFn: () => assetsApi.getEmployeeAssets(userId ?? ''),
    enabled: Boolean(userId),
  });

/** Active internal users, for picking a leaver and a new owner. */
export const useAssetDirectory = (enabled = true) =>
  useQuery({
    queryKey: ['assets', 'directory'],
    queryFn: () => assetsApi.getDirectory(),
    enabled,
  });

/** Handovers waiting for the current user to confirm receipt. */
export const usePendingHandovers = () =>
  useQuery({
    queryKey: ['assets', 'handovers', 'pending'],
    queryFn: () => assetsApi.getPendingHandovers(),
  });

/**
 * Every asset mutation invalidates the whole `['assets']` tree. Ownership moves
 * on confirmation, so a change to one list usually changes another.
 */
function useAssetMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assets'] }),
  });
}

export const useCreateAsset = () =>
  useAssetMutation((input: CreateAssetInput) => assetsApi.createAsset(input));

export const useUpdateAsset = () =>
  useAssetMutation(({ id, input }: { id: string; input: UpdateAssetInput }) =>
    assetsApi.updateAsset(id, input),
  );

export const useDeleteAsset = () => useAssetMutation((id: string) => assetsApi.deleteAsset(id));

export const useCreateHandovers = () =>
  useAssetMutation((items: { assetId: string; toUserId: string }[]) =>
    assetsApi.createHandovers(items),
  );

export const useConfirmHandover = () =>
  useAssetMutation((id: string) => assetsApi.confirmHandover(id));

/**
 * Reveal is a mutation rather than a query on purpose: it is not cacheable and
 * it writes an audit row, so it must only ever run when somebody presses the
 * button.
 */
export const useRevealSecret = () =>
  useMutation({
    mutationFn: (id: string) => assetsApi.revealSecret(id),
  });
