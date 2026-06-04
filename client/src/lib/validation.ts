import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().min(1, 'Email is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
  role: z.enum(['MD', 'HOD', 'EMPLOYEE'], {
    errorMap: () => ({ message: 'Please select a role' }),
  }),
  departments: z.array(z.string()).min(1, 'Select at least one department'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type SignupFormData = z.infer<typeof signupSchema>;

export const DEPARTMENTS = [
  'Accounts',
  'HR',
  'Marketing',
  'Operations',
  'Production',
  'Sales',
];
