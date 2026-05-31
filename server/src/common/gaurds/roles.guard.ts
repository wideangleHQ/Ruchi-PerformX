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

@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const requiredRoles =
      Reflect.getMetadata(ROLES_KEY, ctx.getHandler()) ||
      Reflect.getMetadata(ROLES_KEY, ctx.getClass());

    if (!requiredRoles?.length) {
      return true;
    }

    const request = ctx.switchToHttp().getRequest();
    const user: JwtPayload = request.user;

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}