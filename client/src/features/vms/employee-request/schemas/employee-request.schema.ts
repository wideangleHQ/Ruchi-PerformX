import { z } from 'zod';

export const employeeRequestSchema = z.object({
  visitorName: z.string().min(1, 'Visitor name is required').trim(),
  mobileNumber: z.string().min(10, 'Valid mobile number required').trim(),
  company: z.string().min(1, 'Company is required').trim(),
  address: z.string().min(1, 'Address is required').trim(),
  purpose: z.string().min(1, 'Purpose is required').max(500, 'Maximum 500 characters allowed').trim(),
  preferredDate: z.string().min(1, 'Preferred date is required').refine((date) => {
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selectedDate >= today;
  }, { message: 'Date cannot be in the past' }),
  preferredTime: z.string().min(1, 'Preferred time is required'),
  remarks: z.string().trim().optional(),
});

export type EmployeeRequestFormValues = z.infer<typeof employeeRequestSchema>;
