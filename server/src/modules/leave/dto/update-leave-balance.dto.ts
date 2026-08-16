import { IsNumber, IsOptional, Max, Min } from 'class-validator';

/**
 * HR's manual correction. Sets the columns outright rather than incrementing,
 * because the case this exists for is "the migrated number is wrong", not
 * "adjust it by two".
 */
export class UpdateLeaveBalanceDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(999)
  entitled?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(999)
  used?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(999)
  carried_over?: number;
}
