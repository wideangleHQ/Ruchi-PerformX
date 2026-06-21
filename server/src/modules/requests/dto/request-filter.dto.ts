import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { request_status_enum } from '@prisma/client';

const REQUEST_TYPES = [
  'BUDGET_APPROVAL',
  'TRANSPORT_SUPPORT',
  'CROSS_DEPT_ASSISTANCE',
  'RESOURCE_REQUEST',
  'OTHER',
  'TASK_REASSIGNMENT',
] as const;

export class RequestFilterDto {
  @IsOptional()
  @IsEnum(request_status_enum)
  status?: request_status_enum;

  @IsOptional()
  @IsIn(REQUEST_TYPES)
  type?: typeof REQUEST_TYPES[number];

  @IsOptional()
  taskId?: string;
}
