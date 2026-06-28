import { useMutation, useQueryClient } from '@tanstack/react-query';
import { generatePermissionSlip } from '../api/pass.api';
import { GeneratePassRequest, PassResponse } from '../types/pass.types';

export const useGeneratePermissionSlip = () => {
  const queryClient = useQueryClient();

  return useMutation<PassResponse, Error, GeneratePassRequest>({
    mutationFn: generatePermissionSlip,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vms', 'passes'] });
    },
  });
};
