'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { eventsApi, EventStatus, Money } from '@/api/events';

// Every key starts with 'events', so one invalidation after a mutation refreshes
// the list, the detail, and the budget report together. There is no socket
// event for events, and nothing here changes often enough to need one.
const invalidate = (queryClient: ReturnType<typeof useQueryClient>) =>
  queryClient.invalidateQueries({ queryKey: ['events'] });

export const useEvents = () =>
  useQuery({
    queryKey: ['events'],
    queryFn: () => eventsApi.getEvents(),
  });

export const useEvent = (id: string) =>
  useQuery({
    queryKey: ['events', id],
    queryFn: () => eventsApi.getEvent(id),
    enabled: Boolean(id),
  });

export const useBudgetReport = (id: string) =>
  useQuery({
    queryKey: ['events', id, 'budget-report'],
    queryFn: () => eventsApi.getBudgetReport(id),
    enabled: Boolean(id),
  });

export const useCreateEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: eventsApi.createEvent,
    onSuccess: () => invalidate(queryClient),
  });
};

export const useUpdateEvent = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { budgetEstimated?: Money; status?: EventStatus }) =>
      eventsApi.updateEvent(id, data),
    onSuccess: () => invalidate(queryClient),
  });
};

export const useDeleteEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eventsApi.deleteEvent(id),
    onSuccess: () => invalidate(queryClient),
  });
};

export const useAddCoordinator = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => eventsApi.addCoordinator(id, userId),
    onSuccess: () => invalidate(queryClient),
  });
};

export const useRemoveCoordinator = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => eventsApi.removeCoordinator(id, userId),
    onSuccess: () => invalidate(queryClient),
  });
};

export const useCreateExpense = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { item: string; amount: Money; receipt?: File | null }) =>
      eventsApi.createExpense(id, data),
    onSuccess: () => invalidate(queryClient),
  });
};

export const useDeleteExpense = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) => eventsApi.deleteExpense(id, expenseId),
    onSuccess: () => invalidate(queryClient),
  });
};
