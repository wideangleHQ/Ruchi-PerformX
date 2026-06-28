import { useQuery } from '@tanstack/react-query';
import { getRequests } from '../api/request.api';
import { VisitorRequestFilter } from '../types/request.types';

export const useVisitorRequests = (filters: VisitorRequestFilter) => {
  return useQuery({
    queryKey: ['vms', 'requests', filters],
    queryFn: () => getRequests(filters),
  });
};
