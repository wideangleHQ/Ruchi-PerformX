import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsArray, IsUUID, MinLength, ArrayMinSize } from 'class-validator';
import { role_enum } from '@prisma/client';

export class RegisterDto {
  @IsNotEmpty()
  @IsString()
  username!: string;

  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @IsString()
  fullName!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  password!: string;

  @IsNotEmpty()
  @IsEnum(role_enum)
  role!: role_enum;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  departmentIds?: string[];
}