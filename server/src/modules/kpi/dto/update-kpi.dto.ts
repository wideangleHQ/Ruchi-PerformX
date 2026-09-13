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
 * Body of `PATCH /kpis/:id`, accepted while the KPI is still a DRAFT.
 *
 * `mode`, `scope`, and the owner are absent on purpose. Changing what a KPI
 * measures or whose it is produces a different KPI, and the milestones and
 * contributions already attached would no longer mean anything. Create a new
 * one instead.
 *
 * After approval this endpoint is closed and a target change goes through
 * `POST /kpis/:id/revisions`, which keeps the original.
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
 * Body of `PATCH /kpis/:id/status`. One endpoint for every lifecycle move,
 * with `kpi-lifecycle.ts` deciding which are legal and who may make them.
 *
 * `reason` is required for CANCELLED, because a KPI that disappears from a
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
