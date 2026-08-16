import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** KPI status is a varchar in the schema; this list is what bounds it. */
export const KPI_STATUSES = ['ON_TRACK', 'AT_RISK', 'MISSED', 'MET'] as const;

/**
 * Body of `POST /projects/:id/kpis`. Optional per project: a project with no
 * KPI rows is normal, not incomplete.
 *
 * `target` and `actual` are strings because a KPI is as often "under 3 days" or
 * "zero escalations" as it is a number.
 */
export class CreateKpiDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  metric!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  target?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  actual?: string;

  @IsOptional()
  @IsIn(KPI_STATUSES)
  status?: string;
}
