import { Exclude, Expose, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from './swagger-compat';

export enum VisitorRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

@Exclude()
export class SearchVisitorRequestDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Expose()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Expose()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ enum: VisitorRequestStatus })
  @Expose()
  @IsOptional()
  @IsEnum(VisitorRequestStatus)
  status?: VisitorRequestStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @Expose()
  @IsOptional()
  @IsUUID()
  hostEmployeeId?: string;

  @ApiPropertyOptional({ format: 'date' })
  @Expose()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ format: 'date' })
  @Expose()
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;
}
