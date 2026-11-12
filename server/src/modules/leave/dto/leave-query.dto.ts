import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { leave_status_enum } from '@prisma/client';

/** Filters for `/leave/applications/mine`, `/leave/applications/pending` and `/leave/others/applications`. */
export class LeaveApplicationFilterDto {
  @IsOptional()
  @IsEnum(leave_status_enum)
  status?: leave_status_enum;

  @IsOptional()
  @IsUUID()
  leave_type_id?: string;

  @IsOptional()
  @IsUUID()
  department_id?: string;

  @IsOptional()
  @IsUUID()
  user_id?: string;

  /** Free-text search by name, email, username or personnel number */
  @IsOptional()
  @Type(() => String)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

/**
 * Window for `/leave/calendar`. Both ends default to the current month in the
 * service, which is what the month grid asks for on first paint.
 */
export class LeaveCalendarQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

/** Filters for the HR and Administrative balance grid. */
export class LeaveBalanceFilterDto {
  @IsOptional()
  @IsUUID()
  user_id?: string;

  @IsOptional()
  @IsUUID()
  leave_type_id?: string;

  @IsOptional()
  @IsUUID()
  department_id?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  /** Free-text search by name, email, username or personnel number */
  @IsOptional()
  @Type(() => String)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;
}

/** Period for the payroll report and its export. Defaults to the current month. */
export class MonthlyReportQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}
