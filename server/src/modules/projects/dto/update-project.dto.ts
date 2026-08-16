import { project_status_enum } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PROJECT_PRIORITIES } from './create-project.dto';

/**
 * The editable surface of a project. Written out field by field rather than
 * derived from CreateProjectDto, because the two differ in ways that matter
 * and `forbidNonWhitelisted` makes the difference load bearing:
 *
 * - `project_code` appears in neither, so a client that sends one gets a 400
 *   instead of renaming a project everybody has already bookmarked.
 * - `status` appears only here, and the service runs it through the transition
 *   table. A value that is legal for the enum is not automatically legal for
 *   this project's current state.
 * - `health` appears in neither. It is derived on the deadline sweep.
 * - `co_lead_id` accepts null, which is how a co-lead is removed.
 */
export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  objective?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  project_type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsIn(PROJECT_PRIORITIES)
  priority?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(project_status_enum)
  status?: project_status_enum;

  @IsOptional()
  @IsUUID()
  lead_id?: string;

  @IsOptional()
  @IsUUID()
  co_lead_id?: string | null;

  @IsOptional()
  @IsUUID()
  department_id?: string | null;

  @IsOptional()
  @IsDateString()
  start_date?: string | null;

  @IsOptional()
  @IsDateString()
  deadline?: string | null;

  @IsOptional()
  @IsBoolean()
  is_rnd?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  rnd_category?: string | null;
}
