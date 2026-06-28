import { Injectable } from '@nestjs/common';
import { Prisma, Visit, VisitStatus } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { SearchAppointmentDto } from '../dto/search-appointment.dto';
import {
  DbClient,
  IAppointmentRepository,
  PaginatedVisitResponse,
} from './appointment.repository.interface';

@Injectable()
export class AppointmentRepository implements IAppointmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient(tx?: DbClient): DbClient {
    return tx || this.prisma;
  }

  async create(data: Prisma.VisitUncheckedCreateInput, tx?: DbClient): Promise<Visit> {
    return this.getClient(tx).visit.create({ data });
  }

  async update(id: string, data: Prisma.VisitUncheckedUpdateInput, tx?: DbClient): Promise<Visit> {
    return this.getClient(tx).visit.update({
      where: { id },
      data,
    });
  }

  async findById(id: string, tx?: DbClient): Promise<Visit | null> {
    return this.getClient(tx).visit.findFirst({
      where: { id, deletedAt: null },
    });
  }

  private buildWhereClause(filters: SearchAppointmentDto): Prisma.VisitWhereInput {
    const where: Prisma.VisitWhereInput = { deletedAt: null };

    if (filters.status) {
      where.status = filters.status;
    } else {
      where.status = VisitStatus.SCHEDULED; // appointments default to SCHEDULED if not specified
    }

    if (filters.visitorId) {
      where.visitorId = filters.visitorId;
    }

    if (filters.hostEmployeeId) {
      where.hostEmployeeId = filters.hostEmployeeId;
    }

    if (filters.dateFrom || filters.dateTo) {
      where.scheduledAt = {};
      if (filters.dateFrom) where.scheduledAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.scheduledAt.lte = new Date(filters.dateTo);
    }

    if (filters.search) {
      where.OR = [
        { purpose: { contains: filters.search, mode: 'insensitive' } },
        { meetingDetails: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  async search(filters: SearchAppointmentDto, tx?: DbClient): Promise<PaginatedVisitResponse> {
    const where = this.buildWhereClause(filters);
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'desc';
    const orderBy = { [sortBy]: sortOrder };

    const [data, total] = await Promise.all([
      this.getClient(tx).visit.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      this.getClient(tx).visit.count({ where }),
    ]);

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

  async findToday(hostEmployeeId?: string, tx?: DbClient): Promise<Visit[]> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const where: Prisma.VisitWhereInput = {
      deletedAt: null,
      status: VisitStatus.SCHEDULED,
      scheduledAt: {
        gte: todayStart,
        lte: todayEnd,
      },
    };

    if (hostEmployeeId) {
      where.hostEmployeeId = hostEmployeeId;
    }

    return this.getClient(tx).visit.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async findUpcoming(hostEmployeeId?: string, tx?: DbClient): Promise<Visit[]> {
    const now = new Date();

    const where: Prisma.VisitWhereInput = {
      deletedAt: null,
      status: VisitStatus.SCHEDULED,
      scheduledAt: {
        gt: now,
      },
    };

    if (hostEmployeeId) {
      where.hostEmployeeId = hostEmployeeId;
    }

    return this.getClient(tx).visit.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async cancel(id: string, tx?: DbClient): Promise<Visit> {
    return this.update(
      id,
      { status: VisitStatus.CANCELLED, deletedAt: new Date() },
      tx,
    );
  }

  async complete(id: string, tx?: DbClient): Promise<Visit> {
    return this.update(id, { status: VisitStatus.CHECKED_OUT }, tx);
  }

  async count(filters: SearchAppointmentDto, tx?: DbClient): Promise<number> {
    const where = this.buildWhereClause(filters);
    return this.getClient(tx).visit.count({ where });
  }
}
