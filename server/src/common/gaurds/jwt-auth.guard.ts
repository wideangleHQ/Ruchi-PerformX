import { Injectable, UnauthorizedException } from '@nestjs/common';
import  type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { VMS_JWT_SECRET } from '../constants/vms-jwt.constants';
import { type VmsJwtPayload } from '../types/vms-jwt-payload.type';

const vmsJwtService = new JwtService({ secret: VMS_JWT_SECRET });

// UUID pattern — ensures the token sub is a real user ID (UUID format), not an access code like "1957"
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class JwtAuthGuard {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    const requestPath = request.originalUrl ?? request.url ?? '';

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided');
    }

    const token = authHeader.split(' ')[1];

    try {
      let payload;
      if (requestPath.includes('/vms/')) {
        payload = vmsJwtService.verify<VmsJwtPayload>(token);
        if (payload.scope !== 'vms') {
          throw new UnauthorizedException('Invalid VMS token scope');
        }
        // Guard: sub must be a valid UUID — reject stale tokens that contain a PIN code
        if (!UUID_REGEX.test(payload.sub)) {
          console.warn(`[JwtAuthGuard] VMS token rejected — sub is not a UUID: "${payload.sub}". Token is stale, force re-login.`);
          throw new UnauthorizedException('Session expired. Please sign in again.');
        }
      } else {
        try {
          payload = this.jwtService.verify(token);
        } catch {
          payload = vmsJwtService.verify<VmsJwtPayload>(token);
          // Also validate UUID on the fallback VMS path
          if (payload?.sub && !UUID_REGEX.test(payload.sub)) {
            throw new UnauthorizedException('Session expired. Please sign in again.');
          }
        }
      }

      request.user = payload;
      return true;
    } catch (err: any) {
      throw new UnauthorizedException(err?.message ?? 'Invalid or expired token');
    }
  }
}
