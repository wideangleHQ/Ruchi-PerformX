import { describe, it, expect } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { role_enum, task_status_enum } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { VendorScopeService } from '../vendors/vendor-scope.service';
import { TaskLifecycleService } from '../tasks/task-lifecycle.service';

// A vendor is the only external party holding a valid JWT. Two things keep it
// away from everything else, and both fail silently rather than loudly if they
// are wrong, which is why they are the tests worth having.
//
// ponytail: hand-rolled prisma stubs, no test database and no Nest testing
// module. VendorScopeService takes one constructor argument and
// TaskLifecycleService takes none. Reach for a real database when a test needs
// a query planner, not before.
type AssignmentRow = { entity_id: string | null };

const prismaWith = (rows: AssignmentRow[]) =>
  ({
    vendor_assignments: {
      findFirst: async ({ where }: { where: { entity_id: string } }) =>
        rows.some((r) => r.entity_id === where.entity_id) ? { id: 'row' } : null,
      findMany: async () => rows,
    },
  }) as unknown as PrismaService;

const vendorUser: JwtPayload = {
  sub: '11111111-1111-1111-1111-111111111111',
  username: 'acme-portal',
  role: role_enum.VENDOR,
  departmentId: null,
  departmentIds: [],
  canAccessCareerHR: false,
};

describe('VendorScopeService.vendorFilter', () => {
  it('matches nothing when the vendor has no assignments', async () => {
    const scope = new VendorScopeService(prismaWith([]));

    const filter = await scope.vendorFilter('vendor-1', 'task');

    // The whole point. An empty object here would be a `where: {}`, which
    // matches every task in the company. `{ id: { in: [] } }` matches none.
    expect(filter).toEqual({ id: { in: [] } });
    expect(Object.keys(filter)).toHaveLength(1);
    expect(filter.id.in).toEqual([]);
  });

  it('lists only the assigned ids, dropping null entity references', async () => {
    const scope = new VendorScopeService(
      prismaWith([{ entity_id: 'task-a' }, { entity_id: null }, { entity_id: 'task-b' }]),
    );

    expect(await scope.vendorFilter('vendor-1', 'task')).toEqual({
      id: { in: ['task-a', 'task-b'] },
    });
  });
});

describe('VendorScopeService.assertVendorAccess', () => {
  it('throws for an entity the vendor is not assigned', async () => {
    const scope = new VendorScopeService(prismaWith([{ entity_id: 'task-a' }]));

    await expect(scope.assertVendorAccess('vendor-1', 'task', 'task-z')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns quietly for an assigned entity', async () => {
    const scope = new VendorScopeService(prismaWith([{ entity_id: 'task-a' }]));

    await expect(scope.assertVendorAccess('vendor-1', 'task', 'task-a')).resolves.toBeUndefined();
  });
});

describe('task transitions available to a VENDOR', () => {
  const lifecycle = new TaskLifecycleService();
  const statuses = Object.values(task_status_enum);

  /** Every (from, to) pair a VENDOR can actually perform, reason supplied. */
  const allowed = statuses.flatMap((from) =>
    statuses
      .filter((to) => {
        try {
          lifecycle.validate(from, to, vendorUser, 'because');
          return true;
        } catch {
          return false;
        }
      })
      .map((to) => `${from}->${to}`),
  );

  it('allows exactly the four vendor transitions and nothing else', () => {
    expect(allowed.sort()).toEqual(
      [
        // accept
        'CREATED->ACCEPTED',
        'ASSIGNED->ACCEPTED',
        // start
        'CREATED->IN_PROGRESS',
        'ASSIGNED->IN_PROGRESS',
        'ACCEPTED->IN_PROGRESS',
        // complete
        'IN_PROGRESS->COMPLETED',
        // reject with a reason
        'CREATED->REJECTED',
        'ASSIGNED->REJECTED',
        'ACCEPTED->REJECTED',
        'IN_PROGRESS->REJECTED',
      ].sort(),
    );
  });

  it('rejects a rejection with no reason', () => {
    expect(() =>
      lifecycle.validate(task_status_enum.ASSIGNED, task_status_enum.REJECTED, vendorUser),
    ).toThrow();
  });

  it('never lets a vendor review, close, or return work', () => {
    // REVIEW
    expect(() =>
      lifecycle.validate(task_status_enum.HOD_VERIFIED, task_status_enum.REVIEWED, vendorUser, 'x'),
    ).toThrow(ForbiddenException);
    // CLOSE
    expect(() =>
      lifecycle.validate(task_status_enum.REVIEWED, task_status_enum.CLOSED, vendorUser, 'x'),
    ).toThrow(ForbiddenException);
    // RETURN for rework, which shares a target status with the vendor's own
    // "start work" transition and is the one an over-eager edit would open.
    expect(() =>
      lifecycle.validate(task_status_enum.COMPLETED, task_status_enum.IN_PROGRESS, vendorUser, 'x'),
    ).toThrow(ForbiddenException);
    // Verification, which is a HOD's call
    expect(() =>
      lifecycle.validate(
        task_status_enum.COMPLETED,
        task_status_enum.HOD_VERIFIED_PENDING,
        vendorUser,
        'x',
      ),
    ).toThrow(ForbiddenException);
  });
});
