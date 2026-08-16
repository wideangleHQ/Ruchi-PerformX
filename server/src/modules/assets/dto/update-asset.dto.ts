import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * `assetType` is deliberately absent. Changing a PASSWORD into a DOCUMENT would
 * leave a ciphertext with no way to read it and a file with no owner, so a
 * different type means a different record.
 */
export class UpdateAssetDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  username?: string;

  /** Re-encrypted under the current key. Send an empty string to clear it. */
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
