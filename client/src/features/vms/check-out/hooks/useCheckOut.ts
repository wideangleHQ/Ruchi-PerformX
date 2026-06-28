import { useMutation, useQueryClient } from '@tanstack/react-query';
import { checkOutVisitor } from '../api/check-out.api';
import { VisitInsideResponse } from '../types/check-out.types';

export const useCheckOut = () => {
  const queryClient = useQueryClient();

  return useMutation<VisitInsideResponse, Error, string>({
    mutationFn: checkOutVisitor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vms', 'visits-inside'] });
    },
  });
};
