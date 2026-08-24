import { describe, it, expect, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';

// `POST /auth/change-password` took only `newPassword`. Anyone holding a live
// session could set a new one without knowing the old: a borrowed laptop or a
// lifted token was enough to take the account over and lock the owner out.
// There was also no length rule, so this route was the way round the only
// password requirement the product has.

const USER = '11111111-1111-4111-8111-111111111111';

async function serviceFor(currentPassword: string) {
  const update = vi.fn().mockResolvedValue({});
  const prisma = {
    users: {
      findUnique: vi.fn().mockResolvedValue({
        password_hash: await bcrypt.hash(currentPassword, 4),
      }),
      update,
    },
  };
  const service = new AuthService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, update };
}

describe('AuthService.changePassword', () => {
  it('refuses a wrong current password and writes nothing', async () => {
    const { service, update } = await serviceFor('the-real-password');

    await expect(
      service.changePassword(USER, {
        currentPassword: 'a-guess',
        newPassword: 'a-brand-new-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(update).not.toHaveBeenCalled();
  });

  it('accepts the right current password and stores a new hash', async () => {
    const { service, update } = await serviceFor('the-real-password');

    await service.changePassword(USER, {
      currentPassword: 'the-real-password',
      newPassword: 'a-brand-new-password',
    });

    const data = update.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(await bcrypt.compare('a-brand-new-password', data.password_hash as string)).toBe(
      true,
    );
    expect(data.password_changed_at).toBeInstanceOf(Date);
  });
});
