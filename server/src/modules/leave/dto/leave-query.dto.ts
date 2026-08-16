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

/** Filters for `/leave/applications/mine` and `/leave/applications/pending`. */
export class LeaveApplicationFilterDto {
  @IsOptional()
  @IsEnum(leave_status_enum)
  status?: leave_status_enum;

  @IsOptional()
  @IsUUID()
  leave_type_id?: string;

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

/** Filters for the HR balance grid. */
export class LeaveBalanceFilterDto {
  @IsOptional()
  @IsUUID()
  user_id?: string;

  @IsOptional()
  @IsUUID()
  leave_type_id?: string;

  /** Financial year, named by its starting calendar year. Defaults to current. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
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
