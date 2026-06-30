import { Exclude, Expose, Transform } from 'class-transformer';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength, IsInt, Min, Max, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from './swagger-compat';

@Exclude()
export class CreateVisitDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  @IsUUID()
  visitorId!: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  @Matches(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, { message: 'hostEmployeeId must be a UUID' })
  hostEmployeeId!: string;

  @ApiProperty({ maxLength: 255 })
  @Expose()
  @IsString()
  @MaxLength(255)
  purpose!: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 1 })
  @Expose()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  peopleCount?: number;

  @ApiPropertyOptional()
  @Expose()
  @IsOptional()
  @IsString()
  meetingDetails?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @Expose()
  @IsOptional()
  @Transform(({ value }) => value ?? new Date().toISOString())
  @IsDateString()
  scheduledAt?: string;
}

