// src/modules/users/dto/create-user.dto.ts

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  IsEmail,
  IsArray,
  IsBoolean,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { role_enum } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'Username is required' })
  @MaxLength(50)
  @Transform(({ value }) => value?.trim().toLowerCase())
  username!: string;

  @IsEmail({}, { message: 'Email must be valid' })
  @IsNotEmpty({ message: 'Email is required' })
  @Transform(({ value }) => value?.trim().toLowerCase())
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  fullName!: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6)
  @MaxLength(100)
  password!: string;

  @IsEnum(role_enum, { message: 'Invalid role' })
  @IsNotEmpty({ message: 'Role is required' })
  role!: role_enum;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  departmentIds?: string[];

  @IsBoolean()
  @IsOptional()
  canAccessCareerHR?: boolean;
}