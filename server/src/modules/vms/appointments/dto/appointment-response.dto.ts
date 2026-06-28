import { ApiProperty } from '@nestjs/swagger';
import { VisitStatus } from '@prisma/client';

export class AppointmentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  visitorId!: string;

  @ApiProperty()
  branchId!: string;

  @ApiProperty()
  hostEmployeeId!: string;

  @ApiProperty({ enum: VisitStatus })
  status!: VisitStatus;

  @ApiProperty({ required: false })
  visitCode?: string | null;

  @ApiProperty({ required: false })
  appointmentReference?: string | null;

  @ApiProperty()
  purpose!: string;

  @ApiProperty({ required: false })
  meetingDetails?: string | null;

  @ApiProperty({ required: false })
  scheduledAt?: Date | null;

  @ApiProperty()
  createdById!: string;

  @ApiProperty()
  createdAt!: Date;
}

export class PaginationMetaDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  totalItems!: number;

  @ApiProperty()
  totalPages!: number;

  @ApiProperty()
  hasNextPage!: boolean;

  @ApiProperty()
  hasPreviousPage!: boolean;
}

export class PaginatedAppointmentResponseDto {
  @ApiProperty({ type: [AppointmentResponseDto] })
  data!: AppointmentResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
