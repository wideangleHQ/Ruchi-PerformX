import { project_health_enum, project_status_enum } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PROJECT_PRIORITIES } from './create-project.dto';

/** Query strings arrive as text, so `?mine=true` has to become a boolean. */
const toBoolean = ({ value }: { value: unknown }): boolean =>
  value === true || value === 'true';

/**
 * The project directory filter set. Every field is optional and they compose:
 * `?mine=true&overdue=true` is the caller's own late projects.
 *
 * `dateFrom` and `dateTo` bound `created_at`, matching the self actions filter.
 * Deadline windows have their own two flags below, because "created in Q1" and
 * "due this week" are different questions and folding them into one range
 * makes both unusable.
 */
export class ProjectFilterDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @IsOptional()
  @IsEnum(project_status_enum)
  status?: project_status_enum;

  @IsOptional()
  @IsEnum(project_health_enum)
  health?: project_health_enum;

  @IsOptional()
  @IsIn(PROJECT_PRIORITIES)
  priority?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  leadId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  /** Projects the caller is a member of, in any project role. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  mine?: boolean;

  /** Deadline in the past and the project is still open. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  overdue?: boolean;

  /** Deadline inside the next seven days. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  dueThisWeek?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
