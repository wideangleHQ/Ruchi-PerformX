import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { self_action_priority_enum } from '@prisma/client';

export class UpdateSelfActionDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(self_action_priority_enum)
  @IsOptional()
  priority?: self_action_priority_enum;

  @IsOptional()
  attachments?: Express.Multer.File[];
}
