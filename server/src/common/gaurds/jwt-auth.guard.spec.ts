import { describe, it, expect } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { role_enum } from '@prisma/client';

import { JwtAuthGuard } from './jwt-auth.guard';
import { VMS_JWT_SECRET } from '../constants/vms-jwt.constants';

// A reception kiosk token is minted with role ADMIN (access.service.ts). The
// guard used to fall back to the VMS secret on any path outside /vms/, so that
// token authenticated against the whole API as an admin. The only VMS route
// without the prefix was /audit, now /vms/audit, so the fallback is gone and
// this is what keeps it gone.
//
// The secrets come from `test.env` in vitest.config.ts, because both constants
// files throw at import time when their variable is missing.

const USER = '11111111-1111-4111-8111-111111111111';

const mainJwt = new JwtService({ secret: process.env.JWT_SECRET ?? '' });
const vmsJwt = new JwtService({ secret: VMS_JWT_SECRET });

const guard = new JwtAuthGuard(
  { getAllAndOverride: () => false } as never,
  mainJwt,
);

const vmsToken = vmsJwt.sign({
  sub: USER,
  scope: 'vms',
  accessType: 'RECEPTION',
  role: role_enum.ADMIN,
});
const mainToken = mainJwt.sign({ sub: USER, role: role_enum.EMPLOYEE });

function contextFor(token: string, url: string) {
  const request = { headers: { authorization: `Bearer ${token}` }, url };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as never;
}

describe('JwtAuthGuard', () => {
  it('refuses a VMS kiosk token outside the VMS namespace', () => {
    expect(() => guard.canActivate(contextFor(vmsToken, '/api/v1/users'))).toThrow(
      UnauthorizedException,
    );
  });

  it('accepts a VMS kiosk token inside the VMS namespace', () => {
    expect(guard.canActivate(contextFor(vmsToken, '/api/v1/vms/audit'))).toBe(true);
  });

  it('accepts a main token outside the VMS namespace', () => {
    expect(guard.canActivate(contextFor(mainToken, '/api/v1/users'))).toBe(true);
  });

  it('refuses a main token inside the VMS namespace', () => {
    expect(() => guard.canActivate(contextFor(mainToken, '/api/v1/vms/visits'))).toThrow(
      UnauthorizedException,
    );
  });
});
