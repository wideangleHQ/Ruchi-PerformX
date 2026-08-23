import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { role_enum } from '@prisma/client';

import { HolidaysService } from './holidays.service';

// Moving a holiday between the common and department tiers changes who stops
// working that day. A HOD who could move a departmental holiday to the common
// tier would give the whole company a day off, so the update path checks the
// tier being left as well as the one being joined.

const SALES = '11111111-1111-1111-1111-111111111111';
const WORKS = '22222222-2222-2222-2222-222222222222';

function serviceFor(
  existingDepartmentId: string | null,
  callerDepartmentIds: string[],
) {
  const updated = vi.fn().mockResolvedValue({
    id: 'h1',
    name: 'Founders Day',
    holiday_date: new Date('2026-09-01T00:00:00.000Z'),
    is_optional: false,
    department_id: null,
  });

  const prisma = {
    holidays: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'h1',
        name: 'Founders Day',
        holiday_date: new Date('2026-09-01T00:00:00.000Z'),
        is_optional: false,
        department_id: existingDepartmentId,
      }),
      update: updated,
    },
    departments: {
      findFirst: vi.fn().mockResolvedValue({ id: WORKS }),
      findUnique: vi.fn().mockResolvedValue({ name: 'Works' }),
    },
  };

  const scope = {
    resolveDepartmentScope: vi
      .fn()
      .mockResolvedValue({ unrestricted: false, departmentIds: callerDepartmentIds }),
  };

  return {
    service: new HolidaysService(prisma as never, scope as never),
    update: updated,
  };
}

const user = (role: role_enum) => ({ sub: 'u1', role }) as never;

describe('holiday tier moves', () => {
  it('lets HR move a departmental holiday to the common tier', async () => {
    const { service, update } = serviceFor(SALES, []);

    await service.update('h1', { departmentId: null }, user(role_enum.HR));

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ department_id: null }) }),
    );
  });

  it('lets HR move a common holiday into a department', async () => {
    const { service, update } = serviceFor(null, []);

    await service.update('h1', { departmentId: WORKS }, user(role_enum.HR));

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ department_id: WORKS }) }),
    );
  });

  it('refuses a HOD moving their own holiday to the common tier', async () => {
    const { service, update } = serviceFor(SALES, [SALES]);

    await expect(
      service.update('h1', { departmentId: null }, user(role_enum.HOD)),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses a HOD handing a holiday to a department that is not theirs', async () => {
    const { service, update } = serviceFor(SALES, [SALES]);

    await expect(
      service.update('h1', { departmentId: WORKS }, user(role_enum.HOD)),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });

  it('leaves the tier alone when departmentId is omitted', async () => {
    const { service, update } = serviceFor(SALES, [SALES]);

    await service.update('h1', { name: 'Founders Day (moved)' }, user(role_enum.HOD));

    const call = update.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(call.data).not.toHaveProperty('department_id');
  });
});
