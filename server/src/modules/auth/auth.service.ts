import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { role_enum } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../users/dto/create-user.dto';

@Injectable()
export class AuthService {
  private readonly BCRYPT_ROUNDS = 12;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // ─── LOGIN ───────────────────────────────────────────────────────────────────

  async checkMdExists(): Promise<boolean> {
    const count = await this.prisma.users.count({
      where: {
        role: role_enum.MD,
        deleted_at: null,
        OR: [{ is_active: true }, { pending_approval: true }],
      },
    });
    return count > 0;
  }

  async checkHodExists(departmentId: string): Promise<boolean> {
    const count = await this.prisma.users.count({
      where: {
        role: role_enum.HOD,
        department_id: departmentId,
        deleted_at: null,
        OR: [{ is_active: true }, { pending_approval: true }],
      },
    });
    return count > 0;
  }

  async checkHodExistsByName(departmentName: string): Promise<boolean> {
    const dept = await this.prisma.departments.findUnique({
      where: { name: departmentName },
      select: { id: true },
    });
    if (!dept) return false;
    return this.checkHodExists(dept.id);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.users.findUnique({
      where: { username: dto.username },
      select: {
        id: true,
        username: true,
        password_hash: true,
        role: true,
        full_name: true,
        department_id: true,
        is_active: true,
        pending_approval: true,
      },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordMatch = await bcrypt.compare(dto.password, user.password_hash);
    if (!passwordMatch) throw new UnauthorizedException('Invalid credentials');

    if (user.pending_approval) {
      throw new UnauthorizedException({
        message: 'Your account is awaiting HOD approval.',
        status: 'PENDING',
      });
    }

    if (!user.is_active) {
      throw new UnauthorizedException({
        message: 'Your registration request has been rejected.',
        status: 'REJECTED',
      });
    }

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      departmentId: user.department_id,
      fullName: user.full_name,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      userId: user.id,
      username: user.username,
      role: user.role,
      status: 'ACTIVE',
    };
  }

  // ─── REGISTER ────────────────────────────────────────────────────────────────

  async register(dto: CreateUserDto) {
  const passwordHash = await bcrypt.hash(dto.password, 12);

  const user = await this.prisma.users.create({
  data: {
    username: dto.username,
    email: dto.email,
    full_name: dto.fullName,
    role: dto.role,
    password_hash: passwordHash,
  },
});

  return user;
}

  // ─── FORGOT PASSWORD REQUEST ──────────────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.users.findUnique({
      where: { email: dto.email },
      select: { id: true, is_active: true, pending_approval: true },
    });

    if (!user) return { message: 'Password reset request submitted.' };

    if (!user.is_active || user.pending_approval)
      throw new BadRequestException('Account is not active.');

    // Check if pending request already exists
    const existing = await this.prisma.passwordResetRequest.findFirst({
      where: { user_id: user.id, status: 'PENDING' },
    });

    if (existing)
      return { message: 'A reset request is already pending HOD review.' };

    await this.prisma.passwordResetRequest.create({
      data: { users: { connect: { id: user.id } } },
    });

    return { message: 'Password reset request submitted. Contact your HOD.' };
  }

  // ─── CHANGE PASSWORD (after temp password login) ─────────────────────────────

  async changePassword(userId: string, newPassword: string) {
    const passwordHash = await bcrypt.hash(newPassword, this.BCRYPT_ROUNDS);

    await this.prisma.users.update({
      where: { id: userId },
      data: { password_hash: passwordHash },
    });

    return { message: 'Password changed successfully.' };
  }

  private async resolveDepartmentId(
    department: string | undefined,
    role: role_enum,
  ) {
    if (role === role_enum.MD) return null;

    if (!department) {
      throw new BadRequestException('Department is required for this role');
    }

    const existingDepartment = this.isUuid(department)
      ? await this.prisma.departments.findUnique({ where: { id: department } })
      : await this.prisma.departments.findUnique({ where: { name: department } });

    if (!existingDepartment || !existingDepartment.is_active) {
      throw new NotFoundException('Department not found or inactive');
    }

    return existingDepartment.id;
  }

  private isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }
}
