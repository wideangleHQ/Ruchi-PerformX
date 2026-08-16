import { describe, it, expect } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VendorScopeService } from './vendor-scope.service';
import { VENDOR_ACCESS_LEVELS } from './dto/access/grant-vendor-access.dto';

/**
 * The vendor management ladder, checked as a function of (role, row) alone.
 *
 * `assertAccess` compares two array indexes. Reorder that array and every
 * VIEWER in the company can write; drop the MD/EA branch and the two people
 * who are supposed to hold everything hold nothing, because neither has a row.
 * Neither mistake shows up in a type error and neither shows up until someone
 * clicks the wrong button in production.
 *
 * The stub below is the whole test database: one lookup, one row or null. No
 * Postgres, no Nest container, nothing that can pass for the wrong reason.
 */
function scopeFor(rows: Record<string, string>): VendorScopeService {
  const prisma = {
    vendor_dashboard_access: {
      findUnique: ({ where }: { where: { user_id: string } }) =>
        Promise.resolve(
          rows[where.user_id]
            ? { access_level: rows[where.user_id] }
            : null,
        ),
    },
  } as unknown as PrismaService;
  return new VendorScopeService(prisma);
}

const holder = (level: string) => scopeFor({ u1: level });
const nobody = () => scopeFor({});

async function allows(
  scope: VendorScopeService,
  role: string,
  minimum: 'VENDOR_VIEWER' | 'VENDOR_MANAGER' | 'VENDOR_ADMIN',
): Promise<boolean> {
  try {
    await scope.assertAccess('u1', role, minimum);
    return true;
  } catch (error) {
    expect(error).toBeInstanceOf(ForbiddenException);
    return false;
  }
}

describe('vendor access levels', () => {
  it('orders weakest first, which is what assertAccess compares by index', () => {
    expect(VENDOR_ACCESS_LEVELS).toEqual([
      'VENDOR_VIEWER',
      'VENDOR_MANAGER',
      'VENDOR_ADMIN',
    ]);
  });

  it('lets a VIEWER read and nothing else', async () => {
    const scope = holder('VENDOR_VIEWER');
    expect(await allows(scope, 'EMPLOYEE', 'VENDOR_VIEWER')).toBe(true);
    expect(await allows(scope, 'EMPLOYEE', 'VENDOR_MANAGER')).toBe(false);
    expect(await allows(scope, 'EMPLOYEE', 'VENDOR_ADMIN')).toBe(false);
  });

  it('lets a MANAGER write but not do ADMIN work', async () => {
    const scope = holder('VENDOR_MANAGER');
    expect(await allows(scope, 'EMPLOYEE', 'VENDOR_VIEWER')).toBe(true);
    expect(await allows(scope, 'EMPLOYEE', 'VENDOR_MANAGER')).toBe(true);
    expect(await allows(scope, 'EMPLOYEE', 'VENDOR_ADMIN')).toBe(false);
  });

  it('lets an ADMIN do all three', async () => {
    const scope = holder('VENDOR_ADMIN');
    for (const level of VENDOR_ACCESS_LEVELS) {
      expect(await allows(scope, 'EMPLOYEE', level)).toBe(true);
    }
  });

  it('gives MD and EA every level with no row at all', async () => {
    const scope = nobody();
    for (const role of ['MD', 'EA']) {
      expect(await scope.accessLevelFor('u1', role)).toBe('VENDOR_ADMIN');
      for (const level of VENDOR_ACCESS_LEVELS) {
        expect(await allows(scope, role, level)).toBe(true);
      }
    }
  });

  it('gives nothing to a user with no row and no privileged role', async () => {
    const scope = nobody();
    for (const role of ['EMPLOYEE', 'HOD', 'PA', 'ADMIN', 'HR']) {
      expect(await scope.accessLevelFor('u1', role)).toBeNull();
      for (const level of VENDOR_ACCESS_LEVELS) {
        expect(await allows(scope, role, level)).toBe(false);
      }
    }
  });

  it('denies a level it cannot rank, rather than treating it as granted', async () => {
    const scope = holder('ADMIN');
    for (const level of VENDOR_ACCESS_LEVELS) {
      expect(await allows(scope, 'EMPLOYEE', level)).toBe(false);
    }
  });
});
