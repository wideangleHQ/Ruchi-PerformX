import { Exclude, Expose } from 'class-transformer';
import { VisitStatus } from '../../common/enums/visit-status.enum';
import { ApiProperty, ApiPropertyOptional } from './swagger-compat';

@Exclude()
export class VisitHistoryResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiPropertyOptional()
  @Expose()
  visitCode?: string | null;

  @ApiProperty({ enum: VisitStatus })
  @Expose()
  status!: VisitStatus;

  @ApiProperty()
  @Expose()
  purpose!: string;

  @ApiPropertyOptional()
  @Expose()
  meetingDetails?: string | null;

  @ApiProperty()
  @Expose()
  hostEmployeeId!: string;

  @ApiProperty()
  @Expose()
  hostEmployeeName!: string;

  @ApiPropertyOptional()
  @Expose()
  checkInTime?: Date | null;

  @ApiPropertyOptional()
  @Expose()
  checkOutTime?: Date | null;

  @ApiPropertyOptional()
  @Expose()
  scheduledAt?: Date | null;

  @ApiProperty()
  @Expose()
  createdAt!: Date;

  @ApiProperty()
  @Expose()
  branchId!: string;
}
