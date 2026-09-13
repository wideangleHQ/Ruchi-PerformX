import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { KpiContributionDto } from './create-kpi.dto';

/**
 * Everything written against a KPI that is already approved: the actual, the
 * allocation of a shared outcome, and a revised target.
 *
 * They share a file because they share a rule. None of them overwrite anything:
 * an update is appended, an allocation replaces its own set, and a revision
 * keeps the value it replaced.
 */

/**
 * Body of `POST /kpis/:id/updates`. The owner enters what actually happened and
 * the server works out the percentage. Nobody types "80% complete" by hand.
 *
 * Which field applies is decided by the KPI's mode, and the service rejects the
 * others: `actual_value` for QUANTITATIVE, `binary_done` for BINARY, `rating`
 * for RATING. MILESTONE progress is a tick on a stage, not an update here.
 */
export class RecordKpiUpdateDto {
  @IsOptional()
  @IsNumber()
  actual_value?: number;

  @IsOptional()
  @IsBoolean()
  binary_done?: boolean;

  /** 1 to the KPI's `max_rating`. Reviewer only, never the owner. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  rating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;

  /** Required when the KPI was created with `evidence_required`. */
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  evidence_url?: string;
}

/**
 * Body of `PUT /kpis/:id/contributions`. The whole allocation, not a delta: the
 * set sent replaces the set stored, so a member dropped from the list loses
 * their share rather than keeping a stale one.
 *
 * An empty array clears the allocation, which returns a shared KPI to counting
 * in full for whoever it is read for.
 */
export class SetKpiContributionsDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => KpiContributionDto)
  contributions!: KpiContributionDto[];
}

/**
 * Body of `POST /kpis/:id/revisions`. A mid-cycle target or weight change,
 * recorded as a new version with its own effective date.
 *
 * At least one of `new_target` or `new_weight` has to be present, which the
 * service checks. The original is kept on the revision row, so both remain
 * visible in the KPI's history and the change is attributable.
 */
export class CreateKpiRevisionDto {
  @IsOptional()
  @IsNumber()
  new_target?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(100)
  new_weight?: number;

  @IsDateString()
  effective_from!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
