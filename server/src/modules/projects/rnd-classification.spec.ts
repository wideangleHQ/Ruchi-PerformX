import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { role_enum } from '@prisma/client';

import { ProjectsService } from './projects.service';

// `is_rnd` was an ordinary boolean on the DTO with nothing behind it, so any
// employee could create an R&D project or flip one. The reports half of R&D
// scopes visibility by that flag, so who may set it is an access decision.

type Guard = { assertMayClassifyRnd(user: unknown): Promise<void> };

function serviceFor(isMember: boolean) {
  const rnd = { isMember: vi.fn().mockResolvedValue(isMember) };
  const service = new ProjectsService(
    {} as never,
    {} as never,
    rnd as never,
  );
  return { service: service as unknown as Guard, rnd };
}

const user = (role: role_enum) => ({ sub: 'u1', role });

describe('assertMayClassifyRnd', () => {
  it.each([role_enum.MD, role_enum.EA, role_enum.PA])(
    'lets %s classify without a roster lookup',
    async (role) => {
      const { service, rnd } = serviceFor(false);
      await expect(
        service.assertMayClassifyRnd(user(role)),
      ).resolves.toBeUndefined();
      expect(rnd.isMember).not.toHaveBeenCalled();
    },
  );

  it('lets an R&D team member classify', async () => {
    const { service } = serviceFor(true);
    await expect(
      service.assertMayClassifyRnd(user(role_enum.EMPLOYEE)),
    ).resolves.toBeUndefined();
  });

  it('refuses an employee who is not on the roster', async () => {
    const { service } = serviceFor(false);
    await expect(
      service.assertMayClassifyRnd(user(role_enum.EMPLOYEE)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses a HOD, who has no standing in R&D', async () => {
    const { service } = serviceFor(false);
    await expect(
      service.assertMayClassifyRnd(user(role_enum.HOD)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses ADMIN, which is unrestricted elsewhere but not here', async () => {
    const { service } = serviceFor(false);
    await expect(
      service.assertMayClassifyRnd(user(role_enum.ADMIN)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
