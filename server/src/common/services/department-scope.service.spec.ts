import { describe, it, expect, vi } from 'vitest';
import { role_enum } from '@prisma/client';

import { DepartmentScopeService } from './department-scope.service';
import { JwtPayload } from '../types/jwt-payload.type';

// DepartmentScopeService moved from Scope.REQUEST + a Map<userId, scope> to a
// plain singleton + a WeakMap<JwtPayload, scope> (Phase 4 — see the
// 2026-09-20 decision log entry). These are authorization regression tests:
// every role's resolved scope, plus the per-request caching guarantee the
// refactor depends on, verified directly rather than assumed.

function user(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return {
    sub: 'user-1',
    username: 'user',
    role: role_enum.EMPLOYEE,
    departmentId: 'dept-a',
    departmentIds: ['dept-a'],
    canAccessCareerHR: false,
    ...overrides,
  };
}

function buildService() {
  const prisma = {
    hod_departments: { findMany: vi.fn().mockResolvedValue([]) },
    assistant_departments: { findMany: vi.fn().mockResolvedValue([]) },
    users: { findUnique: vi.fn().mockResolvedValue(null) },
  };
  const service = new DepartmentScopeService(prisma as never);
  return { service, prisma };
}

describe('DepartmentScopeService — role resolution', () => {
  it.each([role_enum.MD, role_enum.ADMIN, role_enum.EA, role_enum.PA])(
    '%s is unrestricted and touches no department table',
    async (role) => {
      const { service, prisma } = buildService();
      const scope = await service.resolveDepartmentScope(user({ role }));

      expect(scope).toEqual({ unrestricted: true, departmentIds: [] });
      expect(prisma.hod_departments.findMany).not.toHaveBeenCalled();
      expect(prisma.assistant_departments.findMany).not.toHaveBeenCalled();
      expect(prisma.users.findUnique).not.toHaveBeenCalled();
    },
  );

  it('HOD resolves departments from hod_departments', async () => {
    const { service, prisma } = buildService();
    prisma.hod_departments.findMany.mockResolvedValue([
      { department_id: 'dept-a' },
      { department_id: 'dept-b' },
    ]);

    const scope = await service.resolveDepartmentScope(user({ sub: 'hod-1', role: role_enum.HOD }));

    expect(scope).toEqual({ unrestricted: false, departmentIds: ['dept-a', 'dept-b'] });
    expect(prisma.hod_departments.findMany).toHaveBeenCalledWith({
      where: { hod_id: 'hod-1' },
      select: { department_id: true },
    });
  });

  it('PURCHASE_HEAD resolves departments from assistant_departments', async () => {
    const { service, prisma } = buildService();
    prisma.assistant_departments.findMany.mockResolvedValue([{ department_id: 'dept-purchase' }]);

    const scope = await service.resolveDepartmentScope(
      user({ sub: 'ph-1', role: role_enum.PURCHASE_HEAD }),
    );

    expect(scope).toEqual({ unrestricted: false, departmentIds: ['dept-purchase'] });
    expect(prisma.assistant_departments.findMany).toHaveBeenCalledWith({
      where: { assistant_id: 'ph-1' },
      select: { department_id: true },
    });
  });

  it('DEPARTMENT_CONTROLLER resolves departments from assistant_departments', async () => {
    const { service, prisma } = buildService();
    prisma.assistant_departments.findMany.mockResolvedValue([{ department_id: 'dept-c' }]);

    const scope = await service.resolveDepartmentScope(
      user({ sub: 'dc-1', role: role_enum.DEPARTMENT_CONTROLLER }),
    );

    expect(scope).toEqual({ unrestricted: false, departmentIds: ['dept-c'] });
  });

  it('EMPLOYEE resolves a single department from users.department_id', async () => {
    const { service, prisma } = buildService();
    prisma.users.findUnique.mockResolvedValue({ department_id: 'dept-a' });

    const scope = await service.resolveDepartmentScope(user({ sub: 'emp-1', role: role_enum.EMPLOYEE }));

    expect(scope).toEqual({ unrestricted: false, departmentIds: ['dept-a'] });
    expect(prisma.users.findUnique).toHaveBeenCalledWith({
      where: { id: 'emp-1' },
      select: { department_id: true },
    });
  });

  it('an EMPLOYEE with no department resolves to an empty scope, not unrestricted', async () => {
    const { service, prisma } = buildService();
    prisma.users.findUnique.mockResolvedValue({ department_id: null });

    const scope = await service.resolveDepartmentScope(user({ role: role_enum.EMPLOYEE }));

    expect(scope).toEqual({ unrestricted: false, departmentIds: [] });
  });
});

describe('DepartmentScopeService — per-request caching (WeakMap on the user object)', () => {
  it('resolves once per user object, however many times it is called', async () => {
    const { service, prisma } = buildService();
    prisma.hod_departments.findMany.mockResolvedValue([{ department_id: 'dept-a' }]);
    const sameRequestUser = user({ sub: 'hod-1', role: role_enum.HOD });

    await service.resolveDepartmentScope(sameRequestUser);
    await service.resolveDepartmentScope(sameRequestUser);
    await service.resolveDepartmentScope(sameRequestUser);

    expect(prisma.hod_departments.findMany).toHaveBeenCalledTimes(1);
  });

  it('two different user objects for the same sub are never confused — each resolves independently', async () => {
    // This is the exact scenario the refactor has to get right: JwtAuthGuard
    // hands out a fresh object per request even for the same person logging
    // in twice, and the cache must not conflate them via a shared string key.
    const { service, prisma } = buildService();
    prisma.hod_departments.findMany
      .mockResolvedValueOnce([{ department_id: 'dept-a' }])
      .mockResolvedValueOnce([{ department_id: 'dept-a' }, { department_id: 'dept-b' }]);

    const requestOneUser = user({ sub: 'hod-1', role: role_enum.HOD });
    const requestTwoUser = user({ sub: 'hod-1', role: role_enum.HOD }); // same sub, different object

    const first = await service.resolveDepartmentScope(requestOneUser);
    const second = await service.resolveDepartmentScope(requestTwoUser);

    expect(prisma.hod_departments.findMany).toHaveBeenCalledTimes(2);
    expect(first.departmentIds).toEqual(['dept-a']);
    expect(second.departmentIds).toEqual(['dept-a', 'dept-b']);
  });

  it('a singleton instance serves concurrent requests for different users correctly', async () => {
    const { service, prisma } = buildService();
    prisma.hod_departments.findMany.mockResolvedValueOnce([{ department_id: 'dept-a' }]);
    prisma.assistant_departments.findMany.mockResolvedValueOnce([{ department_id: 'dept-b' }]);

    const [hodScope, controllerScope] = await Promise.all([
      service.resolveDepartmentScope(user({ sub: 'hod-1', role: role_enum.HOD })),
      service.resolveDepartmentScope(user({ sub: 'dc-1', role: role_enum.DEPARTMENT_CONTROLLER })),
    ]);

    expect(hodScope.departmentIds).toEqual(['dept-a']);
    expect(controllerScope.departmentIds).toEqual(['dept-b']);
  });
});

describe('DepartmentScopeService — validateDepartmentAccess / hasAnyDepartmentAccess', () => {
  it('validateDepartmentAccess allows anything for an unrestricted role', async () => {
    const { service } = buildService();
    const result = await service.validateDepartmentAccess(user({ role: role_enum.MD }), ['dept-x', 'dept-y']);
    expect(result).toBe(true);
  });

  it('validateDepartmentAccess requires every submitted department to be in scope', async () => {
    const { service, prisma } = buildService();
    prisma.hod_departments.findMany.mockResolvedValue([
      { department_id: 'dept-a' },
      { department_id: 'dept-b' },
    ]);
    const hod = user({ sub: 'hod-1', role: role_enum.HOD });

    await expect(service.validateDepartmentAccess(hod, ['dept-a'])).resolves.toBe(true);
    await expect(service.validateDepartmentAccess(hod, ['dept-a', 'dept-b'])).resolves.toBe(true);
    await expect(service.validateDepartmentAccess(hod, ['dept-a', 'dept-z'])).resolves.toBe(false);
    await expect(service.validateDepartmentAccess(hod, ['dept-z'])).resolves.toBe(false);
  });

  it('hasAnyDepartmentAccess requires only one submitted department to be in scope', async () => {
    const { service, prisma } = buildService();
    prisma.hod_departments.findMany.mockResolvedValue([{ department_id: 'dept-a' }]);
    const hod = user({ sub: 'hod-1', role: role_enum.HOD });

    await expect(service.hasAnyDepartmentAccess(hod, ['dept-z', 'dept-a'])).resolves.toBe(true);
    await expect(service.hasAnyDepartmentAccess(hod, ['dept-y', 'dept-z'])).resolves.toBe(false);
  });

  it('an EMPLOYEE cannot access a department outside their own', async () => {
    const { service, prisma } = buildService();
    prisma.users.findUnique.mockResolvedValue({ department_id: 'dept-a' });
    const employee = user({ sub: 'emp-1', role: role_enum.EMPLOYEE });

    await expect(service.validateDepartmentAccess(employee, ['dept-b'])).resolves.toBe(false);
    await expect(service.hasAnyDepartmentAccess(employee, ['dept-b'])).resolves.toBe(false);
    await expect(service.hasAnyDepartmentAccess(employee, ['dept-a'])).resolves.toBe(true);
  });
});
