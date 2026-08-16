// src/modules/scoring/dto/score-trend-query.dto.ts

import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ScoreQueryDto } from './score-query.dto';

/**
 * A trend window: `months` periods ending at the month named by the parent DTO.
 *
 * The 24 month ceiling exists because the window is expanded into one OR clause
 * per month, and because nothing in the product charts more than that.
 */
export class ScoreTrendQueryDto extends ScoreQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  months?: number;
}
