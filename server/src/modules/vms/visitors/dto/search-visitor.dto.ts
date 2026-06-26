import { Exclude, Expose, Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MaxLength,
  Matches,
} from 'class-validator';
import { VisitorStatus } from '../../common/enums/visitor-status.enum';
import { ApiPropertyOptional } from './swagger-compat';

export enum VisitorSortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export enum VisitorSortBy {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  FULL_NAME = 'fullName',
  EMAIL = 'email',
  MOBILE_NUMBER = 'mobileNumber',
  STATUS = 'status',
}

@Exclude()
export class SearchVisitorDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Expose()
  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  })
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
  })
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ maxLength: 255 })
  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @Expose()
  @IsOptional()
  @IsString()
  @Matches(/^(?:\+91[-\s]?)?[6-9]\d{9}$/)
  mobileNumber?: string;

  @ApiPropertyOptional({ format: 'email' })
  @Expose()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ enum: VisitorStatus })
  @Expose()
  @IsOptional()
  @IsEnum(VisitorStatus)
  status?: VisitorStatus;

  @ApiPropertyOptional({ enum: VisitorSortBy, default: VisitorSortBy.CREATED_AT })
  @Expose()
  @IsOptional()
  @IsEnum(VisitorSortBy)
  sortBy?: VisitorSortBy = VisitorSortBy.CREATED_AT;

  @ApiPropertyOptional({ enum: VisitorSortOrder, default: VisitorSortOrder.DESC })
  @Expose()
  @IsOptional()
  @IsEnum(VisitorSortOrder)
  sortOrder?: VisitorSortOrder = VisitorSortOrder.DESC;
}
