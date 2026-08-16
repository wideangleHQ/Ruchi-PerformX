import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

/**
 * Ratings are 1 to 5 and are not combined into a composite score. The four
 * sub-scores are recorded for the reviewer's own reading; `rating` is the one
 * the performance view averages. Weighting them is a client decision, not an
 * engineering one.
 */
export class CreateVendorReviewDto {
  @IsUUID()
  vendor_id!: string;

  @IsDateString()
  review_date!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  quality?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  timeliness?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  communication?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  reliability?: number;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  action_required?: string;
}
