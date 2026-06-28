import { ApiProperty } from '@nestjs/swagger';

export class EmployeeStatsDto {
  @ApiProperty({ description: 'Employee ID' })
  employeeId!: string;

  @ApiProperty({ description: 'Employee name' })
  employeeName!: string;

  @ApiProperty({ description: 'Department name' })
  departmentName!: string;

  @ApiProperty({ description: 'Total visits hosted' })
  totalVisits!: number;

  @ApiProperty({ description: 'Completed visits' })
  completedVisits!: number;

  @ApiProperty({ description: 'Pending visits' })
  pendingVisits!: number;

  @ApiProperty({ description: 'Cancelled visits' })
  cancelledVisits!: number;

  @ApiProperty({ description: 'Average visit duration (minutes)' })
  avgVisitDuration?: number;

  @ApiProperty({ description: 'Most frequent visitor' })
  topVisitor?: string;

  @ApiProperty({ description: 'Most common visit purpose' })
  topPurpose?: string;
}

export class EmployeeVisitDto {
  @ApiProperty({ description: 'Visit ID' })
  visitId!: string;

  @ApiProperty({ description: 'Visitor name' })
  visitorName!: string;

  @ApiProperty({ description: 'Visit purpose' })
  purpose!: string;

  @ApiProperty({ description: 'Visit status' })
  status!: string;

  @ApiProperty({ description: 'Check-in time' })
  checkInTime?: Date;

  @ApiProperty({ description: 'Check-out time' })
  checkOutTime?: Date;

  @ApiProperty({ description: 'Visit duration (minutes)' })
  duration?: number;
}

export class EmployeeReportDto {
  @ApiProperty({ description: 'Employee statistics', type: EmployeeStatsDto })
  employee!: EmployeeStatsDto;

  @ApiProperty({ description: 'Recent visits', type: [EmployeeVisitDto] })
  recentVisits!: EmployeeVisitDto[];

  @ApiProperty({ description: 'Monthly visit trends' })
  monthlyTrends!: Record<string, number>;

  @ApiProperty({ description: 'Purpose-wise breakdown' })
  purposeBreakdown!: Record<string, number>;
}