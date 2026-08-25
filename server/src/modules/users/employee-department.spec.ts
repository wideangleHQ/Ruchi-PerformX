import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { role_enum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DepartmentScopeService } from '../../common/services/department-scope.service';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

/**
 * An EMPLOYEE's entire department scope is `users.department_id`.
 * DepartmentScopeService reads that one column for the role and nothing else,
 * so null means the person cannot file a self action and their own HOD cannot
 * see them, and the only symptom is a 400 on a form that never showed them a
 * department field.
 *
 * One live account reached that state. Two edits could produce it and neither
 * said anything: `departmentId: null` passes `@IsOptional`, which only skips
 * `undefined`, and resolves into a Prisma `disconnect`; and a user moved off
 * HOD has already had the column nulled, so arriving at EMPLOYEE without an
 * explicit department leaves it that way.
 *
 * The database carries the same rule as a CHECK constraint. These cases are
 * the service half, which is what turns it into a 400 with a sentence in it
 * rather than a 500 out of Postgres.
 */

const MARKETING = '9f1d4c2e-1111-4111-8111-111111111111';
const SALES = '9f1d4c2e-2222-4222-8222-222222222222';

function serviceFor(existing: { role: role_enum; department_id: string | null } | null) {
  const prisma = {
    users: {
      findUnique: () =>
        Promise.resolve(existing ? { id: 'u1', deleted_at: null, is_active: true, pending_approval: false, ...existing } : null),
      count: () => Promise.resolve(0),
      create: ({ data }: { data: unknown }) => Promise.resolve({ id: 'u1', ...(data as object) }),
      update: ({ data }: { data: unknown }) => Promise.resolve({ id: 'u1', role: existing?.role, ...(data as object) }),
    },
    departments: {
      findUnique: ({ where }: { where: { id?: string; name?: string } }) =>
        Promise.resolve(where.id === MARKETING || where.id === SALES ? { id: where.id, is_active: true } : null),
    },
    hod_departments: { deleteMany: () => Promise.resolve({ count: 0 }), createMany: () => Promise.resolve({ count: 0 }) },
    assistant_departments: { deleteMany: () => Promise.resolve({ count: 0 }), createMany: () => Promise.resolve({ count: 0 }) },
  } as unknown as PrismaService;

  return new UsersService(prisma, {} as DepartmentScopeService);
}

async function rejection(run: Promise<unknown>) {
  return run.then(
    () => null,
    (error: unknown) => error,
  );
}

describe('an employee always has a department', () => {
  it('refuses to create one without a department', async () => {
    const service = serviceFor(null);
    const error = await rejection(
      service.create({ username: 'x', fullName: 'X', password: 'password1', role: role_enum.EMPLOYEE } as CreateUserDto),
    );

    expect(error).toBeInstanceOf(BadRequestException);
  });

  it('creates one when a department is named', async () => {
    const service = serviceFor(null);
    const error = await rejection(
      service.create({
        username: 'x',
        fullName: 'X',
        password: 'password1',
        role: role_enum.EMPLOYEE,
        departmentId: MARKETING,
      } as CreateUserDto),
    );

    expect(error).toBeNull();
  });

  // The `@IsOptional` hole: null reaches the service and used to disconnect.
  it('refuses an update that clears the department', async () => {
    const service = serviceFor({ role: role_enum.EMPLOYEE, department_id: MARKETING });
    const error = await rejection(service.update('u1', { departmentId: null } as unknown as UpdateUserDto));

    expect(error).toBeInstanceOf(BadRequestException);
  });

  it('refuses an empty string just as flatly', async () => {
    const service = serviceFor({ role: role_enum.EMPLOYEE, department_id: MARKETING });
    const error = await rejection(service.update('u1', { departmentId: '' } as UpdateUserDto));

    expect(error).toBeInstanceOf(BadRequestException);
  });

  // The demotion hole: the column is already null from the HOD branch.
  it('refuses a demotion from HOD that names no department', async () => {
    const service = serviceFor({ role: role_enum.HOD, department_id: null });
    const error = await rejection(service.update('u1', { role: role_enum.EMPLOYEE } as UpdateUserDto));

    expect(error).toBeInstanceOf(BadRequestException);
  });

  it('allows that demotion when it names one', async () => {
    const service = serviceFor({ role: role_enum.HOD, department_id: null });
    const error = await rejection(
      service.update('u1', { role: role_enum.EMPLOYEE, departmentId: MARKETING } as UpdateUserDto),
    );

    expect(error).toBeNull();
  });

  it('leaves an unrelated edit alone', async () => {
    const service = serviceFor({ role: role_enum.EMPLOYEE, department_id: MARKETING });
    const error = await rejection(service.update('u1', { fullName: 'New Name' } as UpdateUserDto));

    expect(error).toBeNull();
  });

  it('moves an employee between departments', async () => {
    const service = serviceFor({ role: role_enum.EMPLOYEE, department_id: MARKETING });
    const error = await rejection(service.update('u1', { departmentId: SALES } as UpdateUserDto));

    expect(error).toBeNull();
  });

  // No false positive: these roles carry their scope in the junction tables and
  // this column is deliberately null for them.
  it('still lets a HOD hold no department_id', async () => {
    const service = serviceFor({ role: role_enum.HOD, department_id: null });
    const error = await rejection(service.update('u1', { fullName: 'New Name' } as UpdateUserDto));

    expect(error).toBeNull();
  });
});
