'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { selfActionsApi } from '@/api/self-actions';

export const useCreateSelfAction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: selfActionsApi.createSelfAction,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['self-actions'] });
    },
  });
};
