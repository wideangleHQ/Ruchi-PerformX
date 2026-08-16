import { notification_type_enum, notification_channel_enum } from '@prisma/client';

/**
 * Default delivery channels per notification type.
 *
 * Two rules decided which types get EMAIL. Anything needing action from
 * somebody who might not have the app open gets it: approvals, escalations,
 * vendor assignments. Anything high frequency does not, because emailing task
 * status changes trains people to filter the sender and then they lose the
 * approvals too.
 *
 * Every notification_type_enum value must have an entry. The test in
 * notification-channels.spec.ts fails if one is missing, which is the mistake
 * this map invites: add an enum value, forget the channel, and that
 * notification silently sends nothing.
 */
export const NOTIFICATION_CHANNELS: Record<
  notification_type_enum,
  notification_channel_enum[]
> = {
  // Phase 1, unchanged behaviour: in-app only, they arrive all day
  TASK_ASSIGNED: ['IN_APP'],
  TASK_ACCEPTED: ['IN_APP'],
  TASK_REJECTED: ['IN_APP'],
  TASK_COMPLETED: ['IN_APP'],
  TASK_PENDING: ['IN_APP'],
  TASK_OVERDUE: ['IN_APP'],
  REQUEST_ACCEPTED: ['IN_APP'],
  REQUEST_REJECTED: ['IN_APP'],
  REMARKS_ADDED: ['IN_APP'],
  TASK_TAGGED: ['IN_APP'],
  INCENTIVE_APPROVED: ['IN_APP'],
  TRANSFER_REQUESTED: ['IN_APP'],
  TRANSFER_ACCEPTED: ['IN_APP'],
  TRANSFER_REJECTED: ['IN_APP'],
  REVIEW_REQUESTED: ['IN_APP'],

  // Someone has to act and may not be in the app
  ESCALATION_HOD: ['IN_APP', 'EMAIL'],
  ESCALATION_MD: ['IN_APP', 'EMAIL'],
  PASSWORD_RESET: ['IN_APP', 'EMAIL'],

  // Leave. Every one of these is an approval or its outcome.
  LEAVE_SUBMITTED: ['IN_APP', 'EMAIL'],
  LEAVE_APPROVED: ['IN_APP', 'EMAIL'],
  LEAVE_REJECTED: ['IN_APP', 'EMAIL'],
  LEAVE_CANCELLED: ['IN_APP'],
  LEAVE_HR_CANCELLED: ['IN_APP', 'EMAIL'],

  // Projects. Messages and checklist ticks are high frequency, closure is not.
  PROJECT_INVITED: ['IN_APP'],
  PROJECT_CHECKLIST_UPDATED: ['IN_APP'],
  PROJECT_MESSAGE: ['IN_APP'],
  PROJECT_DEADLINE_NEAR: ['IN_APP'],
  PROJECT_OVERDUE_NO_CLOSURE: ['IN_APP', 'EMAIL'],
  PROJECT_CLOSED: ['IN_APP', 'EMAIL'],
  PROJECT_CLOSURE_SUBMITTED: ['IN_APP'],

  POLL_CREATED: ['IN_APP'],

  RND_REPORT_SUBMITTED: ['IN_APP'],
  RND_TEAM_ADDED: ['IN_APP'],

  ASSET_HANDOVER_INITIATED: ['IN_APP', 'EMAIL'],
  ASSET_HANDOVER_CONFIRMED: ['IN_APP'],

  // Vendors are external and will not have the app open. Email matters more here.
  VENDOR_TASK_ASSIGNED: ['IN_APP', 'EMAIL'],
  VENDOR_TASK_UPDATED: ['IN_APP'],
  VENDOR_MESSAGE: ['IN_APP', 'EMAIL'],
  VENDOR_CONTRACT_EXPIRING: ['IN_APP', 'EMAIL'],
  VENDOR_DOCUMENT_EXPIRING: ['IN_APP', 'EMAIL'],
  VENDOR_DELIVERABLE_DUE: ['IN_APP', 'EMAIL'],

  // A visitor at reception is immediate. Email is the wrong medium for it.
  VISITOR_ARRIVED: ['IN_APP'],
  VISITOR_REQUEST_APPROVED: ['IN_APP'],
};

/** Entity kinds a notification can point at. */
export type NotifyEntityType =
  | 'task'
  | 'self_action'
  | 'request'
  | 'transfer'
  | 'leave'
  | 'project'
  | 'poll'
  | 'visit'
  | 'rnd'
  | 'asset'
  | 'vendor';

export interface NotifyInput {
  recipientId: string;
  type: notification_type_enum;
  title: string;
  message: string;
  entityType?: NotifyEntityType;
  entityId?: string;
  /** Overrides the default channels for this type. Rarely needed. */
  channels?: notification_channel_enum[];
  metadata?: Record<string, unknown>;
}
