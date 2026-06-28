import { useQuery } from '@tanstack/react-query';
import { getDashboardSummary } from '../api/dashboard.api';
import { DashboardData } from '../types/dashboard.types';

export const useDashboardSummary = () => {
  const { data, isLoading, error, refetch } = useQuery<DashboardData, Error>({
    queryKey: ['vms', 'dashboard', 'summary'],
    queryFn: getDashboardSummary,
  });

  return {
    summary: data,
    isLoading,
    error,
    refetch,
  };
};
