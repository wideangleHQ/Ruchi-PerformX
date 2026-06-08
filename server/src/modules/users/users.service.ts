import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { role_enum } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const USER_SELECT = {
  id: true,
  username: true,
  full_name: true,
  email: true,
  role: true,
  is_active: true,
  pending_approval: true,
  department_id: true,
  departments: { select: { id: true, name: true } },
  hod_departments: {
    include: {
      departments: { select: { name: true } },
    },
  },
  assistant_departments: {
    include: {
      departments: { select: { name: true } },
    },
  },
  created_at: true,
};

type SelectedUser = {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role: role_enum;
  is_active: boolean | null;
  pending_approval: boolean | null;
  department_id: string | null;
  departments: { id: string; name: string } | null;
  created_at: Date | null;
};

@Injectable()
export class UsersService {
  private readonly BCRYPT_ROUNDS = 12;

  constructor(private readonly prisma: PrismaService) {}

  // ─── ROLE CONSTRAINT CHECKS ───────────────────────────────────────────────────

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

  private async validateRoleConstraints(role: role_enum, departmentId?: string | null) {
    if (role === role_enum.MD) {
      const mdExists = await this.checkMdExists();
      if (mdExists) {
        throw new ConflictException('Managing Director already exists.');
      }
    }

    if (role === role_enum.EA) {
      const eaExists = await this.checkEaExists();
      if (eaExists) {
        throw new ConflictException('Executive Assistant already exists.');
      }
    }

    if (role === role_enum.PA) {
      const paExists = await this.checkPaExists();
      if (paExists) {
        throw new ConflictException('Personal Assistant already exists.');
      }
    }

    if (role === role_enum.HOD && departmentId) {
      const hodExists = await this.checkHodExists(departmentId);
      if (hodExists) {
        throw new ConflictException('HOD already exists for this department.');
      }
    }
  }

  async findAll() {
    const users = await this.prisma.users.findMany({
      where: { deleted_at: null },
      select: USER_SELECT,
      orderBy: { created_at: 'desc' },
    });

    return users.map((user) => this.toUserResponse(user));
  }

  async findOne(id: string) {
    const user = await this.prisma.users.findUnique({
      where: { id },
      select: USER_SELECT,
    });

    if (!user) throw new NotFoundException('User not found');
    return this.toUserResponse(user);
  }

  async findByDepartment(departmentId: string) {
    const users = await this.prisma.users.findMany({
      where: { department_id: departmentId, deleted_at: null },
      select: USER_SELECT,
    });

    return users.map((user) => this.toUserResponse(user));
  }

  async findAssignable(caller: JwtPayload, departmentId?: string, role?: role_enum) {
    const where: Record<string, any> = {
      is_active: true,
      deleted_at: null,
      pending_approval: false,
    };

    if (caller.role === role_enum.HOD) {
      // HOD: only employees in any of their assigned departments
      const deptIds = caller.departmentIds ?? (caller.departmentId ? [caller.departmentId] : []);
      where.department_id = { in: deptIds };
      where.role = role_enum.EMPLOYEE;
    } else if (caller.role === role_enum.EA || caller.role === role_enum.PA) {
      // EA/PA: HOD or EMPLOYEE across selected departments only
      const allowedDepts = caller.departmentIds ?? [];
      const depts = departmentId ? [departmentId] : allowedDepts;
      const targetDepts = depts.filter(d => allowedDepts.includes(d));

      where.OR = [
        {
          role: role_enum.EMPLOYEE,
          department_id: { in: targetDepts },
        },
        {
          role: role_enum.HOD,
          hod_departments: { some: { department_id: { in: targetDepts } } },
        }
      ];

      if (role) {
        where.role = role;
      }
    } else {
      // MD/ADMIN: filter by department and/or role if provided
      if (departmentId && role) {
        where.role = role;
        if (role === role_enum.EMPLOYEE) {
          where.department_id = departmentId;
        } else if (role === role_enum.HOD) {
          where.hod_departments = { some: { department_id: departmentId } };
        } else if (role === role_enum.EA || role === role_enum.PA) {
          where.assistant_departments = { some: { department_id: departmentId } };
        }
      } else if (departmentId) {
        where.OR = [
          { department_id: departmentId },
          { hod_departments: { some: { department_id: departmentId } } },
          { assistant_departments: { some: { department_id: departmentId } } },
        ];
      } else if (role) {
        where.role = role;
      }
    }

    const users = await this.prisma.users.findMany({
      where,
      select: USER_SELECT,
      orderBy: { full_name: 'asc' },
    });

    return users.map((u) => this.toUserResponse(u));
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.users.findUnique({
      where: { username: dto.username },
    });
    if (existing) throw new ConflictException('Username already exists');

    await this.validateRoleConstraints(dto.role, dto.departmentId);

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.users.create({
      data: {
        full_name: dto.fullName,
        username: dto.username,
        email: dto.email ?? null,
        password_hash: passwordHash,
        role: dto.role,
        department_id: (dto.role !== role_enum.HOD && dto.role !== role_enum.EA && dto.role !== role_enum.PA) ? (dto.departmentId ?? null) : null,
        is_active: dto.role === role_enum.MD || dto.role === role_enum.HOD || dto.role === role_enum.EA || dto.role === role_enum.PA,
      },
    });

    // HOD: create hod_departments junction rows
    if (dto.role === role_enum.HOD && dto.departmentIds && dto.departmentIds.length > 0) {
      await this.prisma.hod_departments.createMany({
        data: dto.departmentIds.map((department_id) => ({
          hod_id: user.id,
          department_id,
        })),
        skipDuplicates: true,
      });
    }

    // EA/PA: create assistant_departments junction rows
    if ((dto.role === role_enum.EA || dto.role === role_enum.PA) && dto.departmentIds && dto.departmentIds.length > 0) {
      await this.prisma.assistant_departments.createMany({
        data: dto.departmentIds.map((department_id) => ({
          assistant_id: user.id,
          department_id,
        })),
        skipDuplicates: true,
      });
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    const existing = await this.ensureExists(id);
    const departmentId =
      dto.departmentId !== undefined
        ? await this.resolveDepartmentId(dto.departmentId)
        : undefined;

    const role = dto.role !== undefined ? dto.role : existing.role;

    // Clear single department_id for HOD / EA / PA
    const resolvedDeptId = (role === role_enum.HOD || role === role_enum.EA || role === role_enum.PA)
      ? null
      : dto.departmentId !== undefined ? departmentId : undefined;

    const user = await this.prisma.users.update({
      where: { id },
      data: {
        ...(dto.fullName !== undefined ? { full_name: dto.fullName } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(resolvedDeptId !== undefined
          ? resolvedDeptId
            ? { departments: { connect: { id: resolvedDeptId } } }
            : { departments: { disconnect: true } }
          : {}),
        ...(dto.isActive !== undefined ? { is_active: dto.isActive } : {}),
      },
      select: USER_SELECT,
    });

    // Clean up unused relations if role changes
    if (dto.role !== undefined) {
      if (dto.role !== role_enum.HOD) {
        await this.prisma.hod_departments.deleteMany({ where: { hod_id: id } });
      }
      if (dto.role !== role_enum.EA && dto.role !== role_enum.PA) {
        await this.prisma.assistant_departments.deleteMany({ where: { assistant_id: id } });
      }
    }

    // If departmentIds is provided, sync the junction table
    if (dto.departmentIds !== undefined) {
      if (user.role === role_enum.HOD) {
        await this.prisma.hod_departments.deleteMany({ where: { hod_id: id } });
        if (dto.departmentIds.length > 0) {
          await this.prisma.hod_departments.createMany({
            data: dto.departmentIds.map((department_id) => ({
              hod_id: id,
              department_id,
            })),
            skipDuplicates: true,
          });
        }
      } else if (user.role === role_enum.EA || user.role === role_enum.PA) {
        await this.prisma.assistant_departments.deleteMany({ where: { assistant_id: id } });
        if (dto.departmentIds.length > 0) {
          await this.prisma.assistant_departments.createMany({
            data: dto.departmentIds.map((department_id) => ({
              assistant_id: id,
              department_id,
            })),
            skipDuplicates: true,
          });
        }
      }
    }

    const updatedUser = await this.prisma.users.findUnique({
      where: { id },
      select: USER_SELECT,
    });

    return this.toUserResponse(updatedUser);
  }

  async remove(id: string) {
    await this.ensureExists(id);

    await this.prisma.users.update({
      where: { id },
      data: { deleted_at: new Date() },
    });

    return { message: 'User deleted successfully' };
  }

  async findPending(user: JwtPayload) {
    const where: Record<string, any> = {
      pending_approval: true,
      deleted_at: null,
    };

    if (user.role === role_enum.HOD) {
      const deptIds = user.departmentIds ?? (user.departmentId ? [user.departmentId] : []);
      where.department_id = { in: deptIds };
    }

    const users = await this.prisma.users.findMany({
      where,
      select: USER_SELECT,
      orderBy: { created_at: 'asc' },
    });

    return users.map((pendingUser) => this.toUserResponse(pendingUser));
  }

  async activate(id: string, user: JwtPayload) {
    return this.approve(id, user);
  }

  async approve(id: string, user: JwtPayload) {
    const target = await this.ensureExists(id);

    if (!target.pending_approval) {
      throw new BadRequestException('User is not pending approval');
    }

    if (user.role === role_enum.HOD) {
      const deptIds = user.departmentIds ?? (user.departmentId ? [user.departmentId] : []);
      if (!deptIds.includes(target.department_id ?? '')) {
        throw new ForbiddenException('Not authorized to approve this user');
      }
    }

    await this.validateRoleConstraints(target.role, target.department_id);

    await this.prisma.users.update({
      where: { id },
      data: { is_active: true, pending_approval: false },
    });

    return { message: 'User approved successfully' };
  }

  async reject(id: string, user: JwtPayload) {
    const target = await this.ensureExists(id);

    if (!target.pending_approval) {
      throw new BadRequestException('User is not pending approval');
    }

    if (user.role === role_enum.HOD) {
      const deptIds = user.departmentIds ?? (user.departmentId ? [user.departmentId] : []);
      if (!deptIds.includes(target.department_id ?? '')) {
        throw new ForbiddenException('Not authorized to reject this user');
      }
    }

    await this.prisma.users.update({
      where: { id },
      data: { is_active: false, pending_approval: false },
    });

    return { message: 'User rejected successfully' };
  }

  async findPasswordResetRequests(user: JwtPayload) {
    const where: Record<string, any> = { status: 'PENDING' };

    if (user.role === role_enum.HOD) {
      const deptIds = user.departmentIds ?? (user.departmentId ? [user.departmentId] : []);
      where.users = { department_id: { in: deptIds } };
    }

    return this.prisma.passwordResetRequest.findMany({
      where,
      select: {
        id: true,
        status: true,
        created_at: true,
        users: {
          select: {
            id: true,
            full_name: true,
            username: true,
            departments: { select: { name: true } },
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });
  }

  async resetPassword(id: string, userOrNewPassword: JwtPayload | string) {
    if (typeof userOrNewPassword === 'string') {
      return this.adminResetPassword(id, userOrNewPassword);
    }

    const target = await this.ensureExists(id);

    if (userOrNewPassword.role === role_enum.HOD) {
      const deptIds = userOrNewPassword.departmentIds ?? (userOrNewPassword.departmentId ? [userOrNewPassword.departmentId] : []);
      if (!deptIds.includes(target.department_id ?? '')) {
        throw new ForbiddenException('Not authorized to reset this user password');
      }
    }

    const tempPassword = this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, this.BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.users.update({
        where: { id },
        data: { password_hash: passwordHash },
      }),
      this.prisma.passwordResetRequest.updateMany({
        where: { user_id: id, status: 'PENDING' },
        data: { status: 'RESOLVED', temp_password: passwordHash },
      }),
    ]);

    return {
      message: 'Temporary password generated. Share with user securely.',
      tempPassword,
    };
  }

  async adminResetPassword(id: string, newPassword: string) {
    await this.ensureExists(id);

    const passwordHash = await bcrypt.hash(newPassword, this.BCRYPT_ROUNDS);

    await this.prisma.users.update({
      where: { id },
      data: { password_hash: passwordHash },
    });

    return { message: 'Password reset successfully' };
  }

  private async ensureExists(id: string) {
    const user = await this.prisma.users.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        department_id: true,
        is_active: true,
        pending_approval: true,
        deleted_at: true,
      },
    });

    if (!user || user.deleted_at) throw new NotFoundException('User not found');
    return user;
  }

  private toUserResponse(user: any) {
    let departmentName = user.departments?.name || null;
    let departmentIds: string[] = [];

    if (user.role === role_enum.HOD && user.hod_departments) {
      departmentName = user.hod_departments
        .map((hd: any) => hd.departments?.name)
        .filter(Boolean)
        .join(', ');
      departmentIds = user.hod_departments.map((hd: any) => hd.department_id);
    } else if ((user.role === role_enum.EA || user.role === role_enum.PA) && user.assistant_departments) {
      departmentName = user.assistant_departments
        .map((ad: any) => ad.departments?.name)
        .filter(Boolean)
        .join(', ');
      departmentIds = user.assistant_departments.map((ad: any) => ad.department_id);
    } else if (user.department_id) {
      departmentIds = [user.department_id];
    }

    return {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      status: this.getUserStatus(user),
      isActive: user.is_active,
      pendingApproval: user.pending_approval,
      departmentId: user.department_id,
      departmentIds,
      department: departmentName,
      createdAt: user.created_at,
    };
  }

  private getUserStatus(user: Pick<SelectedUser, 'is_active' | 'pending_approval'>) {
    if (user.pending_approval) return 'PENDING';
    if (user.is_active) return 'ACTIVE';
    return 'REJECTED';
  }

  private async resolveDepartmentId(department: string | undefined) {
    if (!department) return null;

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

  private generateTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$';
    return Array.from({ length: 10 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length)),
    ).join('');
  }
}
