import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { request_type_enum } from '@prisma/client';

export class CreateRequestDto {
  @IsNotEmpty()
  @IsString()
  title!: string;

  @IsNotEmpty()
  @IsString()
  description!: string;

  @IsNotEmpty()
  @IsEnum(request_type_enum)
  type!: request_type_enum;
}