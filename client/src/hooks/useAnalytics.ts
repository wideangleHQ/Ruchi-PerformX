import { useQuery } from '@tanstack/react-query';
import { scoringApi, type ScorePeriod, type ScoreTrendParams } from '@/api/scoring';

/**
 * Employee points queries, for the analytics and scoring screens.
 *
 * HOD score queries stay in `useQueries.ts` alongside the rest of that module.
 * The two scales are unrelated; see `api/scoring.ts`.
 */

export const useMyScore = (period?: ScorePeriod) =>
  useQuery({
    queryKey: ['scoring', 'me', period],
    queryFn: () => scoringApi.getMyScore(period),
  });

export const useMyScoreTrend = (params?: ScoreTrendParams) =>
  useQuery({
    queryKey: ['scoring', 'me', 'trend', params],
    queryFn: () => scoringApi.getMyTrend(params),
  });

export const useDepartmentScoreTrend = (
  departmentId: string | null,
  params?: ScoreTrendParams,
  enabled = true,
) =>
  useQuery({
    queryKey: ['scoring', 'department', departmentId, 'trend', params],
    queryFn: () => scoringApi.getDepartmentTrend(departmentId as string, params),
    enabled: enabled && Boolean(departmentId),
  });

export const useScoreLeaderboard = (period?: ScorePeriod, enabled = true) =>
  useQuery({
    queryKey: ['scoring', 'leaderboard', period],
    queryFn: () => scoringApi.getLeaderboard(period),
    enabled,
  });
