import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { VendorAction, vendorPortalApi } from '@/api/vendorPortal';

/**
 * Query hooks for the external vendor portal.
 *
 * Kept out of `useQueries.ts` on purpose: that file imports the employee APIs,
 * and a vendor screen importing it would pull endpoints a vendor cannot call
 * into the same bundle and the same autocomplete.
 */

const KEY = ['vendor-portal'] as const;

export const useVendorDashboard = () =>
  useQuery({ queryKey: [...KEY, 'dashboard'], queryFn: vendorPortalApi.getDashboard });

export const useVendorTask = (id: string) =>
  useQuery({
    queryKey: [...KEY, 'task', id],
    queryFn: () => vendorPortalApi.getTask(id),
    enabled: !!id,
  });

export const useVendorTaskStatus = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { status: VendorAction; reason?: string }) =>
      vendorPortalApi.updateTaskStatus(id, vars.status, vars.reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
};

export const useSubmitDeliverable = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; remarks?: string }) =>
      vendorPortalApi.submitDeliverable(vars.id, vars.remarks),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
};

export const useSendVendorMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => vendorPortalApi.postMessage(content),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
};
