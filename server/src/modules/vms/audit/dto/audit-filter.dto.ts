import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export enum AuditEvent {
  VISITOR_CREATED = 'Visitor Created',
  VISITOR_UPDATED = 'Visitor Updated',
  VISITOR_DELETED = 'Visitor Deleted',
  VISITOR_RESTORED = 'Visitor Restored',
  VISIT_CREATED = 'Visit Created',
  VISITOR_CHECKED_IN = 'Visitor Checked In',
  VISITOR_CHECKED_OUT = 'Visitor Checked Out',
  VISIT_CANCELLED = 'Visit Cancelled',
  REQUEST_CREATED = 'Request Created',
  REQUEST_APPROVED = 'Request Approved',
  REQUEST_REJECTED = 'Request Rejected',
  PASS_GENERATED = 'Pass Generated',
  PASS_REPRINTED = 'Pass Reprinted',
}

export class AuditFilterDto {
  @ApiPropertyOptional({ enum: AuditEvent })
  @IsOptional()
  @IsEnum(AuditEvent)
  action?: AuditEvent;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  performedBy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;
}
