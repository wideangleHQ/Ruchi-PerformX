import { z } from 'zod';

export const createVisitSchema = z.object({
  visitorId: z.string().min(1, 'Visitor is required'),
  hostEmployeeId: z.string().min(1, 'Host employee is required'),
  purpose: z.string().min(1, 'Purpose is required'),
  peopleCount: z.number().int().min(1).max(50),
  meetingDetails: z.string().optional(),
});

export type CreateVisitFormValues = z.infer<typeof createVisitSchema>;
