export enum TaskStatus {
  CREATED = 'CREATED',
  ASSIGNED = 'ASSIGNED',
  ACCEPTED = 'ACCEPTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  PENDING = 'PENDING',
  REVIEWED = 'REVIEWED',
  CLOSED = 'CLOSED',
}

export const ACTIVE_TASK_STATUSES: TaskStatus[] = [
  TaskStatus.ASSIGNED,
  TaskStatus.ACCEPTED,
  TaskStatus.IN_PROGRESS,
  TaskStatus.PENDING,
];

export const TERMINAL_TASK_STATUSES: TaskStatus[] = [
  TaskStatus.REJECTED,
  TaskStatus.CLOSED,
];

export const COMPLETED_TASK_STATUSES: TaskStatus[] = [
  TaskStatus.COMPLETED,
  TaskStatus.REVIEWED,
  TaskStatus.CLOSED,
];