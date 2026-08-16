import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * `projects.priority` is a VarChar rather than an enum, so the allowed set
 * lives here and is validated at the boundary. Widening it means editing one
 * line instead of writing a migration.
 */
export const PROJECT_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

/**
 * Creation payload. `project_code` is absent on purpose: the service generates
 * it and nothing outside the service may set it.
 *
 * Only title, objective, and description are required. Everything the spec
 * calls an expandable section, milestones and KPIs included, belongs to the
 * detail page and its own endpoints, so creation stays a short form.
 */
export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsString()
  @IsNotEmpty()
  objective!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

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

  /** Defaults to the caller. A project always has exactly one lead. */
  @IsOptional()
  @IsUUID()
  lead_id?: string;

  @IsOptional()
  @IsUUID()
  co_lead_id?: string;

  /** The owning department for the directory filter, not a membership limit. */
  @IsOptional()
  @IsUUID()
  department_id?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsBoolean()
  is_rnd?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  rnd_category?: string;
}
