import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { Prisma, role_enum } from '@prisma/client';

import { KpiService } from './kpi.service';
import { CreateKpiDto } from './dto/create-kpi.dto';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { DepartmentScope } from '../../common/types/department-scope.type';

// The paths here are the ones where a mistake is silent: a KPI landing in the
// wrong status, a HOD reaching another department, a chat or a score search
// leaking past the caller's scope. Prisma is a hand fake, so each test states
// exactly the rows the service sees.

const SALES = 'sales-dept';
const STORES = 'stores-dept';

const user = (sub: string, role: role_enum): JwtPayload => ({
  sub,
  role,
  username: sub,
  departmentId: null,
  departmentIds: [],
  canAccessCareerHR: false,
});

/** The first argument of a fake's first call, typed by the test that reads it. */
const firstArg = <T>(fn: { mock: { calls: unknown[][] } }): T =>
  fn.mock.calls[0]?.[0] as T;

type Created = { data: Record<string, unknown> };
type ScoreQuery = {
  where: Record<string, unknown> & { users: { AND: unknown[] } };
  skip?: number;
  take?: number;
};

const kpiRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'kpi-1',
  scope: 'INDIVIDUAL',
  owner_user_id: 'emp-1',
  department_id: SALES,
  name: 'Monthly sales',
  status: 'PUBLISHED',
  created_by_id: 'emp-1',
  weight: new Prisma.Decimal(20),
  period_start: new Date('2026-10-01'),
  period_end: new Date('2026-10-31'),
  ...overrides,
});

function build({
  scope = { unrestricted: false, departmentIds: [SALES] } as DepartmentScope,
  kpi = kpiRow(),
  usersById = { 'emp-1': SALES, 'emp-2': STORES } as Record<string, string | null>,
  allocated = [] as number[],
} = {}) {
  const prisma = {
    kpis: {
      findUnique: vi.fn(async () => kpi),
      findMany: vi.fn(async () =>
        allocated.map((weight, i) => ({ id: `a${i}`, weight: new Prisma.Decimal(weight) })),
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'new', ...data })),
    },
    users: {
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id in usersById ? { department_id: usersById[where.id] } : null,
      ),
      findMany: vi.fn(async () => []),
    },
    kpi_contributions: { findUnique: vi.fn(async () => null) },
    kpi_milestones: { createMany: vi.fn() },
    kpi_messages: {
      findMany: vi.fn(async (_query: unknown) => []),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'm1', ...data })),
    },
    performance_scores: {
      findMany: vi.fn(async (_query: unknown) => []),
      count: vi.fn(async (_query: unknown) => 0),
    },
    departments: { findMany: vi.fn(async () => []) },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  const departmentScope = { resolveDepartmentScope: vi.fn(async () => scope) };
  const notifications = { notifyMany: vi.fn(async (_inputs: unknown) => undefined) };
  const service = new KpiService(
    prisma as never,
    departmentScope as never,
    notifications as never,
  );
  return { service, prisma, notifications };
}

const individual = (overrides: Partial<CreateKpiDto> = {}): CreateKpiDto => ({
  scope: 'INDIVIDUAL',
  name: 'Calls closed',
  mode: 'BINARY',
  scoring_method: 'DIRECT',
  weight: 25,
  period: 'MONTHLY',
  period_start: '2026-10-01',
  period_end: '2026-10-31',
  ...overrides,
});

describe('KpiService.create', () => {
  it('publishes an authority self KPI with no approval step', async () => {
    const { service, prisma } = build({ usersById: { hod: SALES } });
    await service.create(individual(), user('hod', role_enum.HOD));
    expect(firstArg<Created>(prisma.kpis.create).data).toMatchObject({
      owner_user_id: 'hod',
      status: 'PUBLISHED',
    });
  });

  it('sends an employee self KPI for approval', async () => {
    const { service, prisma } = build();
    await service.create(individual(), user('emp-1', role_enum.EMPLOYEE));
    expect(firstArg<Created>(prisma.kpis.create).data).toMatchObject({
      status: 'PENDING_APPROVAL',
    });
  });

  it('refuses an employee assigning a KPI to somebody else', async () => {
    const { service } = build();
    await expect(
      service.create(individual({ owner_user_id: 'emp-2' }), user('emp-1', role_enum.EMPLOYEE)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses a HOD assigning outside their department', async () => {
    const { service } = build();
    await expect(
      service.create(individual({ owner_user_id: 'emp-2' }), user('hod', role_enum.HOD)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets the MD office assign anywhere', async () => {
    const { service, prisma } = build({ scope: { unrestricted: true, departmentIds: [] } });
    await service.create(individual({ owner_user_id: 'emp-2' }), user('md', role_enum.MD));
    expect(prisma.kpis.create).toHaveBeenCalled();
  });

  it('rejects an assignment past the remaining allocation', async () => {
    const { service } = build({ allocated: [25, 20, 15] });
    await expect(
      service.create(
        individual({ owner_user_id: 'emp-1', weight: 45 }),
        user('hod', role_enum.HOD),
      ),
    ).rejects.toThrow('40% of KPI weight left');
  });

  it('does not count a draft against the allocation', async () => {
    const { service, prisma } = build({ allocated: [60, 40] });
    await service.create(
      individual({ save_as_draft: true }),
      user('emp-1', role_enum.EMPLOYEE),
    );
    expect(firstArg<Created>(prisma.kpis.create).data).toMatchObject({ status: 'DRAFT' });
  });
});

describe('KpiService.approve', () => {
  it('lets a HOD quick approve a pending KPI in their department', async () => {
    const { service } = build({ kpi: kpiRow({ status: 'PENDING_APPROVAL' }) });
    const updateMany = vi.fn(async (_query: unknown) => ({ count: 1 }));
    (service as unknown as { prisma: { kpis: { updateMany: unknown } } }).prisma.kpis.updateMany =
      updateMany;
    await service.approve('kpi-1', user('hod', role_enum.HOD));
    expect(updateMany).toHaveBeenCalledOnce();
  });

  it('refuses a HOD approving outside their department', async () => {
    const { service } = build({
      kpi: kpiRow({ status: 'PENDING_APPROVAL', department_id: STORES }),
      scope: { unrestricted: false, departmentIds: [SALES] },
    });
    // The HOD cannot read it either, so the refusal comes from the read check.
    await expect(service.approve('kpi-1', user('hod', role_enum.HOD))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses approving a KPI that is not pending', async () => {
    const { service } = build();
    await expect(service.approve('kpi-1', user('md', role_enum.MD))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('KPI chat access', () => {
  it('refuses someone with no view of the KPI', async () => {
    const { service, prisma } = build({
      kpi: kpiRow({ department_id: STORES, owner_user_id: 'emp-2', created_by_id: 'emp-2' }),
    });
    await expect(
      service.listMessages('kpi-1', user('emp-1', role_enum.EMPLOYEE)),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.createMessage('kpi-1', { content: 'hi' }, user('emp-1', role_enum.EMPLOYEE)),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.kpi_messages.create).not.toHaveBeenCalled();
  });

  it('reads only the selected KPI thread', async () => {
    const { service, prisma } = build();
    await service.listMessages('kpi-1', user('emp-1', role_enum.EMPLOYEE));
    expect(firstArg<unknown>(prisma.kpi_messages.findMany)).toMatchObject({
      where: { kpi_id: 'kpi-1' },
    });
  });

  it('notifies the owner but not the sender', async () => {
    const { service, notifications } = build({
      kpi: kpiRow({ created_by_id: 'hod' }),
    });
    await service.createMessage('kpi-1', { content: 'hi' }, user('hod', role_enum.HOD));
    const sent = firstArg<{ recipientId: string }[]>(notifications.notifyMany);
    expect(sent.map((n) => n.recipientId)).toEqual(['emp-1']);
  });
});

describe('KpiService.scores', () => {
  it('keeps a HOD search inside their departments whatever the query asks', async () => {
    const { service, prisma } = build();
    await service.scores(
      { department_id: STORES, q: 'asha', page: 1, limit: 20 },
      user('hod', role_enum.HOD),
    );
    const where = firstArg<ScoreQuery>(prisma.performance_scores.count).where;
    expect(where.users.AND).toEqual(
      expect.arrayContaining([
        { department_id: { in: [SALES] } },
        { department_id: STORES },
      ]),
    );
    expect(firstArg<ScoreQuery>(prisma.performance_scores.findMany).where).toEqual(where);
  });

  it('does not invent a period when none is given', async () => {
    const { service, prisma } = build({ scope: { unrestricted: true, departmentIds: [] } });
    await service.scores({ page: 1, limit: 20 }, user('md', role_enum.MD));
    const where = firstArg<ScoreQuery>(prisma.performance_scores.count).where;
    expect(where).not.toHaveProperty('month');
    expect(where).not.toHaveProperty('year');
    expect(where.users.AND).toEqual([]);
  });

  it('paginates on the server', async () => {
    const { service, prisma } = build({ scope: { unrestricted: true, departmentIds: [] } });
    await service.scores({ page: 3, limit: 10 }, user('md', role_enum.MD));
    expect(firstArg<ScoreQuery>(prisma.performance_scores.findMany)).toMatchObject({
      skip: 20,
      take: 10,
    });
  });
});
