import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { VMS_DEFAULT_PAGE_SIZE, VMS_MAX_PAGE_SIZE } from '../../common/constants/vms.constants';
import { normalizePhoneNumber } from '../../common/utils/phone.util';
import {
  VISITOR_SELECT,
  VisitorDbClient,
  VisitorExistsCriteria,
  VisitorLookupOptions,
  VisitorRecord,
  VisitorRepository,
  VisitorSearchParams,
  VisitorSortBy,
  VisitorSortOrder,
} from './visitor.repository.interface';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = VMS_DEFAULT_PAGE_SIZE;

const SEARCHABLE_STRING_FIELDS: VisitorSortBy[] = [
  'createdAt',
  'updatedAt',
  'fullName',
  'email',
  'mobileNumber',
  'status',
];

@Injectable()
export class VisitorRepositoryImpl implements VisitorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Prisma.VisitorUncheckedCreateInput,
    tx?: VisitorDbClient,
  ): Promise<VisitorRecord> {
    return this.client(tx).visitor.create({
      data,
      select: VISITOR_SELECT,
    });
  }

  async update(
    id: string,
    data: Prisma.VisitorUncheckedUpdateInput,
    tx?: VisitorDbClient,
  ): Promise<VisitorRecord> {
    return this.client(tx).visitor.update({
      where: { id },
      data,
      select: VISITOR_SELECT,
    });
  }

  async findById(id: string, options: VisitorLookupOptions = {}): Promise<VisitorRecord | null> {
    return this.client(options.tx).visitor.findFirst({
      where: this.withDeletedFilter(
        {
          id,
        },
        options.includeDeleted,
      ),
      select: VISITOR_SELECT,
    });
  }

  async findByMobile(
    mobileNumber: string,
    options: VisitorLookupOptions = {},
  ): Promise<VisitorRecord | null> {
    return this.client(options.tx).visitor.findFirst({
      where: this.withDeletedFilter(
        this.mobileNumberWhere(mobileNumber),
        options.includeDeleted,
      ),
      select: VISITOR_SELECT,
    });
  }

  async findByEmail(
    email: string,
    options: VisitorLookupOptions = {},
  ): Promise<VisitorRecord | null> {
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      return null;
    }

    return this.client(options.tx).visitor.findFirst({
      where: this.withDeletedFilter(
        {
          email: {
            equals: normalizedEmail,
            mode: 'insensitive',
          },
        },
        options.includeDeleted,
      ),
      select: VISITOR_SELECT,
    });
  }



  async search(
    params: VisitorSearchParams = {},
    tx?: VisitorDbClient,
  ): Promise<import('../../common/interfaces/paginated-response.interface').PaginatedResponse<VisitorRecord>> {
    const page = this.normalizePage(params.page);
    const limit = this.normalizeLimit(params.limit);
    const where = this.buildWhere(params);
    const orderBy = this.buildOrderBy(params.sortBy, params.sortOrder);
    const client = this.client(tx);

    const [data, totalItems] = await Promise.all([
      client.visitor.findMany({
        where,
        select: VISITOR_SELECT,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      client.visitor.count({ where }),
    ]);

    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);

    return {
      data,
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async exists(criteria: VisitorExistsCriteria, tx?: VisitorDbClient): Promise<boolean> {
    if (
      !criteria.id &&
      !criteria.mobileNumber &&
      !criteria.email
    ) {
      return false;
    }

    const where = this.withDeletedFilter(
      {
        AND: [
          criteria.id ? { id: criteria.id } : undefined,
          criteria.mobileNumber ? this.mobileNumberWhere(criteria.mobileNumber) : undefined,
          criteria.email
            ? {
                email: {
                  equals: criteria.email.trim(),
                  mode: 'insensitive',
                },
              }
            : undefined,
        ].filter(Boolean) as Prisma.VisitorWhereInput[],
      },
      criteria.includeDeleted,
    );

    const count = await this.client(tx).visitor.count({ where });
    return count > 0;
  }

  async softDelete(id: string, tx?: VisitorDbClient): Promise<VisitorRecord> {
    return this.client(tx).visitor.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
      select: VISITOR_SELECT,
    });
  }

  async restore(id: string, tx?: VisitorDbClient): Promise<VisitorRecord> {
    return this.client(tx).visitor.update({
      where: { id },
      data: {
        deletedAt: null,
      },
      select: VISITOR_SELECT,
    });
  }

  async count(params: VisitorSearchParams = {}, tx?: VisitorDbClient): Promise<number> {
    const where = this.buildWhere(params);
    return this.client(tx).visitor.count({ where });
  }

  private client(tx?: VisitorDbClient): VisitorDbClient {
    return tx ?? this.prisma;
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

  private buildWhere(params: VisitorSearchParams): Prisma.VisitorWhereInput {
    const clauses: Prisma.VisitorWhereInput[] = [];

    if (!params.includeDeleted) {
      clauses.push({ deletedAt: null });
    }

    if (params.status) {
      clauses.push({ status: params.status });
    }

    if (params.mobileNumber) {
      clauses.push(this.mobileNumberWhere(params.mobileNumber));
    }

    if (params.email) {
      const normalizedEmail = params.email.trim();
      if (normalizedEmail) {
        clauses.push({
          email: {
            equals: normalizedEmail,
            mode: 'insensitive',
          },
        });
      }
    }

    if (params.search) {
      const search = params.search.trim();
      if (search) {
        clauses.push({
          OR: [
            {
              fullName: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              email: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              mobileNumber: {
                contains: search,
                mode: 'insensitive',
              },
            },
          ],
        });
      }
    }

    if (clauses.length === 0) {
      return {};
    }

    return { AND: clauses };
  }

  private buildOrderBy(
    sortBy?: VisitorSortBy,
    sortOrder: VisitorSortOrder = 'desc',
  ): Prisma.VisitorOrderByWithRelationInput[] {
    const direction: Prisma.SortOrder = sortOrder === 'asc' ? 'asc' : 'desc';
    const primaryField = sortBy && SEARCHABLE_STRING_FIELDS.includes(sortBy) ? sortBy : 'createdAt';

    return [{ [primaryField]: direction }, { id: direction }];
  }

  private mobileNumberWhere(mobileNumber: string): Prisma.VisitorWhereInput {
    const trimmed = mobileNumber.trim();
    const normalized = normalizePhoneNumber(trimmed);
    const digits = trimmed.replace(/\D+/g, '');
    const candidates = new Set<string>([trimmed]);

    if (normalized) {
      candidates.add(normalized);
    }

    if (digits) {
      candidates.add(digits);
    }

    return {
      OR: Array.from(candidates).map((candidate) => ({
        mobileNumber: candidate,
      })),
    };
  }

  private withDeletedFilter(
    where: Prisma.VisitorWhereInput,
    includeDeleted = false,
  ): Prisma.VisitorWhereInput {
    if (includeDeleted) {
      return where;
    }

    return {
      AND: [where, { deletedAt: null }],
    };
  }
}
