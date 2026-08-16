import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePollDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  question!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(255, { each: true })
  options!: string[];

  @IsDateString()
  closesAt!: string;
}
