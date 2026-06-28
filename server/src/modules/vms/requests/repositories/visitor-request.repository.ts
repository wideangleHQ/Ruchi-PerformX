import { Injectable } from '@nestjs/common';
import { Prisma, request_status_enum, request_type_enum } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { VMS_DEFAULT_PAGE_SIZE, VMS_MAX_PAGE_SIZE } from '../../common/constants/vms.constants';
import { VisitorRequestStatus } from '../dto/search-visitor-request.dto';
import {
  VISITOR_REQUEST_SELECT,
  VisitorRequestDbClient,
  VisitorRequestRecord,
  VisitorRequestRepository,
  VisitorRequestSearchParams,
  VisitorRequestSortOrder,
} from './visitor-request.repository.interface';

const CANCELLED_REASON_PREFIX = 'CANCELLED::';

@Injectable()
export class VisitorRequestRepositoryImpl implements VisitorRequestRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Prisma.task_requestsUncheckedCreateInput,
    tx?: VisitorRequestDbClient,
  ): Promise<VisitorRequestRecord> {
    return this.client(tx).task_requests.create({
      data,
      select: VISITOR_REQUEST_SELECT,
    });
  }

  async update(
    id: string,
    data: Prisma.task_requestsUncheckedUpdateInput,
    tx?: VisitorRequestDbClient,
  ): Promise<VisitorRequestRecord> {
    return this.client(tx).task_requests.update({
      where: { id },
      data,
      select: VISITOR_REQUEST_SELECT,
    });
  }

  async findById(
    id: string,
    options: import('./visitor-request.repository.interface').VisitorRequestLookupOptions = {},
  ): Promise<VisitorRequestRecord | null> {
    const where = this.buildWhere({
      id,
      ...(options.includeCancelled ? { includeCancelled: true } : {}),
    });

    return this.client(options.tx).task_requests.findFirst({
      where,
      select: VISITOR_REQUEST_SELECT,
    });
  }

  async search(
    params: VisitorRequestSearchParams = {},
    tx?: VisitorRequestDbClient,
  ): Promise<import('../../common/interfaces/paginated-response.interface').PaginatedResponse<VisitorRequestRecord>> {
    const page = this.normalizePage(params.page);
    const limit = this.normalizeLimit(params.limit);
    const where = this.buildWhere(params);
    const client = this.client(tx);

    const [data, totalItems] = await Promise.all([
      client.task_requests.findMany({
        where,
        select: VISITOR_REQUEST_SELECT,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      }),
      client.task_requests.count({ where }),
    ]);

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

  async count(params: VisitorRequestSearchParams = {}, tx?: VisitorRequestDbClient): Promise<number> {
    return this.client(tx).task_requests.count({ where: this.buildWhere(params) });
  }

  async softDelete(
    id: string,
    tx?: VisitorRequestDbClient,
    reason?: string,
  ): Promise<VisitorRequestRecord> {
    return this.client(tx).task_requests.update({
      where: { id },
      data: {
        status: request_status_enum.REJECTED,
        rejection_reason: `${CANCELLED_REASON_PREFIX}${reason?.trim() ?? ''}`.trimEnd(),
        reviewed_at: new Date(),
      },
      select: VISITOR_REQUEST_SELECT,
    });
  }

  private client(tx?: VisitorRequestDbClient): VisitorRequestDbClient {
    return tx ?? this.prisma;
  }

  private normalizePage(page?: number): number {
    if (!Number.isFinite(page) || !page || page < 1) {
      return 1;
    }

    return Math.trunc(page);
  }

  private normalizeLimit(limit?: number): number {
    if (!Number.isFinite(limit) || !limit || limit < 1) {
      return VMS_DEFAULT_PAGE_SIZE;
    }

    return Math.min(Math.trunc(limit), VMS_MAX_PAGE_SIZE);
  }

  private buildWhere(
    params: VisitorRequestSearchParams & { id?: string } = {},
  ): Prisma.task_requestsWhereInput {
    const clauses: Prisma.task_requestsWhereInput[] = [{ type: request_type_enum.OTHER }];

    if (!params.includeCancelled && params.status !== VisitorRequestStatus.CANCELLED) {
      clauses.push(this.notCancelledWhere());
    }

    if (params.id) {
      clauses.push({ id: params.id });
    }

    const statusWhere = this.statusWhere(params.status);
    if (statusWhere) {
      clauses.push(statusWhere);
    }

    if (params.hostEmployeeId) {
      clauses.push({ current_assignee_id: params.hostEmployeeId });
    }

    if (params.requestedById) {
      clauses.push({ requested_by_id: params.requestedById });
    }

    if (params.dateFrom || params.dateTo) {
      const createdAtFilter: Prisma.DateTimeFilter = {};
      if (params.dateFrom) {
        createdAtFilter.gte = new Date(params.dateFrom);
      }
      if (params.dateTo) {
        createdAtFilter.lte = new Date(params.dateTo);
      }

      clauses.push({
        created_at: createdAtFilter,
      });
    }

    if (params.search?.trim()) {
      const search = params.search.trim();
      clauses.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { request_reason: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { rejection_reason: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    return { AND: clauses };
  }

  private statusWhere(status?: VisitorRequestStatus): Prisma.task_requestsWhereInput | undefined {
    if (!status) {
      return undefined;
    }

    if (status === VisitorRequestStatus.PENDING) {
      return { status: request_status_enum.PENDING };
    }

    if (status === VisitorRequestStatus.APPROVED) {
      return { status: request_status_enum.ACCEPTED };
    }

    if (status === VisitorRequestStatus.REJECTED) {
      return {
        AND: [
          { status: request_status_enum.REJECTED },
          this.notCancelledWhere(),
        ],
      };
    }

    return this.cancelledWhere();
  }

  private cancelledWhere(): Prisma.task_requestsWhereInput {
    return {
      status: request_status_enum.REJECTED,
      rejection_reason: { startsWith: CANCELLED_REASON_PREFIX },
    };
  }

  private notCancelledWhere(): Prisma.task_requestsWhereInput {
    return {
      NOT: this.cancelledWhere(),
    };
  }
}
