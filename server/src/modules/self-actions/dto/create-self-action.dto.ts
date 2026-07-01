import { IsString, IsNotEmpty, IsOptional, IsEnum, MaxLength, IsArray } from 'class-validator';
import { self_action_priority_enum } from '@prisma/client';
import { UploadedFile } from '../../../common/types/uploaded-file.type';

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
  attachments?: UploadedFile[];

  @IsOptional()
  @IsString()
  department_id?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  department_ids?: string[];
}
