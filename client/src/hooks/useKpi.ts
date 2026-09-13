'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChangeKpiStatusPayload,
  CreateKpiPayload,
  CreateKpiRevisionPayload,
  KpiFilters,
  RecordKpiUpdatePayload,
  SetKpiContributionsPayload,
  UpdateKpiPayload,
  kpiApi,
} from '@/api/kpi';

/**
 * Keys stay under the shared `kpi` prefix so one invalidation after a mutation
 * refreshes the list, the open KPI, and the PS Score together. They have to
 * move together: entering an actual changes all three at once, and a page
 * showing a stale score next to a fresh actual is worse than a slow one.
 */
const invalidate = (queryClient: ReturnType<typeof useQueryClient>) =>
  queryClient.invalidateQueries({ queryKey: ['kpi'] });

export const useKpis = (filters: KpiFilters = {}) =>
  useQuery({
    queryKey: ['kpi', 'list', filters],
    queryFn: () => kpiApi.getKpis(filters),
  });

export const useKpi = (id: string | null) =>
  useQuery({
    queryKey: ['kpi', 'detail', id],
    queryFn: () => kpiApi.getKpi(id as string),
    enabled: Boolean(id),
  });

export const useMyPsScore = (month?: number, year?: number) =>
  useQuery({
    queryKey: ['kpi', 'ps-score', 'me', month, year],
    queryFn: () => kpiApi.getMyPsScore(month, year),
  });

export const usePsScoreFor = (userId: string | null, month?: number, year?: number) =>
  useQuery({
    queryKey: ['kpi', 'ps-score', userId, month, year],
    queryFn: () => kpiApi.getPsScoreFor(userId as string, month, year),
    enabled: Boolean(userId),
  });

/**
 * The unit library is a constant on the server, so it is cached for the session
 * and the search box does not go to the network on every keystroke.
 */
export const useKpiUnits = (query: string) =>
  useQuery({
    queryKey: ['kpi', 'units', query],
    queryFn: () => kpiApi.searchUnits(query),
    staleTime: 30 * 60 * 1000,
  });

export const useCreateKpi = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateKpiPayload) => kpiApi.createKpi(payload),
    onSuccess: () => invalidate(queryClient),
  });
};

export const useUpdateKpi = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateKpiPayload }) =>
      kpiApi.updateKpi(id, data),
    onSuccess: () => invalidate(queryClient),
  });
};

export const useChangeKpiStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ChangeKpiStatusPayload }) =>
      kpiApi.changeStatus(id, data),
    onSuccess: () => invalidate(queryClient),
  });
};

export const useRecordKpiUpdate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RecordKpiUpdatePayload }) =>
      kpiApi.recordUpdate(id, data),
    onSuccess: () => invalidate(queryClient),
  });
};

export const useTickKpiMilestone = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, milestoneId }: { id: string; milestoneId: string }) =>
      kpiApi.tickMilestone(id, milestoneId),
    onSuccess: () => invalidate(queryClient),
  });
};

export const useSetKpiContributions = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SetKpiContributionsPayload }) =>
      kpiApi.setContributions(id, data),
    onSuccess: () => invalidate(queryClient),
  });
};

export const useCreateKpiRevision = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateKpiRevisionPayload }) =>
      kpiApi.createRevision(id, data),
    onSuccess: () => invalidate(queryClient),
  });
};
