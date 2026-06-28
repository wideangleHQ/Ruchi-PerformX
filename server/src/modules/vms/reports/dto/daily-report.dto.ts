import { ApiProperty } from '@nestjs/swagger';

export class DailyStatsDto {
  @ApiProperty({ description: 'Total visitors for the day' })
  totalVisitors!: number;

  @ApiProperty({ description: 'Number of checked-in visitors' })
  checkedIn!: number;

  @ApiProperty({ description: 'Number of checked-out visitors' })
  checkedOut!: number;

  @ApiProperty({ description: 'Number of pending visits' })
  pending!: number;

  @ApiProperty({ description: 'Number of cancelled visits' })
  cancelled!: number;

  @ApiProperty({ description: 'Number of no-show visits' })
  noShow!: number;

  @ApiProperty({ description: 'Peak hour of the day' })
  peakHour?: string;

  @ApiProperty({ description: 'Most visited department' })
  topDepartment?: string;
}

export class HourlyBreakdownDto {
  @ApiProperty({ description: 'Hour (0-23)' })
  hour!: number;

  @ApiProperty({ description: 'Number of visits in this hour' })
  count!: number;
}

export class DailyReportDto {
  @ApiProperty({ description: 'Report date' })
  date!: string;

  @ApiProperty({ description: 'Daily statistics', type: DailyStatsDto })
  stats!: DailyStatsDto;

  @ApiProperty({ description: 'Hourly breakdown', type: [HourlyBreakdownDto] })
  hourlyBreakdown!: HourlyBreakdownDto[];

  @ApiProperty({ description: 'Department-wise visitor count' })
  departmentStats!: Record<string, number>;
}