import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * Four structured fields rather than one description box. Comparability across
 * a research thread is the point of the module, and a free text field would
 * lose it in the first week.
 */
export class CreateRndReportDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  category!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  product_area!: string;

  @IsString()
  @IsNotEmpty()
  findings!: string;

  @IsString()
  @IsNotEmpty()
  recommendation!: string;

  @IsOptional()
  @IsString()
  supporting_data?: string;

  /** An R&D project, when the report came out of one. Projects are optional here. */
  @IsOptional()
  @IsUUID()
  project_id?: string;
}
