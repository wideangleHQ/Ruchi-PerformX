import { IsDecimal, IsOptional, IsString, MaxLength } from 'class-validator';

// ponytail: corrects the item and the amount, not the receipt. Replacing a
// file means deleting the expense and logging it again, which is two clicks
// and no upload path to maintain. Add `receipt` here if anyone asks twice.
export class UpdateExpenseDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  item?: string;

  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' })
  amount?: string;
}
