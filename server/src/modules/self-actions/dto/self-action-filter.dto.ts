// src/modules/self-actions/dto/self-action-filter.dto.ts

import { IsOptional, IsUUID, IsDateString } from 'class-validator';

export class SelfActionFilterDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}