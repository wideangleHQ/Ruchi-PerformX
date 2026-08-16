import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export const CONTRACT_STATUSES = [
  'DRAFT',
  'ACTIVE',
  'EXPIRED',
  'TERMINATED',
  'RENEWED',
] as const;

/**
 * A contract carries commercial terms, so nothing on this DTO may ever reach
 * the external portal. `contract_number` is unique per vendor; a repeat comes
 * back as a 409 rather than a Prisma error.
 */
export class CreateVendorContractDto {
  @IsUUID()
  vendor_id!: string;

  @IsString()
  @MaxLength(100)
  contract_number!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contract_type?: string;

  @IsDateString()
  start_date!: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsDateString()
  renewal_date?: string;

  @IsOptional()
  @IsIn(CONTRACT_STATUSES)
  status?: (typeof CONTRACT_STATUSES)[number];

  @IsOptional()
  @IsString()
  description?: string;
}

/** The vendor a contract belongs to is fixed. Everything else is a renewal. */
export class UpdateVendorContractDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  contract_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contract_type?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsDateString()
  renewal_date?: string;

  @IsOptional()
  @IsIn(CONTRACT_STATUSES)
  status?: (typeof CONTRACT_STATUSES)[number];

  @IsOptional()
  @IsString()
  description?: string;
}
