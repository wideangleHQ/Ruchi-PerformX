import { z } from 'zod';
import { VisitStatus } from '../types/appointment.types';

export const createAppointmentSchema = z.object({
  visitorId: z.string().min(1, 'Visitor is required'),
  branchId: z.string().min(1, 'Branch is required'),
  hostEmployeeId: z.string().min(1, 'Employee is required'),
  purpose: z.string().min(1, 'Purpose is required'),
  meetingDetails: z.string().max(1000, 'Remarks cannot exceed 1000 characters').optional(),
  scheduledAt: z.string().min(1, 'Appointment Date and Time is required').refine(date => {
    return new Date(date).getTime() > Date.now();
  }, { message: 'Date must be in the future' }),
});

export type CreateAppointmentFormValues = z.infer<typeof createAppointmentSchema>;

export const updateAppointmentSchema = createAppointmentSchema.partial().extend({
  status: z.nativeEnum(VisitStatus).optional(),
});

export type UpdateAppointmentFormValues = z.infer<typeof updateAppointmentSchema>;
