import { Injectable } from '@nestjs/common';
import { Prisma, role_enum } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  EmployeeSearchDto,
  EmployeeSortBy,
  EmployeeSortOrder,
} from './employee.dto';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';

export const EMPLOYEE_SELECT = {
  id: true,
  full_name: true,
  username: true,
  role: true,
  departments: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.usersSelect;

export type EmployeeRecord = Prisma.usersGetPayload<{
  select: typeof EMPLOYEE_SELECT;
}>;

@Injectable()
export class EmployeeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async search(
    query: EmployeeSearchDto = {},
  ): Promise<PaginatedResponse<EmployeeRecord>> {
    const page = this.normalizePage(query.page);
    const limit = this.normalizeLimit(query.limit);
    const where = this.buildWhere(query);

    const [data, totalItems] = await Promise.all([
      this.prisma.users.findMany({
        where,
        select: EMPLOYEE_SELECT,
        orderBy: this.buildOrderBy(query.sortBy, query.sortOrder),
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.users.count({ where }),
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

  async count(query: EmployeeSearchDto = {}): Promise<number> {
    return this.prisma.users.count({ where: this.buildWhere(query) });
  }

  private buildWhere(query: EmployeeSearchDto): Prisma.usersWhereInput {
    const clauses: Prisma.usersWhereInput[] = [{ is_active: true }, { deleted_at: null }];

    if (query.departmentId) {
      clauses.push({ department_id: query.departmentId });
    }

    if (query.employeeCode) {
      clauses.push({
        username: {
          contains: query.employeeCode.trim(),
          mode: 'insensitive',
        },
      });
    }

    if (query.search) {
      const search = query.search.trim();
      if (search) {
        clauses.push({
          OR: [
            {
              full_name: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              username: {
                contains: search,
                mode: 'insensitive',
              },
            },
          ],
        });
      }
    }

    return { AND: clauses };
  }

  private buildOrderBy(
    sortBy: EmployeeSortBy = EmployeeSortBy.FULL_NAME,
    sortOrder: EmployeeSortOrder = EmployeeSortOrder.ASC,
  ): Prisma.usersOrderByWithRelationInput[] {
    const direction: Prisma.SortOrder = sortOrder === EmployeeSortOrder.DESC ? 'desc' : 'asc';

    if (sortBy === EmployeeSortBy.EMPLOYEE_CODE) {
      return [{ username: direction }, { id: direction }];
    }

    if (sortBy === EmployeeSortBy.ROLE) {
      return [{ role: direction }, { id: direction }];
    }

    if (sortBy === EmployeeSortBy.DEPARTMENT) {
      return [{ department_id: direction }, { id: direction }];
    }

    return [{ full_name: direction }, { id: direction }];
  }

  private normalizePage(page?: number): number {
    if (!Number.isFinite(page) || !page || page < 1) {
      return 1;
    }

    return Math.trunc(page);
  }

  private normalizeLimit(limit?: number): number {
    if (!Number.isFinite(limit) || !limit || limit < 1) {
      return 20;
    }

    return Math.min(Math.trunc(limit), 1000);
  }
}
