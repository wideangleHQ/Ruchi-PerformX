import { IsIn, IsUUID } from 'class-validator';

/**
 * The three levels, weakest first. The order is meaningful:
 * `VendorScopeService.assertAccess` compares by index, so a level appended in
 * the wrong position silently promotes everyone who holds it.
 */
export const VENDOR_ACCESS_LEVELS = [
  'VENDOR_VIEWER',
  'VENDOR_MANAGER',
  'VENDOR_ADMIN',
] as const;

export type VendorAccessLevel = (typeof VENDOR_ACCESS_LEVELS)[number];

/**
 * Grants one employee access to the Vendor Management module.
 *
 * `access_level` is a plain varchar in the database with no check constraint,
 * so this `@IsIn` is the only thing keeping a typo out of the column. A value
 * outside the list would read back as a level `assertAccess` cannot rank,
 * which denies everything but shows the module tab as if it were granted.
 */
export class GrantVendorAccessDto {
  @IsUUID()
  userId!: string;

  @IsIn(VENDOR_ACCESS_LEVELS)
  accessLevel!: VendorAccessLevel;
}
