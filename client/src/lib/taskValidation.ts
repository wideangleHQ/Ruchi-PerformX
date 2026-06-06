import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title is too long'),
  description: z.string().min(1, 'Description is required').max(2000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  dueDate: z.string().min(1, 'Due date is required'),
  departmentId: z.string().optional(),
  departmentIds: z.array(z.string()).optional(),
}).refine((data) => Boolean(data.departmentId || data.departmentIds?.length), {
  message: 'Department is required',
  path: ['departmentIds'],
});

export type CreateTaskFormData = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255).optional(),
  description: z.string().min(1).max(2000).optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  dueDate: z.string().optional(),
});

export type UpdateTaskFormData = z.infer<typeof updateTaskSchema>;
