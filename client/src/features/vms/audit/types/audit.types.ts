export enum AuditAction {
  VISITOR_CREATED = 'Visitor Created',
  VISITOR_UPDATED = 'Visitor Updated',
  VISITOR_DELETED = 'Visitor Deleted',
  VISITOR_RESTORED = 'Visitor Restored',
  VISIT_CREATED = 'Visit Created',
  VISITOR_CHECKED_IN = 'Visitor Checked In',
  VISITOR_CHECKED_OUT = 'Visitor Checked Out',
  VISIT_CANCELLED = 'Visit Cancelled',
  REQUEST_CREATED = 'Request Created',
  REQUEST_APPROVED = 'Request Approved',
  REQUEST_REJECTED = 'Request Rejected',
  PASS_GENERATED = 'Pass Generated',
  PASS_REPRINTED = 'Pass Reprinted',
}

export enum AuditStatus {
  SUCCESS = 'Success',
  FAILED = 'Failed',
  WARNING = 'Warning',
  CANCELLED = 'Cancelled'
}

export interface AuditFilter {
  dateFrom?: string;
  dateTo?: string;
  module?: string;
  action?: string;
  user?: string;
  status?: string;
  visitor?: string;
  employee?: string;
  page?: number;
  limit?: number;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  module: string;
  action: string;
  performedBy: string;
  visitor?: string;
  employee?: string;
  status: AuditStatus;
  referenceNumber: string;
  description?: string;
  requestPayload?: string;
  responseSummary?: string;
}

export interface AuditSummary {
  todayActivities: number;
  successfulActions: number;
  failedActions: number;
  checkIns: number;
  checkOuts: number;
  permissionSlipsPrinted: number;
}

export interface PaginatedAuditResponse {
  data: AuditLog[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
  summary?: AuditSummary;
}
