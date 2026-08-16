import {
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import type {
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { role_enum } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { type JwtPayload } from '../types/jwt-payload.type';

/**
 * Roles that are external to RUCHI. A handler carrying no `@Roles` is
 * unreachable by these, and opening one to them has to be written down.
 */
const EXTERNAL_ROLES: role_enum[] = [role_enum.VENDOR];

@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const requiredRoles: role_enum[] | undefined =
      Reflect.getMetadata(ROLES_KEY, ctx.getHandler()) ||
      Reflect.getMetadata(ROLES_KEY, ctx.getClass());

    const request = ctx.switchToHttp().getRequest();
    const user: JwtPayload | undefined = request.user;

    // @Public() routes never populate request.user and never had a role to
    // check. Leave them exactly as they were.
    if (!user) {
      return true;
    }

    if (!requiredRoles?.length) {
      // A handler with no @Roles means "any authenticated user", and that was
      // a safe default for as long as every token holder was an employee.
      // role_enum.VENDOR is an external login on the same token, so the
      // default now has to be closed rather than open: seventeen controllers
      // carry no @Roles at all, including profile, dashboard, comments,
      // notifications and attachments, and none of them was written with an
      // outside reader in mind.
      //
      // Opening a route to a vendor is therefore an explicit @Roles(VENDOR)
      // plus a scope check in the service, which is what
      // modules/vendor-portal/ is for. See docs/src/p2_vendors.md.
      if (EXTERNAL_ROLES.includes(user.role)) {
        throw new ForbiddenException('Insufficient permissions');
      }
      return true;
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
