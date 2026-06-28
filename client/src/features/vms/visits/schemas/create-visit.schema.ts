import { z } from 'zod';

export const createVisitSchema = z.object({
  visitorId: z.string().min(1, 'Visitor is required'),
  hostEmployeeId: z.string().min(1, 'Host employee is required'),
  purpose: z.string().min(1, 'Purpose is required'),
  meetingDetails: z.string().optional(),
});

export type CreateVisitFormValues = z.infer<typeof createVisitSchema>;
