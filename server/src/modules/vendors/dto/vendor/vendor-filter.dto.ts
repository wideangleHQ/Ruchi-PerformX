import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { vendor_status_enum } from '@prisma/client';

/** Query string of the vendor directory. Every field is a filter; none is required. */
export class VendorFilterDto {
  /** Matches name, vendor code, or contact person, case insensitively. */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(vendor_status_enum)
  status?: vendor_status_enum;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  /** Contract expiry range. Filters on the joined `vendor_contracts.end_date`. */
  @IsOptional()
  @IsDateString()
  expiringAfter?: string;

  @IsOptional()
  @IsDateString()
  expiringBefore?: string;
}
