import { ApiProperty } from '@nestjs/swagger';

export class VisitorInfoDto {
  @ApiProperty({ description: 'Visitor ID' })
  visitorId!: string;

  @ApiProperty({ description: 'Full name' })
  fullName!: string;

  @ApiProperty({ description: 'Email address' })
  email?: string;

  @ApiProperty({ description: 'Mobile number' })
  mobileNumber?: string;

  @ApiProperty({ description: 'Total visits' })
  totalVisits!: number;

  @ApiProperty({ description: 'First visit date' })
  firstVisit!: Date;

  @ApiProperty({ description: 'Last visit date' })
  lastVisit!: Date;

  @ApiProperty({ description: 'Most visited department' })
  frequentDepartment?: string;

  @ApiProperty({ description: 'Most frequent host' })
  frequentHost?: string;
}

export class VisitTimelineDto {
  @ApiProperty({ description: 'Visit ID' })
  visitId!: string;

  @ApiProperty({ description: 'Visit date' })
  visitDate!: Date;

  @ApiProperty({ description: 'Host employee name' })
  hostEmployeeName!: string;

  @ApiProperty({ description: 'Department name' })
  departmentName!: string;

  @ApiProperty({ description: 'Visit purpose' })
  purpose!: string;

  @ApiProperty({ description: 'Visit status' })
  status!: string;

  @ApiProperty({ description: 'Scheduled time' })
  scheduledAt?: Date;

  @ApiProperty({ description: 'Check-in time' })
  checkInTime?: Date;

  @ApiProperty({ description: 'Check-out time' })
  checkOutTime?: Date;

  @ApiProperty({ description: 'Visit duration (minutes)' })
  duration?: number;

  @ApiProperty({ description: 'Visit code' })
  visitCode?: string;
}

export class VisitorHistoryDto {
  @ApiProperty({ description: 'Visitor information', type: VisitorInfoDto })
  visitor!: VisitorInfoDto;

  @ApiProperty({ description: 'Visit timeline', type: [VisitTimelineDto] })
  visits!: VisitTimelineDto[];

  @ApiProperty({ description: 'Department-wise visit count' })
  departmentStats!: Record<string, number>;

  @ApiProperty({ description: 'Purpose-wise visit count' })
  purposeStats!: Record<string, number>;

  @ApiProperty({ description: 'Monthly visit pattern' })
  monthlyPattern!: Record<string, number>;

  @ApiProperty({ description: 'Pagination info' })
  pagination!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}