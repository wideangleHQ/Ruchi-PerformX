import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * The submitter's correction window. `category` is not editable: moving a
 * report to another category moves it into a thread other people read, which is
 * a re-submission rather than an edit.
 */
export class UpdateRndReportDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  product_area?: string;

  @IsOptional()
  @IsString()
  findings?: string;

  @IsOptional()
  @IsString()
  recommendation?: string;

  @IsOptional()
  @IsString()
  supporting_data?: string;
}
