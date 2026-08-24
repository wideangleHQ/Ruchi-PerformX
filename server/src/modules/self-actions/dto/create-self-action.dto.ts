import { IsString, IsNotEmpty, IsOptional, IsEnum, MaxLength, IsArray } from 'class-validator';
import { self_action_priority_enum } from '@prisma/client';
import { UploadedFile } from '../../../common/types/uploaded-file.type';

export class CreateSelfActionDto {
  /** The one field the form collects. "Work", in the client's words. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  /**
   * Optional since the form merged into a single field. The column stays and
   * stays NOT NULL, so the service defaults it to an empty string: the 7,408
   * rows written before the merge keep their descriptions and still show them,
   * and nothing needed migrating.
   */
  @IsOptional()
  @IsString()
  description?: string;

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
