'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CreateRndReportPayload,
  UpdateRndReportPayload,
  rndApi,
} from '@/api/rnd';

/**
 * Keys stay under the shared `rnd` prefix so one invalidation after a mutation
 * refreshes the history, the categories, and the detail view together. Opening
 * a report is itself a write on the server, which is why the detail hook
 * invalidates the list rather than trusting the cached row.
 */
export const useRndTeam = () =>
  useQuery({ queryKey: ['rnd', 'team'], queryFn: rndApi.getTeam });

export const useRndMembership = () =>
  useQuery({ queryKey: ['rnd', 'membership'], queryFn: rndApi.getMembership });

export const useRndReports = () =>
  useQuery({ queryKey: ['rnd', 'reports'], queryFn: rndApi.getReports });

export const useRndCategories = () =>
  useQuery({ queryKey: ['rnd', 'categories'], queryFn: rndApi.getCategories });

export const useRndReport = (id: string | null) =>
  useQuery({
    queryKey: ['rnd', 'reports', id],
    queryFn: () => rndApi.getReport(id as string),
    enabled: Boolean(id),
  });

export const useAddRndTeamMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => rndApi.addTeamMember(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rnd'] }),
  });
};

export const useRemoveRndTeamMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => rndApi.removeTeamMember(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rnd'] }),
  });
};

export const useCreateRndReport = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRndReportPayload) => rndApi.createReport(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rnd'] }),
  });
};

export const useUpdateRndReport = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRndReportPayload }) =>
      rndApi.updateReport(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rnd'] }),
  });
};
