import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { task_status_enum } from '@prisma/client';

/**
 * The four task statuses a vendor may ask for. `TRANSITIONS` in
 * task-lifecycle.service.ts is the authority on which of them is legal from the
 * current status; this list is the trust boundary in front of it, so a vendor
 * cannot even name CLOSED or REVIEWED in a request body.
 */
export const VENDOR_TASK_STATUSES = [
  task_status_enum.ACCEPTED,
  task_status_enum.IN_PROGRESS,
  task_status_enum.COMPLETED,
  task_status_enum.REJECTED,
] as const;

export class VendorTaskStatusDto {
  @IsIn(VENDOR_TASK_STATUSES as unknown as string[])
  status!: (typeof VENDOR_TASK_STATUSES)[number];

  /** Required by the lifecycle table for REJECTED, ignored otherwise. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class VendorTaskFilterDto {
  @IsOptional()
  @IsIn(Object.values(task_status_enum))
  status?: task_status_enum;
}

export class SubmitDeliverableDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;
}

export class VendorMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content!: string;
}
