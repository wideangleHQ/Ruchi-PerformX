// src/modules/hod-score/dto/hod-score-trends-query.dto.ts

import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { HodScoreQueryDto } from './hod-score-query.dto';

/**
 * Trend selector. When neither hodId nor departmentId is supplied the trend is
 * resolved for the caller (own trend for a HOD, company trend for viewers).
 *
 * Both identifiers are validated as UUIDs before any SQL runs, and access is
 * re-checked against the caller's department scope in the service.
 */
export class HodScoreTrendsQueryDto extends HodScoreQueryDto {
  @IsOptional()
  @IsUUID()
  hodId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  months?: number;
}
