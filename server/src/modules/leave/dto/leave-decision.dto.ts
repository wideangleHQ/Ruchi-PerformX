import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Approval. The remark is optional; nobody asks why a leave was granted. */
export class ApproveLeaveDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remark?: string;
}

/**
 * Rejection. The remark is required and goes into the notification body, because
 * "your leave was rejected" with no reason sends the employee to ask in person,
 * which is the thing this module exists to stop.
 */
export class RejectLeaveDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  remark!: string;
}

/** HR cancellation of an approved leave. No reason, no cancellation. */
export class HrCancelLeaveDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  cancellation_reason!: string;
}
