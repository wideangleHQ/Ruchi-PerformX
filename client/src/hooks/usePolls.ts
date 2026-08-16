'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pollsApi, type CreatePollPayload } from '@/api/polls';

export const useActivePolls = () => {
  return useQuery({
    queryKey: ['polls', 'active'],
    queryFn: () => pollsApi.getActivePolls(),
  });
};

export const usePolls = () => {
  return useQuery({
    queryKey: ['polls', 'all'],
    queryFn: () => pollsApi.getPolls(),
  });
};

export const usePoll = (id: string) => {
  return useQuery({
    queryKey: ['polls', id],
    queryFn: () => pollsApi.getPoll(id),
    enabled: Boolean(id),
  });
};

// Polls ride along in the dashboard payload, so every mutation invalidates both
// keys. The socket handler does the same when somebody else's vote lands.
const invalidatePolls = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: ['polls'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
};

export const useCreatePoll = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreatePollPayload) => pollsApi.createPoll(payload),
    onSuccess: () => invalidatePolls(queryClient),
  });
};

export const useVotePoll = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, optionId }: { id: string; optionId: string }) =>
      pollsApi.vote(id, optionId),
    onSuccess: () => invalidatePolls(queryClient),
  });
};

export const useClosePoll = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => pollsApi.closePoll(id),
    onSuccess: () => invalidatePolls(queryClient),
  });
};

export const useDeletePoll = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => pollsApi.deletePoll(id),
    onSuccess: () => invalidatePolls(queryClient),
  });
};
