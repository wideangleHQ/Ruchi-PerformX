import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { VMS_DEFAULT_PAGE_SIZE, VMS_MAX_PAGE_SIZE } from '../../common/constants/vms.constants';
import { VisitStatus } from '../../common/enums/visit-status.enum';
import {
  VisitDbClient,
  VisitHistoryParams,
  VisitInsideVisitorsParams,
  VisitLookupOptions,
  VisitRecord,
  VisitRepository,
  VisitSearchParams,
  VisitSortBy,
  VisitSortOrder,
  VisitQueryRecord,
  VisitTodayParams,
  VisitWithHostEmployeeRecord,
  VisitWithRelationsRecord,
  VisitWithVisitorRecord,
  VISIT_BASE_SELECT,
  VISIT_WITH_HOST_EMPLOYEE_SELECT,
  VISIT_WITH_RELATIONS_SELECT,
  VISIT_WITH_VISITOR_SELECT,
} from './visit.repository.interface';

type VisitLeanRecord =
  | VisitRecord
  | VisitWithVisitorRecord
  | VisitWithHostEmployeeRecord
  | VisitWithRelationsRecord;

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = VMS_DEFAULT_PAGE_SIZE;
const TODAY_RANGE_HOURS = 24;

@Injectable()
export class VisitRepositoryImpl implements VisitRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.VisitUncheckedCreateInput, tx?: VisitDbClient): Promise<VisitRecord> {
    return this.client(tx).visit.create({
      data,
      select: VISIT_BASE_SELECT,
    });
  }

  async update(id: string, data: Prisma.VisitUncheckedUpdateInput, tx?: VisitDbClient): Promise<VisitRecord> {
    return this.client(tx).visit.update({
      where: { id },
      data,
      select: VISIT_BASE_SELECT,
    });
  }

  async findById(
    id: string,
    options: VisitLookupOptions = {},
  ): Promise<VisitLeanRecord | null> {
    return this.client(options.tx).visit.findFirst({
      where: this.visibleWhere({ id }, options.includeDeleted),
      select: this.selectForOptions(options),
    }) as Promise<VisitLeanRecord | null>;
  }

  async findActiveVisitByVisitor(
    visitorId: string,
    options: VisitLookupOptions = {},
  ): Promise<VisitLeanRecord | null> {
    return this.client(options.tx).visit.findFirst({
      where: this.visibleWhere(
        {
          visitorId,
          deletedAt: null,
          checkOutTime: null,
          status: VisitStatus.CHECKED_IN,
        },
        options.includeDeleted,
      ),
      orderBy: [{ checkInTime: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      select: this.selectForOptions(options),
    }) as Promise<VisitLeanRecord | null>;
  }

  async search(
    params: VisitSearchParams = {},
    tx?: VisitDbClient,
  ): Promise<{ data: VisitQueryRecord[]; meta: { page: number; limit: number; totalItems: number; totalPages: number; hasNextPage: boolean; hasPreviousPage: boolean } }> {
    const page = this.normalizePage(params.page);
    const limit = this.normalizeLimit(params.limit);
    const where = this.buildSearchWhere(params);
    const orderBy = this.buildOrderBy(params.sortBy, params.sortOrder);
    const client = this.client(tx);

    const [data, totalItems] = await Promise.all([
      client.visit.findMany({
        where,
        select: this.selectForParams(params),
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
      }),
      client.visit.count({ where }),
    ]);

    return this.paginated(data as VisitQueryRecord[], totalItems, page, limit);
  }

  async findToday(
    params: VisitTodayParams = {},
  ): Promise<{ data: VisitQueryRecord[]; meta: { page: number; limit: number; totalItems: number; totalPages: number; hasNextPage: boolean; hasPreviousPage: boolean } }> {
    const page = this.normalizePage(params.page);
    const limit = this.normalizeLimit(params.limit);
    const { start, end } = this.todayWindow();
    const where: Prisma.VisitWhereInput = this.visibleWhere(
      {
        ...(params.branchId ? { branchId: params.branchId } : {}),
        createdAt: { gte: start, lt: end },
      },
      false,
    );

    const client = this.client(params.tx);
    const [data, totalItems] = await Promise.all([
      client.visit.findMany({
        where,
        select: this.selectForParams(params),
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ checkInTime: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      }),
      client.visit.count({ where }),
    ]);

    return this.paginated(data as VisitQueryRecord[], totalItems, page, limit);
  }

  async findInsideVisitors(
    params: VisitInsideVisitorsParams = {},
  ): Promise<VisitQueryRecord[]> {
    const client = this.client(params.tx);

    return client.visit.findMany({
      where: {
        deletedAt: null,
        checkInTime: { not: null },
        checkOutTime: null,
        status: VisitStatus.CHECKED_IN,
        ...(params.branchId ? { branchId: params.branchId } : {}),
      },
      select: this.selectForParams(params),
      orderBy: [{ checkInTime: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    }) as Promise<VisitQueryRecord[]>;
  }

  async findHistory(
    params: VisitHistoryParams,
  ): Promise<{ data: VisitQueryRecord[]; meta: { page: number; limit: number; totalItems: number; totalPages: number; hasNextPage: boolean; hasPreviousPage: boolean } }> {
    const page = this.normalizePage(params.page);
    const limit = this.normalizeLimit(params.limit);
    const client = this.client(params.tx);

    const where: Prisma.VisitWhereInput = this.visibleWhere(
      {
        visitorId: params.visitorId,
      },
      false,
    );

    const [data, totalItems] = await Promise.all([
      client.visit.findMany({
        where,
        select: this.selectForParams(params),
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ scheduledAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      }),
      client.visit.count({ where }),
    ]);

    return this.paginated(data as VisitQueryRecord[], totalItems, page, limit);
  }

  async count(params: VisitSearchParams = {}, tx?: VisitDbClient): Promise<number> {
    return this.client(tx).visit.count({ where: this.buildSearchWhere(params) });
  }

  async softDelete(id: string, tx?: VisitDbClient): Promise<VisitRecord> {
    return this.client(tx).visit.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
      select: VISIT_BASE_SELECT,
    });
  }

  private client(tx?: VisitDbClient): VisitDbClient {
    return tx ?? this.prisma;
  }

  private selectForParams(
    params: Pick<VisitLookupOptions, 'includeVisitor' | 'includeHostEmployee'> | Pick<VisitSearchParams, 'includeVisitor' | 'includeHostEmployee'> | VisitTodayParams | VisitInsideVisitorsParams | VisitHistoryParams,
  ): Prisma.VisitSelect {
    const includeVisitor = params.includeVisitor === true;
    const includeHostEmployee = params.includeHostEmployee === true;

    if (includeVisitor && includeHostEmployee) {
      return VISIT_WITH_RELATIONS_SELECT;
    }

    if (includeVisitor) {
      return VISIT_WITH_VISITOR_SELECT;
    }

    if (includeHostEmployee) {
      return VISIT_WITH_HOST_EMPLOYEE_SELECT;
    }

    return VISIT_BASE_SELECT;
  }

  private selectForOptions(options: VisitLookupOptions): Prisma.VisitSelect {
    return this.selectForParams(options);
  }

  private buildSearchWhere(params: VisitSearchParams): Prisma.VisitWhereInput {
    const clauses: Prisma.VisitWhereInput[] = [];

    if (!params.includeDeleted) {
      clauses.push({ deletedAt: null });
    }

    if (params.visitorId) {
      clauses.push({ visitorId: params.visitorId });
    }

    if (params.hostEmployeeId) {
      clauses.push({ hostEmployeeId: params.hostEmployeeId });
    }

    if (params.status) {
      clauses.push({ status: params.status });
    }

    if (params.search) {
      const search = params.search.trim();
      if (search) {
        clauses.push({
          OR: [
            { purpose: { contains: search, mode: 'insensitive' } },
            { visitCode: { contains: search, mode: 'insensitive' } },
          ],
        });
      }
    }

    if (params.dateFrom || params.dateTo) {
      clauses.push({
        scheduledAt: this.dateRange(params.dateFrom, params.dateTo),
      });
    }

    if (clauses.length === 0) {
      return {};
    }

    return { AND: clauses };
  }

  private buildOrderBy(
    sortBy?: VisitSortBy,
    sortOrder: VisitSortOrder = 'desc',
  ): Prisma.VisitOrderByWithRelationInput[] {
    const direction: Prisma.SortOrder = sortOrder === 'asc' ? 'asc' : 'desc';
    const primaryField = sortBy ?? 'createdAt';

    return [{ [primaryField]: direction }, { id: direction }];
  }

  private visibleWhere(
    where: Prisma.VisitWhereInput,
    includeDeleted = false,
  ): Prisma.VisitWhereInput {
    if (includeDeleted) {
      return where;
    }

    return {
      AND: [where, { deletedAt: null }],
    };
  }

  private dateRange(dateFrom?: string, dateTo?: string): Prisma.DateTimeFilter {
    const filter: Prisma.DateTimeFilter = {};

    if (dateFrom) {
      filter.gte = new Date(dateFrom);
    }

    if (dateTo) {
      filter.lte = new Date(dateTo);
    }

    return filter;
  }

  private todayWindow(): { start: Date; end: Date } {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return { start, end };
  }

  private normalizePage(page?: number): number {
    if (!Number.isFinite(page) || !page || page < 1) {
      return DEFAULT_PAGE;
    }

    return Math.trunc(page);
  }

  private normalizeLimit(limit?: number): number {
    if (!Number.isFinite(limit) || !limit || limit < 1) {
      return DEFAULT_LIMIT;
    }

    return Math.min(Math.trunc(limit), VMS_MAX_PAGE_SIZE);
  }

  private paginated<T>(data: T[], totalItems: number, page: number, limit: number): {
    data: T[];
    meta: {
      page: number;
      limit: number;
      totalItems: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  } {
    return {
      data,
      meta: {
        page,
        limit,
        totalItems,
        totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / limit),
        hasNextPage: page * limit < totalItems,
        hasPreviousPage: page > 1,
      },
    };
  }
}
