import { audit_logs } from '@prisma/client';
import { PaginatedResponse } from '../../common/interfaces/paginated-response.interface';
import { AuditFilterDto } from '../dto/audit-filter.dto';

export const IAuditServiceToken = Symbol('IAuditService');

export interface IAuditService {
  searchAudit(filters: AuditFilterDto): Promise<PaginatedResponse<audit_logs>>;
  getAuditById(id: string): Promise<audit_logs | null>;
  getVisitorTimeline(visitorId: string, filters: AuditFilterDto): Promise<PaginatedResponse<audit_logs>>;
  getVisitTimeline(visitId: string, filters: AuditFilterDto): Promise<PaginatedResponse<audit_logs>>;
  getEmployeeActivity(employeeId: string, filters: AuditFilterDto): Promise<PaginatedResponse<audit_logs>>;
}
