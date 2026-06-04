// src/modules/users/users.service.ts

import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { role_enum } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from '../../common/types/jwt-payload.type';

const SALT_ROUNDS = 12;

const USER_SELECT = {
  id: true,
  username: true,
  full_name: true,
  role: true,
  is_active: true,
  department_id: true,
  created_at: true,
  departments: {
    select: {
      id: true,
      name: true,
    },
  },
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.users.findMany({
      where: { is_active: true },
      orderBy: { full_name: 'asc' },
      select: USER_SELECT,
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.users.findUnique({
      where: { id },
      select: USER_SELECT,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByDepartment(departmentId: string) {
    return this.prisma.users.findMany({
      where: { department_id: departmentId, is_active: true },
      orderBy: { full_name: 'asc' },
      select: USER_SELECT,
    });
  }

  async create(dto: CreateUserDto) {
    // Validate department requirement
    if (
      (dto.role === role_enum.HOD || dto.role === role_enum.EMPLOYEE) &&
      !dto.departmentId
    ) {
      throw new BadRequestException(
        'Department is required for HOD and EMPLOYEE roles',
      );
    }

    // Check username uniqueness
    const existing = await this.prisma.users.findUnique({
      where: { username: dto.username },
    });

    if (existing) {
      throw new ConflictException('Username already exists');
    }

    // Check email uniqueness
    const existingEmail = await this.prisma.users.findUnique({
      where: { email: dto.email },
    });

    if (existingEmail) {
      throw new ConflictException('Email already exists');
    }

    // Validate department exists
    if (dto.departmentId) {
      const department = await this.prisma.departments.findUnique({
        where: { id: dto.departmentId },
      });

      if (!department || !department.is_active) {
        throw new NotFoundException('Department not found or inactive');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = await this.prisma.users.create({
      data: {
        username: dto.username,
        email: dto.email,
        full_name: dto.fullName,
        password_hash: passwordHash,
        role: dto.role,
        department_id: dto.departmentId ?? null,
      },
      select: USER_SELECT,
    });

    this.logger.log(`User created: ${user.username} [${user.role}]`);
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);

    if (dto.departmentId) {
      const department = await this.prisma.departments.findUnique({
        where: { id: dto.departmentId },
      });

      if (!department || !department.is_active) {
        throw new NotFoundException('Department not found or inactive');
      }
    }

    const updateData: Record<string, unknown> = {
      ...(dto.fullName !== undefined ? { full_name: dto.fullName } : {}),
      ...(dto.departmentId !== undefined ? { department_id: dto.departmentId } : {}),
      ...(dto.isActive !== undefined ? { is_active: dto.isActive } : {}),
    };

    const updated = await this.prisma.users.update({
      where: { id },
      data: updateData,
      select: USER_SELECT,
    });

    this.logger.log(`User updated: ${updated.username}`);
    return updated;
  }

  async resetPassword(id: string, newPassword: string) {
    await this.findOne(id);

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await this.prisma.users.update({
      where: { id },
      data: { password_hash: passwordHash },
    });

    this.logger.log(`Password reset for user: ${id}`);
    return { message: 'Password reset successful' };
  }

  async activate(id: string, user: JwtPayload) {
  const target = await this.prisma.users.findUnique({
    where: { id },
    select: {
      id: true,
      pendingApproval: true,
      departmentId: true,
      role: true,
    },
  });

  if (!target) throw new NotFoundException('User not found');

  if (!target.pendingApproval)
    throw new BadRequestException('User is not pending approval');

  // HOD can only activate users in their department
  if (
    user.role === role_enum.HOD &&
    target.departmentId !== user.departmentId
  ) {
    throw new ForbiddenException('Not authorized to activate this user');
  }

  await this.prisma.users.update({
    where: { id },
    data: {
      is_active: true,
      pendingApproval: false,
    },
  });

  return { message: 'User account activated successfully' };
}
async findPendingApprovals(user: JwtPayload) {
  const where: any = { pendingApproval: true };

  if (user.role === role_enum.HOD) {
    where.departmentId = user.departmentId;
  }

  return this.prisma.users.findMany({
    where,
    select: {
      id: true,
      fullName: true,
      username: true,
      email: true,
      role: true,
      department: { select: { id: true, name: true } },
      createdAt: true,
    },
  });
}
}