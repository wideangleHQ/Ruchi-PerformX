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
  role: z.enum(['MD', 'EA', 'PA', 'PURCHASE_HEAD', 'DEPARTMENT_CONTROLLER', 'HOD', 'EMPLOYEE'], {
    error: 'Please select a role',
  }),
  departments: z.array(z.string()),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
}).refine((data) => {
  if (['MD', 'EA', 'PA', 'PURCHASE_HEAD'].includes(data.role)) {
    return data.departments.length === 0;
  }
  if (data.role === 'EMPLOYEE') {
    return data.departments.length === 1;
  }
  if (data.role === 'HOD' || data.role === 'DEPARTMENT_CONTROLLER') {
    return data.departments.length >= 1;
  }
  return false;
}, {
  message: 'Invalid department selection for the chosen role',
  path: ['departments'],
});

export type SignupFormData = z.infer<typeof signupSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

