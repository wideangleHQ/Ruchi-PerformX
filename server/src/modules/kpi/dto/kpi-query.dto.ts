import { Type } from 'class-transformer';
import {
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
import { kpi_scope_enum, kpi_status_enum, role_enum } from '@prisma/client';

/**
 * Query of `GET /kpis`. Every filter is optional; what comes back without one
 * is whatever the caller's department scope allows, minus DELETED KPIs, which
 * only come back when `status=DELETED` asks for them.
 */
export class KpiFilterDto {
  /** `own` is the caller's KPIs, `others` is everyone else's they may see. */
  @IsOptional()
  @IsIn(['own', 'others'])
  view?: 'own' | 'others';

  @IsOptional()
  @IsEnum(kpi_scope_enum)
  scope?: kpi_scope_enum;

  @IsOptional()
  @IsEnum(kpi_status_enum)
  status?: kpi_status_enum;

  @IsOptional()
  @IsUUID()
  owner_user_id?: string;

  @IsOptional()
  @IsUUID()
  department_id?: string;

  @IsOptional()
  @IsUUID()
  project_id?: string;

  /** Any KPI whose period overlaps this month. 1-12, with `year`. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year?: number;

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

/**
 * Query of `GET /kpis/allocation/:userId`: the KPI period the new weight would
 * sit in. Anything allocating that overlaps it counts.
 */
export class AllocationQueryDto {
  @IsDateString()
  period_start!: string;

  @IsDateString()
  period_end!: string;
}

/**
 * Query of `GET /kpis/scores`, the View Score tab. It searches the existing
 * `performance_scores` rows; nothing here computes a score.
 *
 * No period means every period. The spec rules out guessing one, so a missing
 * month is not quietly read as the current one the way `PsScoreQueryDto` does.
 */
export class ScoreSearchDto {
  /** Full name, username, or email, case-insensitive. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsUUID()
  department_id?: string;

  @IsOptional()
  @IsUUID()
  user_id?: string;

  @IsOptional()
  @IsEnum(role_enum)
  role?: role_enum;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year?: number;

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

/**
 * Query of the PS Score routes. The period is a month rather than a KPI cycle
 * because a person can carry a monthly and an annual KPI at once; anything
 * whose cycle covers the month is in scope.
 *
 * Defaults to the current month when neither is given.
 */
export class PsScoreQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year?: number;
}

/** Query of `GET /kpis/units`. Empty `q` returns the head of the library. */
export class UnitSearchDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  q?: string;
}
