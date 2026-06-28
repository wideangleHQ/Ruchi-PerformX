import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createVisit } from '../api/visit.api';
import { CreateVisitRequest, Visit } from '../types/visit.types';

export const useCreateVisit = () => {
  const queryClient = useQueryClient();

  return useMutation<Visit, Error, CreateVisitRequest>({
    mutationFn: createVisit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vms', 'visits'] });
    },
  });
};
