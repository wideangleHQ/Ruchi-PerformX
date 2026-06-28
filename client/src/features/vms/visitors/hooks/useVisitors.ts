import { useQuery } from '@tanstack/react-query';
import { getVisitors } from '../api/visitor.api';
import { VisitorSearchRequest } from '../types/visitor.types';

export const useVisitors = (params: VisitorSearchRequest) => {
  return useQuery({
    queryKey: ['vms', 'visitors', params],
    queryFn: () => getVisitors(params),
  });
};
