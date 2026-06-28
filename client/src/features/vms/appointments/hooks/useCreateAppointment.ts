import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createAppointment } from '../api/appointment.api';
import { CreateAppointmentRequest, AppointmentResponse } from '../types/appointment.types';

export const useCreateAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation<AppointmentResponse, Error, CreateAppointmentRequest>({
    mutationFn: createAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vms', 'appointments'] });
    },
  });
};
