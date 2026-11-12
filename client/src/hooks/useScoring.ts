'use client';

import { useQuery } from '@tanstack/react-query';
import {
  DetailedScoreProfile,
  ManagementScoresOverview,
  ManagementScoresParams,
  DepartmentExecutionOverview,
  ScorePeriod,
  scoringApi,
} from '@/api/scoring';

export const useMyScoreProfile = (period?: ScorePeriod) =>
  useQuery<DetailedScoreProfile>({
    queryKey: ['scoring', 'profile', 'me', period?.month, period?.year],
    queryFn: () => scoringApi.getMyProfile(period),
  });

export const useUserProfile = (userId: string | null, period?: ScorePeriod) =>
  useQuery<DetailedScoreProfile>({
    queryKey: ['scoring', 'profile', userId, period?.month, period?.year],
    queryFn: () => scoringApi.getUserProfile(userId as string, period),
    enabled: Boolean(userId),
  });

export const useManagementScores = (params?: ManagementScoresParams, enabled = true) =>
  useQuery<ManagementScoresOverview>({
    queryKey: ['scoring', 'overview', params],
    queryFn: () => scoringApi.getOverview(params),
    enabled,
  });

export const useDepartmentExecution = (departmentId: string | null, period?: ScorePeriod) =>
  useQuery<DepartmentExecutionOverview>({
    queryKey: ['scoring', 'department-execution', departmentId, period?.month, period?.year],
    queryFn: () => scoringApi.getDepartmentOverview(departmentId as string, period),
    enabled: Boolean(departmentId),
  });

