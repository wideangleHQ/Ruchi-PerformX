// src/modules/self-actions/dto/update-self-action.dto.ts

import {
  IsString,
  IsOptional,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateSelfActionDto {
  @IsString()
  @IsOptional()
  @MaxLength(150)
  @Transform(({ value }) => value?.trim())
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  description?: string;

  @IsDateString()
  @IsOptional()
  actionDate?: string;
}