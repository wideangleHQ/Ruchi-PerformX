import { useQuery } from '@tanstack/react-query';
import { getVisitorsInside } from '../api/check-out.api';

export const useVisitorsInside = () => {
  return useQuery({
    queryKey: ['vms', 'visits-inside'],
    queryFn: getVisitorsInside,
    refetchInterval: 30000,
  });
};
