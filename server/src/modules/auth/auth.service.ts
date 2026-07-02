import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyResetOtpDto } from './dto/verify-reset-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { role_enum } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  private readonly BCRYPT_ROUNDS = 12;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
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

  async checkEaExists(): Promise<boolean> {
    const count = await this.prisma.users.count({
      where: {
        role: role_enum.EA,
        deleted_at: null,
        OR: [{ is_active: true }, { pending_approval: true }],
      },
    });
    return count >= 2;
  }

  async checkPaExists(): Promise<boolean> {
    const count = await this.prisma.users.count({
      where: {
        role: role_enum.PA,
        deleted_at: null,
        OR: [{ is_active: true }, { pending_approval: true }],
      },
    });
    return count > 0;
  }

  async checkHodExists(departmentId: string): Promise<boolean> {
    const department = await this.prisma.departments.findUnique({
      where: { id: departmentId },
      select: { name: true },
    });

    if (department?.name === 'Purchase Non Agro') {
      return false;
    }

    const count = await this.prisma.users.count({
      where: {
        role: role_enum.HOD,
        deleted_at: null,
        OR: [{ is_active: true }, { pending_approval: true }],
        hod_departments: { some: { department_id: departmentId } },
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

  async getDepartments() {
    return this.prisma.departments.findMany({
      where: { is_active: true },
      select: {
        id: true,
        name: true,
        description: true,
        is_active: true,
        created_at: true,
      },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    });
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

    let departmentIds: string[] = [];
    if (user.role === role_enum.HOD) {
      const hodDepts = await this.prisma.hod_departments.findMany({
        where: { hod_id: user.id },
        select: { department_id: true },
      });
      departmentIds = hodDepts.map((d) => d.department_id);
    } else if (user.role === role_enum.PURCHASE_HEAD) {
      departmentIds = await this.getPurchaseDepartmentIds();
    } else if (user.role === role_enum.EA || user.role === role_enum.PA || user.role === role_enum.DEPARTMENT_CONTROLLER) {
      const asstDepts = await this.prisma.assistant_departments.findMany({
        where: { assistant_id: user.id },
        select: { department_id: true },
      });
      departmentIds = asstDepts.map((d) => d.department_id);
    } else if (user.department_id) {
      departmentIds = [user.department_id];
    }

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      departmentId: user.department_id,
      departmentIds,
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
    const departmentIds = await this.resolveRegisterDepartmentIds(dto);
    const existingUser = await this.prisma.users.findFirst({
      where: {
        OR: [{ username: dto.username }, { email: dto.email }],
      },
    });

    if (existingUser) {
      throw new BadRequestException('Username or Email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const createdUser = await tx.users.create({
          data: {
            username: dto.username,
            email: dto.email,
            full_name: dto.fullName,
            role: dto.role,
            password_hash: passwordHash,
            department_id: dto.role === role_enum.EMPLOYEE ? departmentIds[0] ?? null : null,
            is_active: true,
          },
        });

    if (dto.role === role_enum.HOD && departmentIds.length > 0) {
      await tx.hod_departments.createMany({
        data: departmentIds.map((department_id) => ({
          hod_id: createdUser.id,
          department_id,
        })),
        skipDuplicates: true,
      });
    }

        if ((dto.role === role_enum.EA || dto.role === role_enum.PA || dto.role === role_enum.DEPARTMENT_CONTROLLER) && departmentIds.length > 0) {
          await tx.assistant_departments.createMany({
            data: departmentIds.map((department_id) => ({
              assistant_id: createdUser.id,
              department_id,
            })),
            skipDuplicates: true,
          });
        }

        return createdUser;
      });

      return {
        success: true,
        message: 'User registered successfully',
        user,
      };
    } catch (error) {
      console.error('REGISTER ERROR:', error);

      throw new BadRequestException('Registration failed. Please verify department selection and user details.');
    }
  }

async forgotPassword(dto: ForgotPasswordDto) {
  const user = await this.prisma.users.findUnique({
    where: { email: dto.email },
    select: { id: true, email: true, is_active: true, pending_approval: true },
  });

  if (user && user.is_active && !user.pending_approval) {
    const otp = this.generateOtp();
    const otpHash = await bcrypt.hash(otp, this.BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.otpVerification.updateMany({
      where: { email: dto.email, type: 'PASSWORD_RESET', isUsed: false },
      data: { isUsed: true },
    });

    await this.prisma.otpVerification.create({
      data: {
        email: dto.email,
        otpHash,
        type: 'PASSWORD_RESET',
        expiresAt,
      },
    });

    await this.emailService.sendOtpEmail(dto.email, otp, 'PASSWORD_RESET');
  }

  return {
    message: 'If the account exists, an OTP has been sent.',
  };
}

async verifyResetOtp(dto: VerifyResetOtpDto) {
  const otpRecord = await this.prisma.otpVerification.findFirst({
    where: {
      email: dto.email,
      type: 'PASSWORD_RESET',
      isUsed: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otpRecord) {
    throw new BadRequestException('Invalid or expired OTP');
  }

  const matches = await bcrypt.compare(dto.otp, otpRecord.otpHash);
  if (!matches) {
    throw new BadRequestException('Invalid or expired OTP');
  }

  const user = await this.prisma.users.findUnique({
    where: { email: dto.email },
    select: { id: true, email: true, is_active: true, pending_approval: true },
  });

  if (!user || !user.is_active || user.pending_approval) {
    throw new BadRequestException('Invalid or expired OTP');
  }

  const resetToken = await this.jwtService.signAsync(
    { sub: user.id },
    {
      secret: this.getResetSecret(),
      expiresIn: '15m',
    },
  );

  await this.prisma.$transaction([
    this.prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    }),
    this.prisma.otpVerification.create({
      data: {
        email: dto.email,
        otpHash: await bcrypt.hash(resetToken, this.BCRYPT_ROUNDS),
        type: 'PASSWORD_RESET',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    }),
  ]);

  return { resetToken };
}

async resetPassword(dto: ResetPasswordDto) {
  const payload = await this.jwtService.verifyAsync<{ sub: string }>(dto.resetToken, {
    secret: this.getResetSecret(),
  });

  const user = await this.prisma.users.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, is_active: true, pending_approval: true },
  });

  if (!user || !user.is_active || user.pending_approval) {
    throw new BadRequestException('Reset token is invalid or expired');
  }

  const tokenRecord = await this.prisma.otpVerification.findFirst({
    where: {
      email: user.email,
      type: 'PASSWORD_RESET',
      isUsed: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!tokenRecord) {
    throw new BadRequestException('Reset token is invalid or expired');
  }

  const matches = await bcrypt.compare(dto.resetToken, tokenRecord.otpHash);
  if (!matches) {
    throw new BadRequestException('Reset token is invalid or expired');
  }

  const passwordHash = await bcrypt.hash(dto.newPassword, this.BCRYPT_ROUNDS);
  const now = new Date();

  await this.prisma.$transaction([
    this.prisma.users.update({
      where: { id: user.id },
      data: {
        password_hash: passwordHash,
        password_changed_at: now,
      },
    }),
    this.prisma.otpVerification.update({
      where: { id: tokenRecord.id },
      data: { isUsed: true },
    }),
    this.prisma.otpVerification.updateMany({
      where: { email: user.email, type: 'PASSWORD_RESET', isUsed: false },
      data: { isUsed: true },
    }),
  ]);

  return { message: 'Password reset successful' };
}
  // ─── CHANGE PASSWORD ─────────────────────────────────────────────────────────

  async changePassword(userId: string, newPassword: string) {
    const passwordHash = await bcrypt.hash(newPassword, this.BCRYPT_ROUNDS);

    await this.prisma.users.update({
      where: { id: userId },
      data: { password_hash: passwordHash, password_changed_at: new Date() },
    });

    return { message: 'Password changed successfully.' };
  }

  private generateOtp() {
    return `${Math.floor(100000 + Math.random() * 900000)}`;
  }

  private getResetSecret() {
    const jwtSecret = this.configService.get<string>('JWT_SECRET') ?? process.env.JWT_SECRET;
    if (!jwtSecret) throw new InternalServerErrorException('JWT_SECRET environment variable is required');
    return `${jwtSecret}:reset-password`;
  }

  private isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  private async getPurchaseDepartmentIds() {
    const departments = await this.prisma.departments.findMany({
      where: {
        is_active: true,
        name: { in: ['Purchase Agro', 'Purchase Non Agro'] },
      },
      select: { id: true },
    });

    return departments.map((department) => department.id);
  }

  private async resolveRegisterDepartmentIds(dto: CreateUserDto) {
    if (dto.role === role_enum.PURCHASE_HEAD) {
      return [];
    }

    if (dto.role === role_enum.EMPLOYEE) {
      if (!dto.departmentId) {
        throw new BadRequestException('Employee must be assigned exactly one department');
      }

      const department = await this.resolveDepartmentById(dto.departmentId);
      return [department.id];
    }

    if (dto.role === role_enum.HOD) {
      const departmentIds = [...new Set(dto.departmentIds ?? [])];
      if (!departmentIds.length) {
        throw new BadRequestException('HOD must be assigned at least one department');
      }

      const departments = await this.prisma.departments.findMany({
        where: { id: { in: departmentIds }, is_active: true },
        select: { id: true, name: true },
      });

      if (departments.length !== departmentIds.length) {
        throw new BadRequestException('Invalid department selection');
      }

      for (const department of departments) {
        if (department.name !== 'Purchase Non Agro' && (await this.checkHodExists(department.id))) {
          throw new ConflictException('HOD already exists for this department.');
        }
      }

      return departmentIds;
    }

    if (dto.role === role_enum.EA || dto.role === role_enum.PA || dto.role === role_enum.DEPARTMENT_CONTROLLER) {
      const departmentIds = [...new Set(dto.departmentIds ?? [])];
      if (!departmentIds.length) {
        throw new BadRequestException('Department Controller must be assigned at least one department');
      }

      const departments = await this.prisma.departments.findMany({
        where: { id: { in: departmentIds }, is_active: true },
        select: { id: true },
      });

      if (departments.length !== departmentIds.length) {
        throw new BadRequestException('Invalid department selection');
      }

      return departmentIds;
    }

    if (dto.departmentId) {
      const department = await this.resolveDepartmentById(dto.departmentId);
      return [department.id];
    }

    return [];
  }

  private async resolveDepartmentById(departmentId: string) {
    const department = await this.prisma.departments.findUnique({
      where: { id: departmentId },
      select: { id: true, is_active: true },
    });

    if (!department || !department.is_active) {
      throw new BadRequestException('Invalid department selection');
    }

    return department;
  }
}
