import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProfileResponseDto } from './dto/profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { role_enum } from '@prisma/client';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<ProfileResponseDto> {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        full_name: true,
        email: true,
        username: true,
        mobile_number: true,
        role: true,
        department_id: true,
        created_at: true,
        departments: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.mapProfile(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<ProfileResponseDto> {
    if (dto.email) {
      const existing = await this.prisma.users.findFirst({
        where: {
          email: dto.email,
          id: { not: userId },
        },
      });

      if (existing) {
        throw new ConflictException('Email already in use');
      }
    }

    if (dto.username) {
      const existing = await this.prisma.users.findFirst({
        where: {
          username: dto.username,
          id: { not: userId },
        },
      });

      if (existing) {
        throw new ConflictException('Username already in use');
      }
    }

    const updateData: any = {};
    if (dto.fullName !== undefined) updateData.full_name = dto.fullName;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.username !== undefined) updateData.username = dto.username;
    if (dto.mobileNumber !== undefined) updateData.mobile_number = dto.mobileNumber;

    const updated = await this.prisma.users.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        full_name: true,
        email: true,
        username: true,
        mobile_number: true,
        role: true,
        department_id: true,
        created_at: true,
        departments: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return this.mapProfile(updated);
  }

  private async mapProfile(user: {
    id: string;
    full_name: string;
    email: string;
    username: string;
    mobile_number: string | null;
    role: role_enum;
    department_id: string | null;
    created_at: Date | null;
    departments: { id: string; name: string } | null;
  }): Promise<ProfileResponseDto> {
    let departmentId: string | null = user.department_id;
    let departmentName: string | null | undefined = user.departments?.name ?? null;
    let departmentIds: string[] | undefined;
    let departmentNames: string[] | undefined;

    if (user.role === role_enum.HOD) {
      const hodDepts = await this.prisma.hod_departments.findMany({
        where: { hod_id: user.id },
        select: { 
          department_id: true,
          departments: { select: { name: true } }
        },
      });

      if (hodDepts.length > 0) {
        departmentIds = hodDepts.map((d) => d.department_id);
        departmentNames = hodDepts.map((d) => d.departments.name);
        departmentId = departmentIds[0] ?? null;
        departmentName = departmentNames[0] ?? null;
      }
    } else if (user.role === role_enum.EA || user.role === role_enum.PA) {
      const assistantDepts = await this.prisma.assistant_departments.findMany({
        where: { assistant_id: user.id },
        select: { 
          department_id: true,
          departments: { select: { name: true } }
        },
      });

      if (assistantDepts.length > 0) {
        departmentIds = assistantDepts.map((d) => d.department_id);
        departmentNames = assistantDepts.map((d) => d.departments.name);
        departmentId = departmentIds[0] ?? null;
        departmentName = departmentNames[0] ?? null;
      }
    }

    return {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      username: user.username,
      mobileNumber: user.mobile_number,
      designation: user.role as string,
      role: user.role as string,
      departmentId,
      departmentName,
      departmentIds,
      departmentNames,
      createdAt: user.created_at,
    };
  }
}