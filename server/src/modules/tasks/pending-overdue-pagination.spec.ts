import { describe, it, expect, vi } from 'vitest';

import { TasksService } from './tasks.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { role_enum } from '@prisma/client';

// getPending/getOverdue used to be plain findMany() calls with no take/skip —
// "fetch everything visible to this user, always." These cover the
// replacement: real pagination, the overdue/pending business definitions
// left untouched, and a deterministic tiebreaker on due_date.

function buildService(rows: { id: string }[], total: number) {
  const prisma = {
    tasks: {
      findMany: vi.fn().mockResolvedValue(rows),
      count: vi.fn().mockResolvedValue(total),
    },
  };
  const departmentScopeService = {
    resolveDepartmentScope: vi.fn().mockResolvedValue({ unrestricted: true, departmentIds: [] }),
  };
  const service = new TasksService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    departmentScopeService as never,
  );
  return { service, prisma };
}

const md: JwtPayload = {
  sub: 'md-1',
  username: 'md',
  role: role_enum.MD,
  departmentId: null,
  departmentIds: [],
  canAccessCareerHR: false,
};

describe('TasksService.getPending pagination', () => {
  it('paginates instead of returning every pending task', async () => {
    const { service, prisma } = buildService([{ id: 't1' }], 33);
    const result = await service.getPending({ page: 2, limit: 10 } as PaginationQueryDto, md);

    expect(prisma.tasks.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
    expect(prisma.tasks.count).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ total: 33, page: 2, limit: 10, hasMore: true });
  });

  it('keeps the REVIEWED-status business definition of "pending" unchanged', async () => {
    const { service, prisma } = buildService([], 0);
    await service.getPending({} as PaginationQueryDto, md);

    const call = prisma.tasks.findMany.mock.calls[0]?.[0] as { where: { AND: { status?: string }[] } };
    expect(call.where.AND.some((clause) => clause.status === 'REVIEWED')).toBe(true);
  });

  it('breaks ties on due_date deterministically by id', async () => {
    const { service, prisma } = buildService([], 0);
    await service.getPending({} as PaginationQueryDto, md);

    const call = prisma.tasks.findMany.mock.calls[0]?.[0] as { orderBy: unknown[] };
    expect(call.orderBy).toEqual([{ due_date: 'asc' }, { id: 'asc' }]);
  });

  it('defaults to page 1, limit 20', async () => {
    const { service, prisma } = buildService([], 0);
    await service.getPending({} as PaginationQueryDto, md);

    expect(prisma.tasks.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 20 }));
  });
});

describe('TasksService.getOverdue pagination', () => {
  it('paginates instead of returning every overdue task', async () => {
    const { service, prisma } = buildService([{ id: 't1' }], 5);
    const result = await service.getOverdue({ page: 1, limit: 20 } as PaginationQueryDto, md);

    expect(prisma.tasks.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 20 }));
    expect(result).toMatchObject({ total: 5, page: 1, limit: 20, hasMore: false });
  });

  it('keeps the overdue business definition (due_date < now, non-terminal status) unchanged', async () => {
    const { service, prisma } = buildService([], 0);
    await service.getOverdue({} as PaginationQueryDto, md);

    const call = prisma.tasks.findMany.mock.calls[0]?.[0] as {
      where: { AND: { due_date?: { lt: Date }; status?: { notIn: string[] } }[] };
    };
    const dueDateClause = call.where.AND.find((clause) => clause.due_date);
    const statusClause = call.where.AND.find((clause) => clause.status);
    expect(dueDateClause?.due_date?.lt).toBeInstanceOf(Date);
    expect(statusClause?.status?.notIn).toEqual(
      expect.arrayContaining(['COMPLETED', 'REVIEWED', 'CLOSED', 'REJECTED']),
    );
  });

  it('returns an empty page cleanly when nothing is overdue', async () => {
    const { service } = buildService([], 0);
    const result = await service.getOverdue({ page: 1, limit: 20 } as PaginationQueryDto, md);

    expect(result).toEqual({ data: [], total: 0, page: 1, limit: 20, hasMore: false });
  });
});

describe('PaginationQueryDto bounds (shared by getPending/getOverdue)', () => {
  it('rejects a limit above 100', async () => {
    const { validate } = await import('class-validator');
    const { plainToInstance } = await import('class-transformer');

    const errors = await validate(plainToInstance(PaginationQueryDto, { limit: '1000' }));
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('accepts limit=1', async () => {
    const { validate } = await import('class-validator');
    const { plainToInstance } = await import('class-transformer');

    const errors = await validate(plainToInstance(PaginationQueryDto, { limit: '1' }));
    expect(errors).toEqual([]);
  });

  it('rejects page beyond an int (non-numeric)', async () => {
    const { validate } = await import('class-validator');
    const { plainToInstance } = await import('class-transformer');

    const errors = await validate(plainToInstance(PaginationQueryDto, { page: 'abc' }));
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });
});
