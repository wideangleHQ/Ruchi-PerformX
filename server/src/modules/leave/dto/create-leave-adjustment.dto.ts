import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { leave_adjustment_type_enum } from '@prisma/client';

export class CreateLeaveAdjustmentDto {
  @IsUUID()
  @IsNotEmpty()
  user_id!: string;

  @IsUUID()
  @IsNotEmpty()
  leave_type_id!: string;

  @Type(() => Number)
  @Min(2000)
  @Max(2100)
  year!: number;

  @IsEnum(leave_adjustment_type_enum)
  adjustment_type!: leave_adjustment_type_enum;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-999)
  @Max(999)
  amount!: number;

  @IsOptional()
  @IsDateString()
  effective_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

