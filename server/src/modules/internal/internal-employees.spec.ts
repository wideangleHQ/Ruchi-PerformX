import { describe, it, expect } from 'vitest';
import { role_enum } from '@prisma/client';

import {
  toInternalEmployees,
  type InternalUserRow,
} from './internal-employees.service';

// Getting the two filters backwards is silent and expensive: drop the
// deactivated users instead of the deleted ones and CareerX never learns that
// somebody left, so their `hr_employees` row stays active and they keep career
// portal access after their PerformX account is switched off.

const row = (overrides: Partial<InternalUserRow> = {}): InternalUserRow => ({
  id: '11111111-1111-1111-1111-111111111111',
  full_name: 'Asha Rao',
  email: 'asha.rao@ruchigroup.in',
  department_id: '22222222-2222-2222-2222-222222222222',
  role: role_enum.EMPLOYEE,
  is_active: true,
  deleted_at: null,
  ...overrides,
});

describe('toInternalEmployees', () => {
  it('excludes soft-deleted users', () => {
    const result = toInternalEmployees([
      row({ id: 'kept', full_name: 'Kept' }),
      row({ id: 'deleted', full_name: 'Deleted', deleted_at: new Date() }),
    ]);

    expect(result.map((e) => e.id)).toEqual(['kept']);
  });

  it('includes an inactive user with isActive false', () => {
    const result = toInternalEmployees([row({ is_active: false })]);

    expect(result).toHaveLength(1);
    expect(result[0]!.isActive).toBe(false);
  });

  it('treats a null is_active as inactive', () => {
    const result = toInternalEmployees([row({ is_active: null })]);

    expect(result[0]!.isActive).toBe(false);
  });

  it('returns exactly the six documented keys', () => {
    const result = toInternalEmployees([row()]);

    expect(Object.keys(result[0]!).sort()).toEqual([
      'departmentId',
      'email',
      'fullName',
      'id',
      'isActive',
      'role',
    ]);
  });

  it('keeps a null department_id rather than dropping the user', () => {
    const result = toInternalEmployees([row({ department_id: null })]);

    expect(result[0]!.departmentId).toBeNull();
  });
});
