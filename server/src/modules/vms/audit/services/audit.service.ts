import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { audit_logs } from '@prisma/client';
import { PaginatedResponse } from '../../common/interfaces/paginated-response.interface';
import { AuditFilterDto } from '../dto/audit-filter.dto';
import { IAuditRepository, IAuditRepositoryToken } from '../repositories/audit.repository.interface';
import { IAuditService } from './audit.service.interface';

@Injectable()
export class AuditService implements IAuditService {
  constructor(
    @Inject(IAuditRepositoryToken)
    private readonly auditRepository: IAuditRepository,
  ) {}

  private formatPaginatedResponse(
    data: audit_logs[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedResponse<audit_logs> {
    const totalPages = Math.ceil(total / limit);
    return {
      data,
      meta: {
        page,
        limit,
        totalItems: total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async searchAudit(filters: AuditFilterDto): Promise<PaginatedResponse<audit_logs>> {
    const { data, total } = await this.auditRepository.findAll(filters);
    return this.formatPaginatedResponse(data, total, filters.page || 1, filters.limit || 10);
  }

  async getAuditById(id: string): Promise<audit_logs | null> {
    const audit = await this.auditRepository.findById(id);
    if (!audit) {
      throw new NotFoundException(`Audit log with ID ${id} not found`);
    }
    return audit;
  }

  async getVisitorTimeline(visitorId: string, filters: AuditFilterDto): Promise<PaginatedResponse<audit_logs>> {
    const { data, total } = await this.auditRepository.findByEntity('Visitor', visitorId, filters);
    return this.formatPaginatedResponse(data, total, filters.page || 1, filters.limit || 10);
  }

  async getVisitTimeline(visitId: string, filters: AuditFilterDto): Promise<PaginatedResponse<audit_logs>> {
    const { data, total } = await this.auditRepository.findByEntity('Visit', visitId, filters);
    return this.formatPaginatedResponse(data, total, filters.page || 1, filters.limit || 10);
  }

  async getEmployeeActivity(employeeId: string, filters: AuditFilterDto): Promise<PaginatedResponse<audit_logs>> {
    const { data, total } = await this.auditRepository.findByUser(employeeId, filters);
    return this.formatPaginatedResponse(data, total, filters.page || 1, filters.limit || 10);
  }
}
