import { audit_logs } from '@prisma/client';
import { AuditFilterDto } from '../dto/audit-filter.dto';

export const IAuditRepositoryToken = Symbol('IAuditRepository');

export interface IAuditRepository {
  findAll(filters: AuditFilterDto): Promise<{ data: audit_logs[]; total: number }>;
  findById(id: string): Promise<audit_logs | null>;
  findByEntity(entity: string, entityId: string, filters: AuditFilterDto): Promise<{ data: audit_logs[]; total: number }>;
  findByUser(userId: string, filters: AuditFilterDto): Promise<{ data: audit_logs[]; total: number }>;
}
