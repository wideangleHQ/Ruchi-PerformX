import { z } from 'zod';

export const createVisitorSchema = z.object({
  firstName: z.string().min(1, 'First Name is required'),
  lastName: z.string().optional(),
  mobileNumber: z.string().regex(/^(?:\+91[-\s]?)?[6-9]\d{9}$/, 'Invalid Mobile Number'),
  companyName: z.string().min(1, 'Company Name is required'),
  address: z.string().min(1, 'Address is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  faceRecognitionConsent: z.boolean().optional(),
  notes: z.string().max(1000, 'Notes cannot exceed 1000 characters').optional(),
});

export type CreateVisitorFormValues = z.infer<typeof createVisitorSchema>;
