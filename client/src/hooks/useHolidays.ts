'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  holidaysApi,
  type CreateHolidayInput,
  type UpdateHolidayInput,
} from '@/api/holidays';

// Every key starts with 'holidays', so one invalidation after a write refreshes
// the calendar screen and the dashboard banner together.
export const useHolidays = (year: number) =>
  useQuery({
    queryKey: ['holidays', year],
    queryFn: () => holidaysApi.getHolidays(year),
  });

export const useUpcomingHolidays = (limit?: number) =>
  useQuery({
    queryKey: ['holidays', 'upcoming', limit],
    queryFn: () => holidaysApi.getUpcomingHolidays(limit),
  });

export const useCreateHoliday = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateHolidayInput) => holidaysApi.createHoliday(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['holidays'] }),
  });
};

export const useUpdateHoliday = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateHolidayInput }) =>
      holidaysApi.updateHoliday(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['holidays'] }),
  });
};

export const useDeleteHoliday = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => holidaysApi.deleteHoliday(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['holidays'] }),
  });
};
