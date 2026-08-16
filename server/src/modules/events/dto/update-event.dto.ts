import {
  IsDateString,
  IsDecimal,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * `events.status` is a VarChar(20) rather than an enum, so this list is the
 * only thing keeping it to three values. Widen it here and nowhere else.
 */
export const EVENT_STATUSES = ['PLANNED', 'COMPLETED', 'CANCELLED'] as const;

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsDateString()
  eventDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  venue?: string;

  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' })
  budgetEstimated?: string;

  @IsOptional()
  @IsIn(EVENT_STATUSES)
  status?: (typeof EVENT_STATUSES)[number];
}
