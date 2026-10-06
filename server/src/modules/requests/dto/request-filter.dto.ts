import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { request_status_enum } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const REQUEST_TYPES = [
  'BUDGET_APPROVAL',
  'TRANSPORT_SUPPORT',
  'CROSS_DEPT_ASSISTANCE',
  'RESOURCE_REQUEST',
  'OTHER',
  'TASK_REASSIGNMENT',
] as const;

export class RequestFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(request_status_enum)
  status?: request_status_enum;

  @IsOptional()
  @IsIn(REQUEST_TYPES)
  type?: typeof REQUEST_TYPES[number];

  @IsOptional()
  taskId?: string;
}
