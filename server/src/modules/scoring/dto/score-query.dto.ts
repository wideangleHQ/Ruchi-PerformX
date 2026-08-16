// src/modules/scoring/dto/score-query.dto.ts

import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { MIN_SCORE_YEAR } from '../../hod-score/hod-score.constants';

/**
 * Period selector shared by every scoring endpoint.
 *
 * Both fields are optional; when omitted the controller falls back to the
 * current month. `MIN_SCORE_YEAR` is reused from the HOD score module so the
 * two scoring APIs reject the same range of years.
 */
export class ScoreQueryDto {
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
