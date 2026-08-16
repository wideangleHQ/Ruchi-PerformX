import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

/**
 * The closure report a Lead or Co-Lead files before a project can be completed.
 *
 * The three required fields are what a reader needs to understand the project
 * without opening anything else. The rest describe what the project happened to
 * produce, and plenty of projects produce none of it. Attachments are storage
 * paths in the existing Supabase bucket, uploaded before this call.
 */
export class CreateClosureReportDto {
  @IsString()
  @IsNotEmpty()
  executiveSummary!: string;

  @IsString()
  @IsNotEmpty()
  objective!: string;

  @IsString()
  @IsNotEmpty()
  finalOutcome!: string;

  @IsOptional()
  @IsString()
  achievements?: string;

  @IsOptional()
  @IsString()
  failures?: string;

  @IsOptional()
  @IsString()
  learnings?: string;

  @IsOptional()
  @IsString()
  kpiResults?: string;

  @IsOptional()
  @IsString()
  recommendations?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  attachments?: string[];
}
