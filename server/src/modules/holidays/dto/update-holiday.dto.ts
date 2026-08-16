// src/modules/holidays/dto/update-holiday.dto.ts

import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

// No `departmentId`. Moving a holiday between the common and department-wise
// tiers changes who it applies to and which unique index guards it, so it is a
// delete plus a create rather than an edit. `forbidNonWhitelisted` turns an
// attempt into a 400 that says so.
export class UpdateHolidayDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Holiday name cannot be empty' })
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @IsOptional()
  @IsBoolean()
  isOptional?: boolean;
}
