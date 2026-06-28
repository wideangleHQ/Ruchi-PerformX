import { Injectable } from '@nestjs/common';
import { audit_logs, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { AuditFilterDto } from '../dto/audit-filter.dto';
import { IAuditRepository } from './audit.repository.interface';

@Injectable()
export class AuditRepository implements IAuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhereClause(filters: AuditFilterDto): Prisma.audit_logsWhereInput {
    const where: Prisma.audit_logsWhereInput = {};

    if (filters.action) {
      where.action = filters.action;
    }
    if (filters.entity) {
      where.entity = filters.entity;
    }
    if (filters.performedBy) {
      where.user_id = filters.performedBy;
    }
    if (filters.dateFrom || filters.dateTo) {
      where.created_at = {};
      if (filters.dateFrom) {
        where.created_at.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        where.created_at.lte = new Date(filters.dateTo);
      }
    }
    return where;
  }

  async findAll(filters: AuditFilterDto): Promise<{ data: audit_logs[]; total: number }> {
    const where = this.buildWhereClause(filters);
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.audit_logs.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.audit_logs.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string): Promise<audit_logs | null> {
    return this.prisma.audit_logs.findUnique({
      where: { id },
    });
  }

  async findByEntity(entity: string, entityId: string, filters: AuditFilterDto): Promise<{ data: audit_logs[]; total: number }> {
    const where = this.buildWhereClause(filters);
    where.entity = entity;
    where.entity_id = entityId;
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.audit_logs.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.audit_logs.count({ where }),
    ]);

    return { data, total };
  }

  async findByUser(userId: string, filters: AuditFilterDto): Promise<{ data: audit_logs[]; total: number }> {
    const where = this.buildWhereClause(filters);
    where.user_id = userId;
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.audit_logs.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.audit_logs.count({ where }),
    ]);

    return { data, total };
  }
}
