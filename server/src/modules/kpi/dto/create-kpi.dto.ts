import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  kpi_direction_enum,
  kpi_mode_enum,
  kpi_period_enum,
  kpi_scope_enum,
  kpi_scoring_method_enum,
} from '@prisma/client';

/** One band of a THRESHOLD rule. Achievement at or above `min_achievement`
 * earns `score`, and the highest qualifying band wins. */
export class ThresholdBandDto {
  @IsNumber()
  @Min(0)
  min_achievement!: number;

  @IsNumber()
  @Min(0)
  @Max(200)
  score!: number;
}

/**
 * The configurable half of a scoring method, stored as JSON on the KPI.
 *
 * It is validated here rather than left as free JSON because the score it
 * produces has to be explainable a year later, and a rubric with a typo in it
 * would be indistinguishable from a rubric a department meant to write.
 */
export class KpiScoringConfigDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ThresholdBandDto)
  bands?: ThresholdBandDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  below_band_score?: number;

  /** `rating_scores[0]` is the score a rating of 1 earns. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsNumber({}, { each: true })
  rating_scores?: number[];

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(10)
  max_rating?: number;

  /** Absent means overachievement flows through to the score. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(200)
  cap_at?: number;
}

/** A weighted stage of a MILESTONE KPI. Order comes from array position. */
export class KpiMilestoneDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  weight!: number;
}

/** One person's share of a shared outcome, in percent. */
export class KpiContributionDto {
  @IsUUID()
  user_id!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  share!: number;
}

/**
 * Body of `POST /kpis`. The KPI lands in DRAFT; nothing here sets a status.
 *
 * The fields that are optional at this level are the ones a mode does not use:
 * a BINARY KPI has no unit and no direction, a RATING KPI has no target. The
 * service enforces the combinations, because `class-validator` cannot express
 * "required when mode is QUANTITATIVE" without a custom decorator per field.
 */
export class CreateKpiDto {
  @IsEnum(kpi_scope_enum)
  scope!: kpi_scope_enum;

  /** Required for INDIVIDUAL, rejected otherwise. */
  @IsOptional()
  @IsUUID()
  owner_user_id?: string;

  /** Required for DEPARTMENT. Optional on the others as the owning department. */
  @IsOptional()
  @IsUUID()
  department_id?: string;

  /** Required for PROJECT, rejected otherwise. */
  @IsOptional()
  @IsUUID()
  project_id?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(kpi_mode_enum)
  mode!: kpi_mode_enum;

  /** From the unit library or typed by the department. Frozen once created. */
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

  /** Measures improvement from a starting point rather than absolute level. */
  @IsOptional()
  @IsNumber()
  baseline_value?: number;

  @IsOptional()
  @IsEnum(kpi_direction_enum)
  direction?: kpi_direction_enum;

  @IsEnum(kpi_scoring_method_enum)
  scoring_method!: kpi_scoring_method_enum;

  @IsOptional()
  @ValidateNested()
  @Type(() => KpiScoringConfigDto)
  scoring_config?: KpiScoringConfigDto;

  @IsNumber()
  @Min(0.01)
  @Max(100)
  weight!: number;

  @IsEnum(kpi_period_enum)
  period!: kpi_period_enum;

  @IsDateString()
  period_start!: string;

  @IsDateString()
  period_end!: string;

  @IsOptional()
  @IsBoolean()
  evidence_required?: boolean;

  @IsOptional()
  @IsBoolean()
  review_required?: boolean;

  /** Required for MILESTONE, rejected otherwise. Weights must total 100. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => KpiMilestoneDto)
  milestones?: KpiMilestoneDto[];

  /** Shares of a DEPARTMENT or PROJECT KPI. Can also be set later. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => KpiContributionDto)
  contributions?: KpiContributionDto[];
}
