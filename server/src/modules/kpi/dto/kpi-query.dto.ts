import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { kpi_scope_enum, kpi_status_enum } from '@prisma/client';

/**
 * Query of `GET /kpis`. Every filter is optional; what comes back without one
 * is whatever the caller's department scope allows.
 */
export class KpiFilterDto {
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
