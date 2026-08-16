import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsUUID, ValidateNested } from 'class-validator';

export class HandoverItemDto {
  @IsUUID()
  assetId!: string;

  @IsUUID()
  toUserId!: string;
}

/**
 * One offboarding submit. HR picks a new owner per row on the leaver's asset
 * list and sends the whole list at once, which is why this is an array rather
 * than one endpoint call per asset.
 */
export class CreateHandoverDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => HandoverItemDto)
  items!: HandoverItemDto[];
}
