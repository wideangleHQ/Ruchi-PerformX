import { Exclude, Expose, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from './swagger-compat';
import { VisitStatus } from '../../common/enums/visit-status.enum';

@Exclude()
export class VisitResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  visitorId!: string;

  @ApiProperty()
  @Expose()
  hostEmployeeId!: string;

  @ApiProperty({ enum: VisitStatus })
  @Expose()
  status!: VisitStatus;

  @ApiProperty()
  @Expose()
  purpose!: string;

  @ApiPropertyOptional()
  @Expose()
  meetingDetails?: string | null;

  @ApiPropertyOptional({ format: 'date-time' })
  @Expose()
  scheduledAt?: Date | null;

  @ApiPropertyOptional({ format: 'date-time' })
  @Expose()
  checkInTime?: Date | null;

  @ApiPropertyOptional({ format: 'date-time' })
  @Expose()
  checkOutTime?: Date | null;

  @ApiPropertyOptional({ format: 'date-time' })
  @Expose()
  createdAt?: Date | null;

  @ApiPropertyOptional({ format: 'date-time' })
  @Expose()
  updatedAt?: Date | null;
}

