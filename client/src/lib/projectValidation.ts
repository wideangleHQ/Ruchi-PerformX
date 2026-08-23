import { z } from 'zod';

const priority = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const milestoneStatus = z.enum(['PLANNED', 'IN_PROGRESS', 'DONE', 'MISSED']);

/**
 * Creation stays short on purpose: name, type, objective, deadline. Milestones,
 * KPIs and success criteria are added from the detail page, so they are not
 * fields here. Keep every key in step with the projects DTO — the API runs
 * `forbidNonWhitelisted` and an extra key is a 400 with an unhelpful message.
 */
export const createProjectSchema = z.object({
  title: z.string().min(1, 'Project name is required').max(255, 'Project name is too long'),
  project_type: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  priority,
  objective: z.string().min(1, 'Objective is required').max(500, 'Keep the objective short'),
  description: z.string().min(1, 'Description is required').max(4000),
  tags: z.array(z.string()).optional(),
  start_date: z.string().optional(),
  deadline: z.string().min(1, 'Deadline is required'),
  co_lead_id: z.string().optional(),
});

export type CreateProjectFormData = z.infer<typeof createProjectSchema>;

/**
 * The editable surface of an existing project. It is not `createProjectSchema`
 * made partial: creation and editing differ in what they may touch.
 *
 * `status` is absent because the lifecycle control on the detail page owns it
 * and runs it through the transition table. `lead_id` is absent because
 * handing a project to somebody else deserves its own control rather than a
 * select buried in a form a co-lead can submit. `is_rnd` is here but only
 * rendered for an R&D team member, because the server rejects the change from
 * anybody else.
 */
export const updateProjectSchema = z.object({
  title: z.string().min(1, 'Project name is required').max(255, 'Project name is too long'),
  project_type: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  priority,
  objective: z.string().min(1, 'Objective is required').max(500, 'Keep the objective short'),
  description: z.string().min(1, 'Description is required').max(4000),
  tags: z.array(z.string()).optional(),
  start_date: z.string().optional(),
  deadline: z.string().optional(),
  co_lead_id: z.string().optional(),
  department_id: z.string().optional(),
  is_rnd: z.boolean().optional(),
  rnd_category: z.string().max(100).optional(),
});

export type UpdateProjectFormData = z.infer<typeof updateProjectSchema>;

export const checklistItemSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(2000).optional(),
  priority: priority.optional(),
  assigned_to_id: z.string().optional(),
  due_date: z.string().optional(),
});

export type ChecklistItemFormData = z.infer<typeof checklistItemSchema>;

export const milestoneSchema = z.object({
  name: z.string().min(1, 'Milestone name is required').max(255),
  description: z.string().max(2000).optional(),
  owner_id: z.string().optional(),
  start_date: z.string().optional(),
  due_date: z.string().optional(),
  status: milestoneStatus.optional(),
});

export type MilestoneFormData = z.infer<typeof milestoneSchema>;

export const kpiSchema = z.object({
  metric: z.string().min(1, 'Metric is required').max(255),
  target: z.string().max(100).optional(),
  actual: z.string().max(100).optional(),
  status: z.string().max(20).optional(),
});

export type KpiFormData = z.infer<typeof kpiSchema>;

export const outcomeSchema = z.object({
  entry_type: z.enum(['TRY', 'FAILURE', 'OUTCOME']),
  content: z.string().min(1, 'Write what happened').max(4000),
});

export type OutcomeFormData = z.infer<typeof outcomeSchema>;

/** All nine closure fields. Executive summary, objective and final outcome are required. */
export const closureReportSchema = z.object({
  executiveSummary: z.string().min(1, 'Executive summary is required').max(4000),
  objective: z.string().min(1, 'Objective is required').max(2000),
  finalOutcome: z.string().min(1, 'Final outcome is required').max(4000),
  achievements: z.string().max(4000).optional(),
  failures: z.string().max(4000).optional(),
  learnings: z.string().max(4000).optional(),
  kpiResults: z.string().max(4000).optional(),
  recommendations: z.string().max(4000).optional(),
  attachments: z.array(z.string().min(1, 'Attachment link cannot be blank')).optional(),
});

export type ClosureReportFormData = z.infer<typeof closureReportSchema>;

/**
 * Drops empty strings, empty arrays and undefined so an untouched optional field
 * is omitted from the request body rather than posted blank.
 */
export function compactPayload<T extends Record<string, unknown>>(values: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }
  return out as Partial<T>;
}
