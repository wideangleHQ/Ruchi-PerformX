import { asset_type_enum } from '@prisma/client';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAssetDto {
  @IsNotEmpty()
  @IsIn(Object.values(asset_type_enum))
  assetType!: asset_type_enum;

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  username?: string;

  /**
   * The plaintext secret. Encrypted before it reaches the database and never
   * echoed back by any endpoint except `GET /assets/:id/reveal`.
   */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  secret?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
