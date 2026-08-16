import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * The entity kinds an assignment can point at.
 *
 * These strings are the same ones `VendorScopeService.vendorFilter` matches
 * on, so a typo here is a portal query that silently returns nothing. That is
 * why the field is validated rather than taken as free text.
 */
export const ASSIGNMENT_ENTITY_TYPES = [
  'task',
  'project',
  'deliverable',
  'service',
] as const;

export const ASSIGNMENT_STATUSES = [
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
] as const;

/**
 * Creating one of these grants an external vendor sight of the entity named,
 * because `vendor_assignments` is also the portal's allowlist. Adding a row is
 * a permission change, not only a work record.
 */
export class CreateVendorAssignmentDto {
  @IsUUID()
  vendor_id!: string;

  @IsIn(ASSIGNMENT_ENTITY_TYPES)
  entity_type!: (typeof ASSIGNMENT_ENTITY_TYPES)[number];

  @IsOptional()
  @IsUUID()
  entity_id?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsIn(ASSIGNMENT_STATUSES)
  status?: (typeof ASSIGNMENT_STATUSES)[number];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  priority?: string;
}

/**
 * The vendor and the entity are not updatable. Pointing an existing row at a
 * different vendor moves an access grant sideways with no trace of who held it
 * before; delete the row and create the one you meant.
 */
export class UpdateVendorAssignmentDto {
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsIn(ASSIGNMENT_STATUSES)
  status?: (typeof ASSIGNMENT_STATUSES)[number];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  priority?: string;
}
