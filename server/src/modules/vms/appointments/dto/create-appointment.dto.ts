import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateAppointmentDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  visitorId!: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  branchId!: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  hostEmployeeId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  purpose!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  meetingDetails?: string;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  scheduledAt!: string;
}
