'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { selfActionsApi } from '@/api/self-actions';

export const useUpdateSelfAction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof selfActionsApi.updateSelfAction>[1] }) =>
      selfActionsApi.updateSelfAction(id, data),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['self-actions'] });
      await queryClient.invalidateQueries({ queryKey: ['self-actions', variables.id] });
    },
  });
};
