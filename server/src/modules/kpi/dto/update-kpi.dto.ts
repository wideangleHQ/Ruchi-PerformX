import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  kpi_direction_enum,
  kpi_period_enum,
  kpi_status_enum,
} from '@prisma/client';
import { KpiScoringConfigDto } from './create-kpi.dto';

/**
 * Body of `PATCH /kpis/:id`, the definition of a KPI its author or owner may
 * change while it is not DELETED.
 *
 * `mode`, `scope`, the owner, the department, and every approval and audit
 * column are absent on purpose, and `forbidNonWhitelisted` turns an attempt to
 * send one into a 400. Changing what a KPI measures or whose it is produces a
 * different KPI. A target or weight change on a published KPI also writes a
 * `kpi_revisions` row, so the original survives.
 */
export class UpdateKpiDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  unit_label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  unit_symbol?: string;

  @IsOptional()
  @IsNumber()
  target_value?: number;

  @IsOptional()
  @IsNumber()
  baseline_value?: number;

  @IsOptional()
  @IsEnum(kpi_direction_enum)
  direction?: kpi_direction_enum;

  @IsOptional()
  @ValidateNested()
  @Type(() => KpiScoringConfigDto)
  scoring_config?: KpiScoringConfigDto;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(100)
  weight?: number;

  @IsOptional()
  @IsEnum(kpi_period_enum)
  period?: kpi_period_enum;

  @IsOptional()
  @IsDateString()
  period_start?: string;

  @IsOptional()
  @IsDateString()
  period_end?: string;

  @IsOptional()
  @IsBoolean()
  evidence_required?: boolean;

  @IsOptional()
  @IsBoolean()
  review_required?: boolean;
}

/**
 * Body of `PATCH /kpis/:id/status`. Submitting a draft, sending a pending KPI
 * back, and deleting, with `kpi-lifecycle.ts` deciding which moves exist. Quick
 * approve has its own route, `POST /kpis/:id/approve`.
 *
 * `reason` is required for DELETED, because a KPI that disappears from a
 * period's PS Score without an explanation is exactly the thing the framework's
 * fairness section is about.
 */
export class ChangeKpiStatusDto {
  @IsEnum(kpi_status_enum)
  status!: kpi_status_enum;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason?: string;
}
