import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateLeaveApplicationDto {
  @IsUUID()
  leave_type_id!: string;

  /** `YYYY-MM-DD`. Interpreted in UTC, same as the stored `@db.Date` column. */
  @IsDateString()
  start_date!: string;

  /** `YYYY-MM-DD`, inclusive. May equal `start_date` for a single day. */
  @IsDateString()
  end_date!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;

  /**
   * Proof for leave types with `requires_proof`. A URL, not a file: the schema
   * stores `attachment_url` and `task_attachments` has no leave column, so the
   * client uploads through the existing attachment flow and sends the link.
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  attachment_url?: string;
}
