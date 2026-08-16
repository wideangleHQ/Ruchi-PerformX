import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsDecimal,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateEventDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsNotEmpty()
  @IsDateString()
  eventDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  venue?: string;

  // A string, not a number. Money is Decimal(12, 2) all the way to Postgres and
  // JSON has no decimal type, so parsing "12000.50" into a double here is the
  // one conversion that would put float drift back into the budget report.
  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' })
  budgetEstimated?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  coordinatorIds?: string[];
}
