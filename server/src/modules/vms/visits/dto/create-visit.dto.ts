import { Exclude, Expose, Transform } from 'class-transformer';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from './swagger-compat';

@Exclude()
export class CreateVisitDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  @IsUUID()
  visitorId!: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  @IsUUID()
  hostEmployeeId!: string;

  @ApiProperty({ maxLength: 255 })
  @Expose()
  @IsString()
  @MaxLength(255)
  purpose!: string;

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

