import { useQuery } from '@tanstack/react-query';
import { getPermissionSlips } from '../api/pass.api';
import { SearchPassFilter } from '../types/pass.types';

export const usePermissionSlips = (filters: SearchPassFilter) => {
  return useQuery({
    queryKey: ['vms', 'passes', filters],
    queryFn: () => getPermissionSlips(filters),
  });
};
