import {
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { vendor_status_enum } from '@prisma/client';

/**
 * The vendor master record as a caller may supply it.
 *
 * `vendorCode` is absent on purpose: it is generated server side and never
 * settable, so a client that sends one gets a 400 from
 * `forbidNonWhitelisted` rather than a vendor book with two `VEN-0001`s.
 *
 * No contract dates either. `vendor_contracts` is the source of truth and a
 * denormalised copy here goes stale within a month.
 */
export class CreateVendorDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  vendorType?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactPerson?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  alternateContact?: string;

  @IsOptional()
  @IsString()
  companyAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  website?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  /** Defaults to PROSPECT. A vendor onboarded already signed can start ACTIVE. */
  @IsOptional()
  @IsEnum(vendor_status_enum)
  status?: vendor_status_enum;

  /** The accountable RUCHI employee. Required: a vendor with no owner is nobody's problem. */
  @IsNotEmpty()
  @IsUUID()
  ownerId!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  secondaryOwnerId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];
}
