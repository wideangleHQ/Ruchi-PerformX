import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateSettings } from '../api/settings.api';
import { VMSSettings } from '../types/settings.types';

export const useUpdateSettings = () => {
  const queryClient = useQueryClient();

  return useMutation<VMSSettings, Error, Partial<VMSSettings>>({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vms', 'settings'] });
    },
  });
};
