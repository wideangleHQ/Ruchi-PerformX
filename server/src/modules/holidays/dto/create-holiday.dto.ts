// src/modules/holidays/dto/create-holiday.dto.ts

import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateHolidayDto {
  @IsString()
  @IsNotEmpty({ message: 'Holiday name is required' })
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  // Date only, no time. `<input type="date">` already produces this, and the
  // column is a Postgres `date`, so anything with a clock on it is a timezone
  // bug waiting for the first holiday near midnight.
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date!: string;

  @IsOptional()
  @IsBoolean()
  isOptional?: boolean;

  // Omitted means the common tier, which applies company-wide. Set means the
  // department-wise tier. Only HR and ADMIN may omit it.
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
