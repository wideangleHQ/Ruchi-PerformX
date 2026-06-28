import { Exclude, Expose, Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { role_enum } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from './dto/swagger-compat';

export enum EmployeeSortBy {
  FULL_NAME = 'fullName',
  EMPLOYEE_CODE = 'employeeCode',
  ROLE = 'role',
  DEPARTMENT = 'department',
}

export enum EmployeeSortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

@Exclude()
export class EmployeeSearchDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Expose()
  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  })
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 1000 })
  @Expose()
  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
  })
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 20;

  @ApiPropertyOptional({ maxLength: 255, description: 'Search by employee name' })
  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @ApiPropertyOptional({ maxLength: 50, description: 'Search by employee code' })
  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  employeeCode?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @Expose()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ enum: EmployeeSortBy, default: EmployeeSortBy.FULL_NAME })
  @Expose()
  @IsOptional()
  @IsEnum(EmployeeSortBy)
  sortBy?: EmployeeSortBy = EmployeeSortBy.FULL_NAME;

  @ApiPropertyOptional({ enum: EmployeeSortOrder, default: EmployeeSortOrder.ASC })
  @Expose()
  @IsOptional()
  @IsEnum(EmployeeSortOrder)
  sortOrder?: EmployeeSortOrder = EmployeeSortOrder.ASC;
}

@Exclude()
export class EmployeeResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  fullName!: string;

  @ApiPropertyOptional()
  @Expose()
  department?: string | null;

  @ApiProperty({ enum: role_enum })
  @Expose()
  role!: role_enum;

  @ApiProperty()
  @Expose()
  employeeCode!: string;
}

@Exclude()
export class PaginationMetaDto {
  @ApiProperty()
  @Expose()
  page!: number;

  @ApiProperty()
  @Expose()
  limit!: number;

  @ApiProperty()
  @Expose()
  totalItems!: number;

  @ApiProperty()
  @Expose()
  totalPages!: number;

  @ApiProperty()
  @Expose()
  hasNextPage!: boolean;

  @ApiProperty()
  @Expose()
  hasPreviousPage!: boolean;
}

@Exclude()
export class EmployeeListResponseDto {
  @ApiProperty({ type: () => [EmployeeResponseDto] })
  @Expose()
  data!: EmployeeResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  @Expose()
  meta!: PaginationMetaDto;
}

