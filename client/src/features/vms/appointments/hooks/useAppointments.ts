import { useQuery } from '@tanstack/react-query';
import { getAppointments } from '../api/appointment.api';
import { SearchAppointmentFilter } from '../types/appointment.types';

export const useAppointments = (filters: SearchAppointmentFilter) => {
  return useQuery({
    queryKey: ['vms', 'appointments', filters],
    queryFn: () => getAppointments(filters),
  });
};
