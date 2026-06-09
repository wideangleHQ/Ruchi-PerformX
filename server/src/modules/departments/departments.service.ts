// src/modules/departments/departments.service.ts

import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department-dto';
import { UpdateDepartmentDto } from './dto/update-department-dto';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { role_enum } from '@prisma/client';

@Injectable()
export class DepartmentsService {
  private readonly logger = new Logger(DepartmentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(user?: JwtPayload) {
    return this.prisma.departments.findMany({
      where: {
        is_active: true,
        ...(user?.role === role_enum.HOD
          ? { hod_departments: { some: { hod_id: user.sub } } }
          : {}),
      },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        is_active: true,
        created_at: true,
      },
    });
  }

  async findOne(id: string) {
    const department = await this.prisma.departments.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        is_active: true,
        created_at: true,
        updated_at: true,
        _count: {
          select: { users: true },
        },
      },
    });

    if (!department) {
      throw new NotFoundException(`Department not found`);
    }

    const { _count, ...departmentData } = department;
    return {
      ...departmentData,
      memberCount: _count.users,
    };
  }

  async create(dto: CreateDepartmentDto) {
    const existing = await this.prisma.departments.findFirst({
      where: { name: { equals: dto.name!, mode: 'insensitive' } },
    });

    if (existing) {
      throw new ConflictException('Department name already exists');
    }

    const department = await this.prisma.departments.create({
      data: {
        name: dto.name!,
        ...(dto.description !== undefined ? { description: dto.description } : {}),
      },
      select: {
        id: true,
        name: true,
        description: true,
        is_active: true,
        created_at: true,
      },
    });

    this.logger.log(`Department created: ${department.name}`);
    return department;
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    await this.findOne(id);

    if (dto.name) {
      const existing = await this.prisma.departments.findFirst({
        where: {
          name: { equals: dto.name, mode: 'insensitive' },
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException('Department name already exists');
      }
    }

    const updateData: Record<string, unknown> = {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.isActive !== undefined ? { is_active: dto.isActive } : {}),
    };

    const updated = await this.prisma.departments.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        description: true,
        is_active: true,
        updated_at: true,
      },
    });

    this.logger.log(`Department updated: ${updated.name}`);
    return updated;
  }
}
