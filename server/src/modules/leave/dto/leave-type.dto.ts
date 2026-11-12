import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateLeaveTypeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  /** Days granted per financial year. Fractional values allowed. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(365)
  annual_entitlement?: number;

  @IsOptional()
  @IsBoolean()
  is_paid?: boolean;

  @IsOptional()
  @IsBoolean()
  carry_forward?: boolean;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(365)
  max_carry_forward?: number;

  @IsOptional()
  @IsBoolean()
  requires_proof?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

/**
 * Every field optional. Changing `annual_entitlement` does not restate existing
 * balances; it applies to rows created after the change, which is the reason
 * `PATCH /leave/balances/:id` exists.
 */
export class UpdateLeaveTypeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(365)
  annual_entitlement?: number;

  @IsOptional()
  @IsBoolean()
  is_paid?: boolean;

  @IsOptional()
  @IsBoolean()
  carry_forward?: boolean;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(365)
  max_carry_forward?: number;

  @IsOptional()
  @IsBoolean()
  requires_proof?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
