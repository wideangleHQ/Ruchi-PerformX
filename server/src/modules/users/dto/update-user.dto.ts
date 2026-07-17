// src/modules/users/dto/update-user.dto.ts

import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsEnum,
  IsArray,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { role_enum } from '@prisma/client';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  fullName?: string;

  @IsEnum(role_enum)
  @IsOptional()
  role?: role_enum;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  departmentIds?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  canAccessCareerHR?: boolean;
}