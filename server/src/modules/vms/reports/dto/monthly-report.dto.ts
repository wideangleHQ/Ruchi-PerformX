import { ApiProperty } from '@nestjs/swagger';
import { DailyStatsDto } from './daily-report.dto';

export class MonthlyStatsDto {
  @ApiProperty({ description: 'Total visitors for the month' })
  totalVisitors!: number;

  @ApiProperty({ description: 'Total completed visits' })
  completedVisits!: number;

  @ApiProperty({ description: 'Total cancelled visits' })
  cancelledVisits!: number;

  @ApiProperty({ description: 'Average daily visitors' })
  averageDailyVisitors!: number;

  @ApiProperty({ description: 'Peak visitor day' })
  peakDay?: string;

  @ApiProperty({ description: 'Peak visitor count' })
  peakCount?: number;

  @ApiProperty({ description: 'Most active host employee' })
  topHost?: string;

  @ApiProperty({ description: 'Most visited department' })
  topDepartment?: string;
}

export class DailyTotalDto {
  @ApiProperty({ description: 'Date' })
  date!: string;

  @ApiProperty({ description: 'Total visitors for the day' })
  totalVisitors!: number;

  @ApiProperty({ description: 'Completed visits' })
  completedVisits!: number;
}

export class MonthlyReportDto {
  @ApiProperty({ description: 'Report month (YYYY-MM)' })
  month!: string;

  @ApiProperty({ description: 'Monthly statistics', type: MonthlyStatsDto })
  stats!: MonthlyStatsDto;

  @ApiProperty({ description: 'Daily totals', type: [DailyTotalDto] })
  dailyTotals!: DailyTotalDto[];

  @ApiProperty({ description: 'Weekly comparison' })
  weeklyComparison!: Record<string, number>;

  @ApiProperty({ description: 'Department-wise monthly totals' })
  departmentStats!: Record<string, number>;

  @ApiProperty({ description: 'Host employee statistics' })
  hostStats!: Record<string, number>;
}