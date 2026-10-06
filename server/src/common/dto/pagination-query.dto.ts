import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * `page`/`limit` shared by every paginated list endpoint. TaskFilterDto and
 * SelfActionFilterDto already declared this exact block inline; new filter
 * DTOs extend this instead of repeating it a third and fourth time.
 */
export class PaginationQueryDto {
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
}
