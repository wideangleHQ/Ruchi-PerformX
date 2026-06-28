import { Exclude, Expose, Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from './swagger-compat';
import { VisitorRequestStatus } from './search-visitor-request.dto';

@Exclude()
export class VisitorRequestResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  @IsUUID()
  id!: string;

  @ApiProperty({ maxLength: 255 })
  @Expose()
  @IsString()
  @MaxLength(255)
  visitorName!: string;

  @ApiProperty({ example: '9876543210' })
  @Expose()
  @IsString()
  mobileNumber!: string;

  @ApiProperty({ maxLength: 500 })
  @Expose()
  @IsString()
  @MaxLength(500)
  address!: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  @IsUUID()
  hostEmployeeId!: string;

  @ApiProperty({ maxLength: 255 })
  @Expose()
  @IsString()
  @MaxLength(255)
  purpose!: string;

  @ApiProperty({ format: 'date-time' })
  @Expose()
  @Type(() => Date)
  @IsDate()
  expectedArrival!: Date;

  @ApiPropertyOptional({ maxLength: 1000 })
  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remarks?: string | null | undefined;

  @ApiProperty({ enum: VisitorRequestStatus })
  @Expose()
  @IsEnum(VisitorRequestStatus)
  status!: VisitorRequestStatus;

  @ApiProperty({ format: 'date-time' })
  @Expose()
  @Type(() => Date)
  @IsDate()
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  @Expose()
  @Type(() => Date)
  @IsDate()
  updatedAt!: Date;

  @ApiPropertyOptional({ format: 'uuid' })
  @Expose()
  @IsOptional()
  @IsUUID()
  reviewedById?: string | null;

  @ApiPropertyOptional({ format: 'date-time' })
  @Expose()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  reviewedAt?: Date | null;

  @ApiPropertyOptional({ maxLength: 255 })
  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  rejectionReason?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @Expose()
  @IsOptional()
  @IsUUID()
  generatedVisitId?: string | null;
}
