import { IsOptional, IsEnum, IsDateString, IsInt, Min, Max, IsString, MaxLength } from 'class-validator';
import { self_action_status_enum, self_action_priority_enum } from '@prisma/client';
import { Type } from 'class-transformer';

export class SelfActionFilterDto {
  @IsOptional()
  @IsEnum(self_action_status_enum)
  status?: self_action_status_enum;

  @IsOptional()
  @IsEnum(self_action_priority_enum)
  priority?: self_action_priority_enum;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  createdById?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

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
