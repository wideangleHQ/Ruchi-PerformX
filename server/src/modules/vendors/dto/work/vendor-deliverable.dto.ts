import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { deliverable_status_enum } from '@prisma/client';

export class CreateVendorDeliverableDto {
  @IsUUID()
  vendor_id!: string;

  @IsString()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  project_id?: string;

  /** The accountable RUCHI employee, never the vendor's portal user. */
  @IsUUID()
  owner_id!: string;

  @IsOptional()
  @IsDateString()
  due_date?: string;

  @IsOptional()
  @IsEnum(deliverable_status_enum)
  status?: deliverable_status_enum;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  @IsOptional()
  @IsString()
  remarks?: string;
}

/**
 * `submitted_date` is here because on-time percentage is measured from it
 * against `due_date`. Leaving it unset on an accepted deliverable does not
 * count as late, it counts as unmeasurable, and the metric skips the row.
 */
export class UpdateVendorDeliverableDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  project_id?: string;

  @IsOptional()
  @IsUUID()
  owner_id?: string;

  @IsOptional()
  @IsDateString()
  due_date?: string;

  @IsOptional()
  @IsDateString()
  submitted_date?: string;

  @IsOptional()
  @IsEnum(deliverable_status_enum)
  status?: deliverable_status_enum;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  @IsOptional()
  @IsString()
  remarks?: string;
}
