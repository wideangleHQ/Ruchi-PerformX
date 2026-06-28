import { Exclude, Expose, Transform } from 'class-transformer';
import { IsDateString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from './swagger-compat';

@Exclude()
export class CheckInDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  @IsUUID()
  visitId!: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @Expose()
  @Transform(({ value }) => value ?? new Date().toISOString())
  @IsDateString()
  checkInTime?: string;
}

