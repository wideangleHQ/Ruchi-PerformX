import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Categories are a configurable table rather than an enum, so HR/EA/MD add one here. */
export class CreateVendorCategoryDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name!: string;
}
