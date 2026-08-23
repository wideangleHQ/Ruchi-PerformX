// src/modules/holidays/dto/update-holiday.dto.ts

import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

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

  // Moves the holiday between tiers. A UUID sets the department-wise tier, an
  // explicit null returns it to the common tier, and omitting it leaves the
  // tier alone. `@IsOptional()` skips null as well as undefined, which is what
  // makes the null case expressible.
  //
  // The service checks the caller against both the old tier and the new one,
  // so a HOD cannot move a holiday out of their department or up to
  // company-wide.
  @IsOptional()
  @IsUUID()
  departmentId?: string | null;
}
