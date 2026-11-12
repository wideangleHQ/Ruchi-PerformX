import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * HR's manual correction or administrative adjustment of leave balances.
 * Supports decimal precision up to 2 decimal places (e.g. 11.5, 8.25, 8.63).
 */
export class UpdateLeaveBalanceDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999)
  entitled?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999)
  used?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999)
  carried_over?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999)
  compensated_to_key_date?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
