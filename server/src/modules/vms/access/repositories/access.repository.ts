import { Injectable } from '@nestjs/common';
import { IAccessRepository, VmsAccessVerificationResult } from './access.repository.interface';
import { PrismaService } from '../../../../prisma/prisma.service';

// The fixed UUID of the Receptionist user in the database.
// This UUID is used as the actorId for all VMS reception actions.
const RECEPTION_USER_UUID = '11111111-1111-1111-1111-111111111111';

@Injectable()
export class AccessRepository implements IAccessRepository {
  constructor(private readonly prisma: PrismaService) {}

  async verifyCode(code: string): Promise<VmsAccessVerificationResult | null> {
    if (code === '1957') {
      return {
        success: true,
        accessType: 'RECEPTION',
        accessId: RECEPTION_USER_UUID,
        redirectTo: '/vms/reception/dashboard',
      };
    }

    if (code === '432') {
      const employee = await this.prisma.users.findFirst({
        where: { role: 'EMPLOYEE', deleted_at: null },
      });

      if (!employee) return null;

      return {
        success: true,
        accessType: 'EMPLOYEE',
        accessId: employee.id,
        employeeId: employee.id,
        employeeName: employee.full_name,
        redirectTo: '/vms/employee/request',
      };
    }

    return null;
  }
}

