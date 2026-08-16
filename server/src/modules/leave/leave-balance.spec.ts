import { describe, expect, it } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { leave_status_enum, role_enum } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DepartmentScopeService } from '../../common/services/department-scope.service';
import { JwtPayload } from '../../common/types/jwt-payload.type';

import { LeaveService } from './leave.service';
import {
  countLeaveDays,
  financialYearOf,
  remainingDays,
  toDateKey,
} from './leave-days';

// August 2026 starts on a Saturday, so the 9th, 16th and 23rd are Sundays.
const MON = new Date(Date.UTC(2026, 7, 3));
const SAT = new Date(Date.UTC(2026, 7, 8));
const SUN = new Date(Date.UTC(2026, 7, 9));

describe('countLeaveDays', () => {
  const none: ReadonlySet<string> = new Set();

  it('counts an inclusive range', () => {
    expect(countLeaveDays(MON, SAT, none)).toBe(6);
  });

  it('excludes the weekly off', () => {
    // Monday to Sunday is seven days, of which the Sunday is not one.
    expect(countLeaveDays(MON, SUN, none)).toBe(6);
  });

  it('excludes holidays', () => {
    const holidays = new Set([
      toDateKey(new Date(Date.UTC(2026, 7, 5))),
      toDateKey(new Date(Date.UTC(2026, 7, 6))),
    ]);
    expect(countLeaveDays(MON, SUN, holidays)).toBe(4);
  });

  it('does not double subtract a holiday that lands on a weekly off', () => {
    const holidays = new Set([toDateKey(SUN)]);
    expect(countLeaveDays(MON, SUN, holidays)).toBe(6);
  });

  it('returns zero when the whole range is offs and holidays', () => {
    const holidays = new Set([toDateKey(SAT)]);
    expect(countLeaveDays(SAT, SUN, holidays)).toBe(0);
  });

  it('returns zero when the range is inverted', () => {
    expect(countLeaveDays(SUN, MON, none)).toBe(0);
  });
});

describe('financialYearOf', () => {
  it('names a year by the April it starts in', () => {
    expect(financialYearOf(new Date(Date.UTC(2026, 3, 1)))).toBe(2026);
    expect(financialYearOf(new Date(Date.UTC(2026, 7, 16)))).toBe(2026);
  });

  it('puts January to March in the previous financial year', () => {
    expect(financialYearOf(new Date(Date.UTC(2026, 2, 31)))).toBe(2025);
    expect(financialYearOf(new Date(Date.UTC(2026, 0, 1)))).toBe(2025);
  });
});

describe('remainingDays', () => {
  it('adds the carry forward and subtracts what is used', () => {
    expect(
      remainingDays({ entitled: 12, used: 3.5, carried_over: 2 }),
    ).toBe(10.5);
  });
});

// ---------------------------------------------------------------------------
// The balance transactions.
//
// These run against a hand-rolled in-memory Prisma double rather than a
// database, because what is being tested is the guard in the `where` clause and
// the increment, not Postgres. The double counts every write to the balance, so
// a second approval that slipped through would show up as two deductions rather
// than as a passing test.

type FakeApplication = {
  id: string;
  user_id: string;
  leave_type_id: string;
  status: leave_status_enum;
  days_count: number;
  start_date: Date;
  end_date: Date;
  manager_id: string | null;
  approved_by_id: string | null;
};

function makeDouble(application: FakeApplication, used: number) {
  const state = {
    application: { ...application },
    balance: { user_id: application.user_id, leave_type_id: application.leave_type_id, year: 2026, entitled: 12, used, carried_over: 0 },
    deductions: 0,
    credits: 0,
  };

  const leave_applications = {
    findUnique: () => Promise.resolve({ ...state.application }),
    updateMany: ({
      where,
      data,
    }: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => {
      if (where.status && where.status !== state.application.status) {
        return Promise.resolve({ count: 0 });
      }
      if (where.user_id && where.user_id !== state.application.user_id) {
        return Promise.resolve({ count: 0 });
      }
      Object.assign(state.application, data);
      return Promise.resolve({ count: 1 });
    },
  };

  const leave_type = {
    id: application.leave_type_id,
    name: 'Casual Leave',
    is_paid: true,
    requires_proof: false,
    is_active: true,
    annual_entitlement: 12,
    carry_forward: false,
    max_carry_forward: 0,
  };

  const leave_balances = {
    findUnique: () => Promise.resolve({ ...state.balance }),
    update: ({ data }: { data: { used: { increment?: number; decrement?: number } } }) => {
      if (data.used.increment !== undefined) {
        state.balance.used += data.used.increment;
        state.deductions += 1;
      }
      if (data.used.decrement !== undefined) {
        state.balance.used -= data.used.decrement;
        state.credits += 1;
      }
      return Promise.resolve({ ...state.balance });
    },
  };

  const client = {
    leave_applications,
    leave_balances,
    leave_types: {
      findUnique: () => Promise.resolve(leave_type),
      findMany: () => Promise.resolve([leave_type]),
    },
    users: { findMany: () => Promise.resolve([]) },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(client),
  };

  return { state, client };
}

/** A test double is the one place a cast is the honest description. */
function makeService(client: unknown) {
  const notifications = {
    notify: () => Promise.resolve(undefined),
    notifyMany: () => Promise.resolve([]),
  } as unknown as NotificationsService;

  const scope = {
    resolveDepartmentScope: () =>
      Promise.resolve({ unrestricted: true, departmentIds: [] }),
  } as unknown as DepartmentScopeService;

  return new LeaveService(client as PrismaService, notifications, scope);
}

const hrUser: JwtPayload = {
  sub: 'hr-user',
  username: 'hr',
  role: role_enum.HR,
  departmentId: null,
  departmentIds: [],
  canAccessCareerHR: false,
};

const pendingApplication: FakeApplication = {
  id: 'app-1',
  user_id: 'employee-1',
  leave_type_id: 'type-1',
  status: leave_status_enum.PENDING,
  days_count: 3,
  start_date: new Date(Date.UTC(2026, 7, 3)),
  end_date: new Date(Date.UTC(2026, 7, 5)),
  manager_id: 'hod-1',
  approved_by_id: null,
};

describe('approval deducts the balance exactly once', () => {
  it('deducts on the first approval', async () => {
    const { state, client } = makeDouble(pendingApplication, 0);
    await makeService(client).approve('app-1', {}, hrUser);

    expect(state.application.status).toBe(leave_status_enum.APPROVED);
    expect(state.deductions).toBe(1);
    expect(state.balance.used).toBe(3);
  });

  it('rejects a second, concurrent approval instead of deducting twice', async () => {
    const { state, client } = makeDouble(pendingApplication, 0);
    const service = makeService(client);

    await service.approve('app-1', {}, hrUser);
    await expect(
      service.approve('app-1', {}, { ...hrUser, sub: 'md-user', role: role_enum.MD }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(state.deductions).toBe(1);
    expect(state.balance.used).toBe(3);
  });
});

describe('HR cancellation credits the balance exactly once', () => {
  const approved: FakeApplication = {
    ...pendingApplication,
    status: leave_status_enum.APPROVED,
    approved_by_id: 'hod-1',
  };

  it('credits back what was deducted', async () => {
    const { state, client } = makeDouble(approved, 3);
    await makeService(client).hrCancel(
      'app-1',
      { cancellation_reason: 'Project deadline moved' },
      hrUser,
    );

    expect(state.application.status).toBe(leave_status_enum.CANCELLED);
    expect(state.credits).toBe(1);
    expect(state.balance.used).toBe(0);
  });

  it('does not credit twice when two HR users cancel together', async () => {
    const { state, client } = makeDouble(approved, 3);
    const service = makeService(client);

    await service.hrCancel('app-1', { cancellation_reason: 'first' }, hrUser);
    await expect(
      service.hrCancel('app-1', { cancellation_reason: 'second' }, {
        ...hrUser,
        sub: 'hr-user-2',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(state.credits).toBe(1);
    expect(state.balance.used).toBe(0);
  });
});
