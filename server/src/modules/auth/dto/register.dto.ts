import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, IsArray, IsUUID, MinLength, ArrayMinSize } from 'class-validator';
import { role_enum } from '@prisma/client';

/**
 * What a stranger may ask to be. Not every role: ADMIN administers the system
 * and VENDOR belongs to the external portal, which `just vendor-roles` keeps out
 * of the main API entirely. Neither is on the signup form, and accepting them
 * here meant the form was the only thing stopping it.
 *
 * The request still lands as pending, so this is the second gate rather than
 * the only one.
 */
export const SELF_REGISTERABLE_ROLES: role_enum[] = [
  role_enum.MD,
  role_enum.EA,
  role_enum.PA,
  role_enum.PURCHASE_HEAD,
  role_enum.DEPARTMENT_CONTROLLER,
  role_enum.HOD,
  role_enum.EMPLOYEE,
];

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
  @IsIn(SELF_REGISTERABLE_ROLES, { message: 'That role cannot be self-registered' })
  role!: role_enum;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  departmentIds?: string[];
}
