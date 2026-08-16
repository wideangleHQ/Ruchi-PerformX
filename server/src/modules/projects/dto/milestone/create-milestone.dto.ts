import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * `status` is a plain varchar in the schema rather than an enum, so this list
 * is the only thing keeping it to three values. `DONE` is what stops a
 * milestone counting as overdue.
 */
export const MILESTONE_STATUSES = ['PLANNED', 'IN_PROGRESS', 'DONE'] as const;

/** Body of `POST /projects/:id/milestones`. Lead and Co-Lead only. */
export class CreateMilestoneDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  owner_id?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  due_date?: string;

  @IsOptional()
  @IsIn(MILESTONE_STATUSES)
  status?: string;
}
