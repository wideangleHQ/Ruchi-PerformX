export enum TaskStatus {
  OPEN = 'CREATED',
  ONGOING = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ABORTED = 'REJECTED',
  HOD_VERIFIED_PENDING = 'REVIEWED',
  HOD_VERIFIED = 'CLOSED',
}

export const ACTIVE_TASK_STATUSES: TaskStatus[] = [
  TaskStatus.OPEN,
  TaskStatus.ONGOING,
  TaskStatus.HOD_VERIFIED_PENDING,
];

export const TERMINAL_TASK_STATUSES: TaskStatus[] = [
  TaskStatus.ABORTED,
  TaskStatus.HOD_VERIFIED,
];

export const COMPLETED_TASK_STATUSES: TaskStatus[] = [
  TaskStatus.COMPLETED,
  TaskStatus.HOD_VERIFIED_PENDING,
  TaskStatus.HOD_VERIFIED,
];