// src/modules/auth/auth.service.ts

import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import type { JwtPayload } from '../../common/types/jwt-payload.type';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.users.findUnique({
      where: {
        username: dto.username,
      },
      select: {
        id: true,
        username: true,
        password_hash: true,
        role: true,
        department_id: true,
        is_active: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid username or password');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('Account is inactive');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.password_hash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      departmentId: user.department_id,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    this.logger.log(
      `User ${user.username} (${user.role}) logged in successfully`,
    );

    return {
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        departmentId: user.department_id,
      },
    };
  }
}