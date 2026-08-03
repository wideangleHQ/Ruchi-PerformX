// src/modules/hod-score/dto/hod-score-query.dto.ts

import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { MIN_SCORE_YEAR } from '../hod-score.constants';

/**
 * Period selector shared by every HOD score endpoint.
 *
 * Both fields are optional; when omitted the service falls back to the
 * current month in the business timezone. Values are validated here and
 * re-validated in the service before reaching SQL.
 */
export class HodScoreQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_SCORE_YEAR)
  @Max(2100)
  year?: number;
}
