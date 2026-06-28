import { Exclude, Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

@Exclude()
export class DashboardSummaryDto {
  @ApiProperty()
  @Expose()
  todaysVisitors!: number;

  @ApiProperty()
  @Expose()
  visitorsInside!: number;

  @ApiProperty()
  @Expose()
  pendingRequests!: number;

  @ApiProperty()
  @Expose()
  completedVisits!: number;

  @ApiProperty()
  @Expose()
  cancelledVisits!: number;
}
