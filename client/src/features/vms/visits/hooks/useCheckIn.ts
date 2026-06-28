import { useMutation, useQueryClient } from '@tanstack/react-query';
import { checkIn } from '../api/visit.api';
import { CheckInRequest, Visit } from '../types/visit.types';

export const useCheckIn = () => {
  const queryClient = useQueryClient();

  return useMutation<Visit, Error, CheckInRequest>({
    mutationFn: checkIn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vms', 'visits'] });
      queryClient.invalidateQueries({ queryKey: ['vms', 'dashboard'] });
    },
  });
};
