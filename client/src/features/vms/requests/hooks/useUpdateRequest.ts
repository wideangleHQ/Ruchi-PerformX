import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  approveRequest,
  createVisitFromRequest,
  rejectRequest,
  updateRequest,
} from '../api/request.api';
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

function useRequestAction<TArgs>(action: (args: TArgs) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vms', 'requests'] });
      queryClient.invalidateQueries({ queryKey: ['vms', 'visits'] });
    },
  });
}

export const useApproveRequest = () => useRequestAction((id: string) => approveRequest(id));

export const useRejectRequest = () =>
  useRequestAction(({ id, reason }: { id: string; reason?: string }) =>
    rejectRequest(id, reason),
  );

export const useCreateVisitFromRequest = () =>
  useRequestAction((id: string) => createVisitFromRequest(id));
