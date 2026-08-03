// src/modules/hod-score/guards/hod-score-access.guard.ts

import { ForbiddenException, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { role_enum } from '@prisma/client';
import { JwtPayload } from '../../../common/types/jwt-payload.type';

/**
 * Roles permitted to reach any HOD score endpoint.
 *
 * EMPLOYEE (and every other role) is denied with 403 before the request
 * reaches the service, in addition to the @Roles metadata enforced by the
 * global RolesGuard. This guard is the explicit, module-level backstop so a
 * future controller method that forgets @Roles still cannot leak scores.
 */
const HOD_SCORE_VIEWER_ROLES: role_enum[] = [
  role_enum.MD,
  role_enum.EA,
  role_enum.PA,
  role_enum.DEPARTMENT_CONTROLLER,
  role_enum.HOD,
];

@Injectable()
export class HodScoreAccessGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const request = ctx.switchToHttp().getRequest();
    const user: JwtPayload | undefined = request.user;

    if (!user?.sub || !user?.role) {
      throw new ForbiddenException('Access denied');
    }

    if (!HOD_SCORE_VIEWER_ROLES.includes(user.role)) {
      throw new ForbiddenException('Access denied');
    }

    return true;
  }
}

export { HOD_SCORE_VIEWER_ROLES };
