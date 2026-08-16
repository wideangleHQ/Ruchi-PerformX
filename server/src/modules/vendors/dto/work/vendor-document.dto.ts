import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * The Supabase prefix vendor documents live under.
 *
 * The bytes are uploaded through the attachments module, which owns the only
 * Supabase client in the API. This DTO carries the resulting object path, and
 * the service rejects one that does not start here, so a vendor document row
 * can never be pointed at another module's storage and read through this
 * table's much wider audience.
 */
export const VENDOR_DOCUMENT_PREFIX = 'vendors/documents/';

/**
 * No status field. `ACTIVE` / `EXPIRING_SOON` / `EXPIRED` is a function of
 * `expiry_date` and today, so a stored copy is wrong the morning after it is
 * written. It is computed on read by `documentExpiryStatus`.
 */
export class CreateVendorDocumentDto {
  @IsUUID()
  vendor_id!: string;

  @IsOptional()
  @IsUUID()
  contract_id?: string;

  @IsIn(['LEGAL', 'OPERATIONAL'])
  category!: 'LEGAL' | 'OPERATIONAL';

  @IsString()
  @MaxLength(100)
  document_type!: string;

  @IsString()
  @MaxLength(255)
  document_name!: string;

  @IsOptional()
  @IsDateString()
  issue_date?: string;

  @IsOptional()
  @IsDateString()
  expiry_date?: string;

  @IsString()
  @MaxLength(500)
  file_url!: string;

  @IsString()
  @MaxLength(500)
  storage_path!: string;
}
