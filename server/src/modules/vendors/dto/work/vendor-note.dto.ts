import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * `is_internal` defaults to true in the schema and is left true when omitted
 * here, so a note written without thinking about it lands in the RUCHI-only
 * thread rather than in front of the vendor. The safe direction is the default
 * one; sharing is the deliberate act.
 */
export class CreateVendorNoteDto {
  @IsUUID()
  vendor_id!: string;

  @IsString()
  content!: string;

  @IsOptional()
  @IsBoolean()
  is_internal?: boolean;
}
