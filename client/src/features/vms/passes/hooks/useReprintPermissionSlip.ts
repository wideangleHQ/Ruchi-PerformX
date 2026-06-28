import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reprintPermissionSlip } from '../api/pass.api';
import { ReprintPassRequest, PassResponse } from '../types/pass.types';

export const useReprintPermissionSlip = () => {
  const queryClient = useQueryClient();

  return useMutation<PassResponse, Error, { passNumber: string, payload: ReprintPassRequest }>({
    mutationFn: ({ passNumber, payload }) => reprintPermissionSlip(passNumber, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vms', 'passes'] });
    },
  });
};
