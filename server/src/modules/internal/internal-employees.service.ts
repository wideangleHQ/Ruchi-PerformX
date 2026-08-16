import { Injectable } from '@nestjs/common';
import { role_enum } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

/** The six fields CareerX mirrors into `hr_employees`. Nothing else leaves. */
export interface InternalEmployee {
  id: string;
  fullName: string;
  email: string;
  departmentId: string | null;
  role: role_enum;
  isActive: boolean;
}

/** The `users` columns the shaping function reads. */
export interface InternalUserRow {
  id: string;
  full_name: string;
  email: string;
  department_id: string | null;
  role: role_enum;
  is_active: boolean | null;
  deleted_at: Date | null;
}

/**
 * Shapes `users` rows into the CareerX employee sync payload.
 *
 * Soft-deleted users are dropped. Deactivated ones are kept, with
 * `isActive: false`, because CareerX deactivates an `hr_employees` row by
 * seeing that flag flip. A user missing from the payload leaves CareerX holding
 * whatever it already had, which for somebody who has left the company means
 * keeping their career portal access.
 *
 * A null `is_active` reads as false. The column is nullable with a true
 * default, so a null is a row nobody wrote deliberately, and denying access is
 * the safe side of that guess.
 *
 * Throws nothing.
 */
export function toInternalEmployees(
  rows: InternalUserRow[],
): InternalEmployee[] {
  return rows
    .filter((row) => row.deleted_at === null)
    .map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      departmentId: row.department_id,
      role: row.role,
      isActive: row.is_active ?? false,
    }));
}

@Injectable()
export class InternalEmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Every non-deleted user, active or not, for the CareerX employee sync cron.
   *
   * Returns a bare array. The CareerX client accepts that or a `{ data: [...] }`
   * envelope, and camelCase or snake_case keys.
   *
   * Throws whatever Prisma throws.
   *
   * ponytail: the `where` clause is the index path, `toInternalEmployees`
   * states the same rule again so it can be tested without a database.
   */
  async findInternal(): Promise<InternalEmployee[]> {
    const rows = await this.prisma.users.findMany({
      where: { deleted_at: null },
      orderBy: { full_name: 'asc' },
      select: {
        id: true,
        full_name: true,
        email: true,
        department_id: true,
        role: true,
        is_active: true,
        deleted_at: true,
      },
    });

    return toInternalEmployees(rows);
  }
}
