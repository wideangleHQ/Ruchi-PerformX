import { IsEnum, IsOptional, IsString, IsUUID, IsDateString, IsInt, Min, Max } from 'class-validator';
import { task_status_enum , task_priority_enum } from '@prisma/client';
import { Type } from 'class-transformer';

export class TaskFilterDto {
  @IsOptional()
  @IsEnum(task_status_enum)
  status?: task_status_enum;

  @IsOptional()
  @IsEnum(task_priority_enum)
  priority?: task_priority_enum;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsDateString()
  dueBefore?: string;

  @IsOptional()
  @IsDateString()
  dueAfter?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
