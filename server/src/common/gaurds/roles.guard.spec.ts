import { describe, it, expect } from 'vitest';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { role_enum } from '@prisma/client';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

function ctxFor(user: unknown, roles?: role_enum[]): ExecutionContext {
  const handler = () => undefined;
  if (roles) Reflect.defineMetadata(ROLES_KEY, roles, handler);
  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

const guard = new RolesGuard();

describe('RolesGuard', () => {
  it('lets a public route through when there is no user', () => {
    expect(guard.canActivate(ctxFor(undefined))).toBe(true);
  });

  it('lets an employee through a handler with no @Roles', () => {
    expect(guard.canActivate(ctxFor({ role: role_enum.EMPLOYEE }))).toBe(true);
  });

  // The whole point. Seventeen controllers carry no @Roles, including
  // profile, dashboard, comments and attachments. Every one of them would
  // otherwise answer a vendor login.
  it('refuses a vendor on a handler with no @Roles', () => {
    expect(() => guard.canActivate(ctxFor({ role: role_enum.VENDOR }))).toThrow(
      ForbiddenException,
    );
  });

  it('lets a vendor through only where VENDOR is listed explicitly', () => {
    expect(
      guard.canActivate(ctxFor({ role: role_enum.VENDOR }, [role_enum.VENDOR])),
    ).toBe(true);
  });

  it('still refuses a role that is not on an explicit list', () => {
    expect(() =>
      guard.canActivate(ctxFor({ role: role_enum.EMPLOYEE }, [role_enum.MD])),
    ).toThrow(ForbiddenException);
  });

  it('does not let a vendor inherit access from a broad internal list', () => {
    expect(() =>
      guard.canActivate(
        ctxFor({ role: role_enum.VENDOR }, [
          role_enum.MD,
          role_enum.HOD,
          role_enum.EMPLOYEE,
        ]),
      ),
    ).toThrow(ForbiddenException);
  });
});
