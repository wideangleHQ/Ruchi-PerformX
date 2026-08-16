import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

/** Mirrors the task priority vocabulary so one badge component renders both. */
export const CHECKLIST_PRIORITIES = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
] as const;

/** Body of `POST /projects/:id/checklist`. Lead and Co-Lead only. */
export class CreateChecklistItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(CHECKLIST_PRIORITIES)
  priority?: string;

  @IsOptional()
  @IsUUID()
  assigned_to_id?: string;

  @IsOptional()
  @IsDateString()
  due_date?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;
}
