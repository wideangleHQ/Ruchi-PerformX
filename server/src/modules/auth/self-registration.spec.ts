import { describe, it, expect, vi } from 'vitest';
import { ValidationPipe, type ArgumentMetadata } from '@nestjs/common';
import { role_enum } from '@prisma/client';

import { AuthService } from './auth.service';
import { RegisterDto, SELF_REGISTERABLE_ROLES } from './dto/register.dto';

// `POST /auth/register` is public. It used to write `is_active: true` and never
// set `pending_approval`, and `@IsEnum(role_enum)` accepted every role, so
// anyone who could reach the signup page could create a live MD account and log
// straight in. `login` already refused both states; register simply never set
// them.

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const body = (role: string) => ({
  username: 'stranger',
  email: 'stranger@example.invalid',
  fullName: 'A Stranger',
  password: 'a-long-enough-password',
  role,
  departmentIds: ['11111111-1111-4111-8111-111111111111'],
});

const meta = { type: 'body', metatype: RegisterDto } as ArgumentMetadata;

describe('self-registration role whitelist', () => {
  it.each([role_enum.ADMIN, role_enum.VENDOR])('refuses %s', async (role) => {
    await expect(pipe.transform(body(role), meta)).rejects.toThrow();
  });

  it('accepts a role the signup form offers', async () => {
    await expect(pipe.transform(body(role_enum.EMPLOYEE), meta)).resolves.toBeDefined();
  });

  it('never lists ADMIN or VENDOR', () => {
    expect(SELF_REGISTERABLE_ROLES).not.toContain(role_enum.ADMIN);
    expect(SELF_REGISTERABLE_ROLES).not.toContain(role_enum.VENDOR);
  });
});

describe('AuthService.register', () => {
  it('creates the account pending and inactive, not live', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'u1' });
    const prisma = {
      users: { findFirst: vi.fn().mockResolvedValue(null) },
      departments: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn(
        async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            users: { create },
            hod_departments: { createMany: vi.fn() },
            assistant_departments: { createMany: vi.fn() },
          }),
      ),
    };

    const service = new AuthService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await service.register({
      username: 'stranger',
      email: 'stranger@example.invalid',
      fullName: 'A Stranger',
      password: 'a-long-enough-password',
      role: role_enum.PURCHASE_HEAD,
    } as never);

    const data = create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.is_active).toBe(false);
    expect(data.pending_approval).toBe(true);
  });
});
