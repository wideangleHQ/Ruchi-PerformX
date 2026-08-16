import { IsEnum } from 'class-validator';
import { vendor_status_enum } from '@prisma/client';

/**
 * The only way a vendor leaves circulation. There is no DELETE on a vendor,
 * ever: historical assignments, documents and contracts have to survive the
 * relationship ending, so `EXPIRED` and `TERMINATED` carry the lifecycle.
 */
export class UpdateVendorStatusDto {
  @IsEnum(vendor_status_enum)
  status!: vendor_status_enum;
}
