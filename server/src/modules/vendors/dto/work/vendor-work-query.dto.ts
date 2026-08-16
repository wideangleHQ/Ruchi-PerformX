import { IsEnum, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { deliverable_status_enum } from '@prisma/client';

/**
 * Filter for the assignment, contract and review lists.
 *
 * `vendor_id` is optional because the Assignments and Contracts screens are
 * both company-wide lists as well as vendor profile tabs. Omitting it returns
 * every vendor's rows, which is safe here: every route carrying this DTO is
 * already behind a vendor management access check.
 */
export class VendorWorkQueryDto {
  @IsOptional()
  @IsUUID()
  vendor_id?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

/** Deliverable list filter. `status` is the enum, not free text. */
export class VendorDeliverableQueryDto {
  @IsOptional()
  @IsUUID()
  vendor_id?: string;

  @IsOptional()
  @IsEnum(deliverable_status_enum)
  status?: deliverable_status_enum;
}

/** Document list filter. Expiry status is derived on read, so it is not one. */
export class VendorDocumentQueryDto {
  @IsOptional()
  @IsUUID()
  vendor_id?: string;

  @IsOptional()
  @IsIn(['LEGAL', 'OPERATIONAL'])
  category?: 'LEGAL' | 'OPERATIONAL';
}

/**
 * Note list filter.
 *
 * `vendor_id` is required here and optional everywhere else because a note is
 * a conversation about one vendor and a cross-vendor note feed has no screen.
 * Omitting `thread` returns both threads, which only an internal caller ever
 * sees: the shared thread has its own service method rather than a value of
 * this field.
 */
export class VendorNoteQueryDto {
  @IsUUID()
  vendor_id!: string;

  @IsOptional()
  @IsIn(['internal', 'shared'])
  thread?: 'internal' | 'shared';
}
