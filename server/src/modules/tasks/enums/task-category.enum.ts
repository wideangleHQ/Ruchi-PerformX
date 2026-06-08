export enum TaskCategory {
  OPERATIONAL = 'OPERATIONAL',
  SALES = 'SALES',
  MARKETING = 'MARKETING',
  PRODUCTION = 'PRODUCTION',
  MAINTENANCE = 'MAINTENANCE',
  HR = 'HR',
  FINANCE = 'FINANCE',
  OTHER = 'OTHER',
}

export const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  [TaskCategory.OPERATIONAL]: 'Operational',
  [TaskCategory.SALES]: 'Sales',
  [TaskCategory.MARKETING]: 'Marketing',
  [TaskCategory.PRODUCTION]: 'Production',
  [TaskCategory.MAINTENANCE]: 'Maintenance',
  [TaskCategory.HR]: 'Human Resources',
  [TaskCategory.FINANCE]: 'Finance',
  [TaskCategory.OTHER]: 'Other',
};