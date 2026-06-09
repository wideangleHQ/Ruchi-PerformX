import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
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

  async checkEaExists(): Promise<boolean> {
    const count = await this.prisma.users.count({
      where: {
        role: role_enum.EA,
        deleted_at: null,
        OR: [{ is_active: true }, { pending_approval: true }],
      },
    });
    return count > 0;
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

    // Resolve departmentIds: HOD/EA/PA uses junction table; others use department_id
    let departmentIds: string[] = [];
    if (user.role === role_enum.HOD) {
      const hodDepts = await this.prisma.hod_departments.findMany({
        where: { hod_id: user.id },
        select: { department_id: true },
      });
      departmentIds = hodDepts.map((d) => d.department_id);
    } else if (user.role === role_enum.EA || user.role === role_enum.PA) {
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
  const allDepartments = await this.prisma.departments.findMany({
    where: { is_active: true },
    select: { id: true },
  });
  const allDepartmentIds = allDepartments.map((d) => d.id);

  let departmentIds: string[] = [];
  let primaryDepartmentId: string | undefined;

  if (dto.role === role_enum.MD || dto.role === role_enum.EA || dto.role === role_enum.PA) {
    departmentIds = allDepartmentIds;
    primaryDepartmentId = allDepartmentIds[0];
  } else if (dto.role === role_enum.EMPLOYEE) {
    if (dto.departmentId) {
      departmentIds = [dto.departmentId];
      primaryDepartmentId = dto.departmentId;
    }
  } else if (dto.role === role_enum.HOD) {
    departmentIds = [...new Set(dto.departmentIds ?? [])];
  }

  if (dto.role === role_enum.EMPLOYEE) {
    if (departmentIds.length !== 1) {
      throw new BadRequestException('Employee must be assigned exactly one department');
    }
  } else if (dto.role === role_enum.HOD) {
    if (departmentIds.length < 1) {
      throw new BadRequestException('HOD must be assigned at least one department');
    }
  }

  const existingUser = await this.prisma.users.findFirst({
    where: {
      OR: [
        { username: dto.username },
        { email: dto.email },
      ],
    },
  });

  if (existingUser) {
    throw new BadRequestException(
      'Username or Email already exists',
    );
  }

  if (departmentIds.length && (dto.role === role_enum.EMPLOYEE || dto.role === role_enum.HOD)) {
    const departments = await this.prisma.departments.findMany({
      where: {
        id: {
          in: departmentIds,
        },
        is_active: true,
      },
      select: {
        id: true,
      },
    });

    if (departments.length !== departmentIds.length) {
      throw new BadRequestException(
        'Invalid department selection',
      );
    }
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

    ...(primaryDepartmentId
      ? {
          department_id: primaryDepartmentId,
        }
      : {}),
  },
      });

      if (
        dto.role === role_enum.HOD &&
        departmentIds.length > 0
      ) {
        await tx.hod_departments.createMany({
          data: departmentIds.map((department_id) => ({
            hod_id: createdUser.id,
            department_id,
          })),
          skipDuplicates: true,
        });
      }

      if (
        (dto.role === role_enum.EA || dto.role === role_enum.PA) &&
        departmentIds.length > 0
      ) {
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

    throw new BadRequestException(
      'Registration failed. Please verify department selection and user details.',
    );
  }
}

async forgotPassword(dto: ForgotPasswordDto) {
  const user = await this.prisma.users.findUnique({
    where: { email: dto.email },
    select: {
      id: true,
      is_active: true,
      pending_approval: true,
    },
  });

  if (!user) {
    return {
      message: 'Password reset request submitted.',
    };
  }

  if (!user.is_active || user.pending_approval) {
    throw new BadRequestException(
      'Account is not active.',
    );
  }

  const existing =
    await this.prisma.passwordResetRequest.findFirst({
      where: {
        user_id: user.id,
        status: 'PENDING',
      },
    });

  if (existing) {
    return {
      message:
        'A reset request is already pending HOD review.',
    };
  }

  await this.prisma.passwordResetRequest.create({
    data: {
      users: {
        connect: {
          id: user.id,
        },
      },
    },
  });

  return {
    message:
      'Password reset request submitted. Contact your HOD.',
  };
}
  // ─── CHANGE PASSWORD ─────────────────────────────────────────────────────────

  async changePassword(userId: string, newPassword: string) {
    const passwordHash = await bcrypt.hash(newPassword, this.BCRYPT_ROUNDS);

    await this.prisma.users.update({
      where: { id: userId },
      data: { password_hash: passwordHash },
    });

    return { message: 'Password changed successfully.' };
  }

  private isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }
}

