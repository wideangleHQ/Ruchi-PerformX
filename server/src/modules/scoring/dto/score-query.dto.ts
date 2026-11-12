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

export class ManagementScoresQueryDto extends ScoreQueryDto {
  @IsOptional()
  department_id?: string;

  @IsOptional()
  role?: string;

  @IsOptional()
  q?: string;

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

  @IsOptional()
  @Type(() => Number)
  minAt?: number;

  @IsOptional()
  @Type(() => Number)
  maxAt?: number;

  @IsOptional()
  @Type(() => Number)
  minPs?: number;

  @IsOptional()
  @Type(() => Number)
  maxPs?: number;
}
