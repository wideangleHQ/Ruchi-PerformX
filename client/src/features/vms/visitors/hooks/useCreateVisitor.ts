import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createVisitor } from '../api/visitor.api';
import { CreateVisitorRequest, Visitor } from '../types/visitor.types';

export const useCreateVisitor = () => {
  const queryClient = useQueryClient();

  return useMutation<Visitor, Error, CreateVisitorRequest>({
    mutationFn: createVisitor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vms', 'visitors'] });
    },
  });
};
