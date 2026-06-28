import { useQuery } from '@tanstack/react-query';
import { getVisitorHistory } from '../api/visitor.api';

export function useVisitorHistory(id: string | null) {
  return useQuery({
    queryKey: ['visitor-history', id],
    queryFn: () => {
      if (!id) throw new Error('Visitor ID is required');
      return getVisitorHistory(id);
    },
    enabled: !!id,
  });
}
