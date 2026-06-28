import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateRequest } from '../api/request.api';
import { UpdateVisitorRequest, VisitorRequestResponse } from '../types/request.types';

export const useUpdateRequest = () => {
  const queryClient = useQueryClient();

  return useMutation<VisitorRequestResponse, Error, { id: string, payload: UpdateVisitorRequest }>({
    mutationFn: ({ id, payload }) => updateRequest(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vms', 'requests'] });
    },
  });
};
