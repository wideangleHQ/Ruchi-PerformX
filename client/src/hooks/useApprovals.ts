'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/api/users';

/** MD, HOD, EA and PA. Anyone else gets a 403 from the route itself. */
export const canApproveUsers = (role?: string | null) =>
  role === 'MD' || role === 'HOD' || role === 'EA' || role === 'PA';

export const usePendingUsers = (enabled = true) =>
  useQuery({
    queryKey: ['users', 'pending'],
    queryFn: () => usersApi.getPendingUsers(),
    enabled,
  });

function useDecision(decide: (id: string) => Promise<{ message: string }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: decide,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

export const useApproveUser = () => useDecision((id) => usersApi.approveUser(id));
export const useRejectUser = () => useDecision((id) => usersApi.rejectUser(id));
