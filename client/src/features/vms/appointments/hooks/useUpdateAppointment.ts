import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateAppointment } from '../api/appointment.api';
import { UpdateAppointmentRequest, AppointmentResponse } from '../types/appointment.types';

export const useUpdateAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation<AppointmentResponse, Error, { id: string, payload: UpdateAppointmentRequest }>({
    mutationFn: ({ id, payload }) => updateAppointment(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vms', 'appointments'] });
    },
  });
};
