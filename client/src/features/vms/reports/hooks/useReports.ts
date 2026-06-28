import { useQuery } from '@tanstack/react-query';
import { getReports } from '../api/report.api';
import { ReportFilter } from '../types/report.types';

export const useReports = (filters: ReportFilter) => {
  return useQuery({
    queryKey: ['vms', 'reports', filters],
    queryFn: () => getReports(filters),
  });
};
