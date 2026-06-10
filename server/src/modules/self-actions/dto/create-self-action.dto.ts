import { IsString, IsNotEmpty, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { self_action_priority_enum } from '@prisma/client';

export class CreateSelfActionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsEnum(self_action_priority_enum)
  @IsOptional()
  priority?: self_action_priority_enum;

  @IsOptional()
  attachments?: Express.Multer.File[];

  @IsOptional()
  @IsString()
  department_id?: string;
}
