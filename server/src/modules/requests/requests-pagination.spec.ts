import { describe, it, expect, vi } from 'vitest';

import { RequestsService } from './requests.service';
import { RequestFilterDto } from './dto/request-filter.dto';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { role_enum } from '@prisma/client';

// findAll() used to fetch every matching row with a 7-relation include and no
// take/skip. These cover the replacement: real skip/take against a count,
// authorization/scope applied before the query is built (not after), and a
// deterministic tiebreaker.

function buildService(rows: { id: string; request_attachments: unknown[] }[], total: number) {
  const prisma = {
    task_requests: {
      findMany: vi.fn().mockResolvedValue(rows),
      count: vi.fn().mockResolvedValue(total),
    },
  };
  const departmentScopeService = {
    resolveDepartmentScope: vi.fn().mockResolvedValue({ unrestricted: true, departmentIds: [] }),
  };
  const attachmentsService = {
    decorateTaskAttachments: vi.fn().mockResolvedValue([]),
  };
  const service = new RequestsService(
    prisma as never,
    {} as never,
    {} as never,
    attachmentsService as never,
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

const employee: JwtPayload = {
  sub: 'emp-1',
  username: 'emp',
  role: role_enum.EMPLOYEE,
  departmentId: 'dept-a',
  departmentIds: ['dept-a'],
  canAccessCareerHR: false,
};

describe('RequestsService.findAll pagination', () => {
  it('paginates instead of fetching every matching row', async () => {
    const rows = [{ id: 'r1', request_attachments: [] }];
    const { service, prisma } = buildService(rows, 37);

    const result = await service.findAll({ page: 2, limit: 10 } as RequestFilterDto, md);

    expect(prisma.task_requests.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
    expect(prisma.task_requests.count).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ total: 37, page: 2, limit: 10, hasMore: true });
  });

  it('resolves scope and applies the employee ownership filter before querying', async () => {
    const { service, prisma } = buildService([], 0);
    await service.findAll({} as RequestFilterDto, employee);

    const where = prisma.task_requests.findMany.mock.calls[0]?.[0] as { where: { requested_by_id?: string } };
    expect(where.where.requested_by_id).toBe('emp-1');
  });

  it('breaks ties deterministically by id', async () => {
    const { service, prisma } = buildService([], 0);
    await service.findAll({} as RequestFilterDto, md);

    const call = prisma.task_requests.findMany.mock.calls[0]?.[0] as { orderBy: unknown[] };
    expect(call.orderBy).toEqual([{ created_at: 'desc' }, { id: 'desc' }]);
  });

  it('defaults to page 1, limit 20', async () => {
    const { service, prisma } = buildService([], 0);
    await service.findAll({} as RequestFilterDto, md);

    expect(prisma.task_requests.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
  });

  it('preserves the status and type filters alongside pagination', async () => {
    const { service, prisma } = buildService([], 0);
    await service.findAll({ status: 'PENDING', type: 'TASK_REASSIGNMENT', page: 1, limit: 5 } as RequestFilterDto, md);

    const where = prisma.task_requests.findMany.mock.calls[0]?.[0] as {
      where: { status?: string; type?: string };
    };
    expect(where.where.status).toBe('PENDING');
    expect(where.where.type).toBe('TASK_REASSIGNMENT');
  });

  it('returns an empty page cleanly', async () => {
    const { service } = buildService([], 0);
    const result = await service.findAll({ page: 1, limit: 20 } as RequestFilterDto, md);

    expect(result).toEqual({ data: [], total: 0, page: 1, limit: 20, hasMore: false });
  });
});

describe('RequestFilterDto page/limit bounds', () => {
  it('rejects a limit above the maximum', async () => {
    const { validate } = await import('class-validator');
    const { plainToInstance } = await import('class-transformer');

    const errors = await validate(plainToInstance(RequestFilterDto, { limit: '9999' }));
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('rejects a zero or negative page', async () => {
    const { validate } = await import('class-validator');
    const { plainToInstance } = await import('class-transformer');

    expect((await validate(plainToInstance(RequestFilterDto, { page: '0' }))).some((e) => e.property === 'page')).toBe(
      true,
    );
    expect(
      (await validate(plainToInstance(RequestFilterDto, { page: '-3' }))).some((e) => e.property === 'page'),
    ).toBe(true);
  });
});
