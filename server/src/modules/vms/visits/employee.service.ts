import { Injectable } from '@nestjs/common';
import { EmployeeListResponseDto, EmployeeResponseDto, EmployeeSearchDto } from './employee.dto';
import { EmployeeRepository } from './employee.repository';

@Injectable()
export class EmployeeService {
  constructor(private readonly employeeRepository: EmployeeRepository) {}

  async getEmployees(query: EmployeeSearchDto): Promise<EmployeeListResponseDto> {
    const result = await this.employeeRepository.search(query);

    return {
      data: result.data.map((employee) => this.mapEmployee(employee)),
      meta: result.meta,
    };
  }

  private mapEmployee(employee: {
    id: string;
    full_name: string;
    username: string;
    role: import('@prisma/client').role_enum;
    departments: { id: string; name: string } | null;
  }): EmployeeResponseDto {
    return {
      id: employee.id,
      fullName: employee.full_name,
      department: employee.departments?.name ?? null,
      role: employee.role,
      employeeCode: employee.username,
    };
  }
}

