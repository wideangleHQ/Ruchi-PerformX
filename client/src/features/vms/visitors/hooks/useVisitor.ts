import { useQuery } from '@tanstack/react-query';
import { getVisitor } from '../api/visitor.api';

export function useVisitor(id: string | null) {
  return useQuery({
    queryKey: ['visitor', id],
    queryFn: () => {
      if (!id) throw new Error('Visitor ID is required');
      return getVisitor(id);
    },
    enabled: !!id,
  });
}
