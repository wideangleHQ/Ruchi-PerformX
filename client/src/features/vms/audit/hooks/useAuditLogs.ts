import { useQuery } from '@tanstack/react-query';
import { getAuditLogs } from '../api/audit.api';
import { AuditFilter } from '../types/audit.types';

export const useAuditLogs = (filters: AuditFilter) => {
  return useQuery({
    queryKey: ['vms', 'audit', filters],
    queryFn: () => getAuditLogs(filters),
  });
};
