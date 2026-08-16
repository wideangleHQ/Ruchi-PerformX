import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { KPI_STATUSES } from './create-kpi.dto';

/** Body of `PATCH /projects/:id/kpis/:kpiId`. Lead and Co-Lead only. */
export class UpdateKpiDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  metric?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  target?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  actual?: string;

  @IsOptional()
  @IsIn(KPI_STATUSES)
  status?: string;
}
