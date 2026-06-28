import { Exclude, Expose, Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { VisitStatus } from '../../common/enums/visit-status.enum';
import { ApiPropertyOptional } from './swagger-compat';

export enum VisitSortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export enum VisitSortBy {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  SCHEDULED_AT = 'scheduledAt',
  CHECK_IN_TIME = 'checkInTime',
  CHECK_OUT_TIME = 'checkOutTime',
  PURPOSE = 'purpose',
  STATUS = 'status',
}

@Exclude()
export class SearchVisitDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Expose()
  @IsOptional()
  @Transform(({ value }) => {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  })
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Expose()
  @IsOptional()
  @Transform(({ value }) => {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
  })
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ format: 'uuid' })
  @Expose()
  @IsOptional()
  @IsUUID()
  visitorId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @Expose()
  @IsOptional()
  @IsUUID()
  hostEmployeeId?: string;

  @ApiPropertyOptional({ enum: VisitStatus })
  @Expose()
  @IsOptional()
  @IsEnum(VisitStatus)
  status?: VisitStatus;

  @ApiPropertyOptional({ format: 'date-time' })
  @Expose()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ format: 'date-time' })
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

  @ApiPropertyOptional({ enum: VisitSortBy, default: VisitSortBy.CREATED_AT })
  @Expose()
  @IsOptional()
  @IsEnum(VisitSortBy)
  sortBy?: VisitSortBy = VisitSortBy.CREATED_AT;

  @ApiPropertyOptional({ enum: VisitSortOrder, default: VisitSortOrder.DESC })
  @Expose()
  @IsOptional()
  @IsEnum(VisitSortOrder)
  sortOrder?: VisitSortOrder = VisitSortOrder.DESC;
}

