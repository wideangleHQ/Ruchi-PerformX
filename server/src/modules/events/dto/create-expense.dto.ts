import { IsDecimal, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Posted as multipart/form-data alongside an optional `receipt` file, so every
 * field arrives as a string. That suits `amount`, which must stay a string:
 * see the note in `create-event.dto.ts`.
 */
export class CreateExpenseDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  item!: string;

  @IsNotEmpty()
  @IsDecimal({ decimal_digits: '0,2' })
  amount!: string;
}
