'use client';

import { useQuery } from '@tanstack/react-query';
import { selfActionsApi, SelfActionFilters } from '@/api/self-actions';

export const useSelfActions = (filters?: SelfActionFilters) => {
  return useQuery({
    queryKey: ['self-actions', filters],
    queryFn: () => selfActionsApi.getSelfActions(filters),
  });
};

export const useSelfAction = (id: string) => {
  return useQuery({
    queryKey: ['self-actions', id],
    queryFn: () => selfActionsApi.getSelfActionById(id),
    enabled: Boolean(id),
  });
};
