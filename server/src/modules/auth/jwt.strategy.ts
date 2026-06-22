import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { type JwtPayload } from '../../common/types/jwt-payload.type';
import * as dotenv from 'dotenv';
dotenv.config();

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.users.findUnique({
      where: { id: payload.sub },
      select: { id: true, is_active: true, password_changed_at: true },
    });

    if (!user || !user.is_active) throw new UnauthorizedException('Account inactive or not found');
    if (user.password_changed_at && payload.iat && payload.iat * 1000 < new Date(user.password_changed_at as any).getTime()) {
      throw new UnauthorizedException('Session expired');
    }

    return payload;
  }
}
