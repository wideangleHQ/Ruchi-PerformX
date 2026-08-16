import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

/**
 * Body of `POST /projects/:id/success-criteria`. One criterion per call, so
 * the closure review can check them off individually rather than reading one
 * paragraph and guessing.
 */
export class CreateSuccessCriterionDto {
  @IsString()
  @IsNotEmpty()
  criterion!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;
}
