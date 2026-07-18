'use client';

import { useQuery } from '@tanstack/react-query';
import { selfActionsApi, SelfActionFilters } from '@/api/self-actions';

export const useSelfActions = (filters?: SelfActionFilters) => {
  return useQuery({
    // "me" segment keeps My Self Actions cached separately from the
    // department-scoped list, while the shared 'self-actions' prefix
    // still lets existing invalidations refresh both.
    queryKey: ['self-actions', filters?.mine ? 'me' : 'all', filters],
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
