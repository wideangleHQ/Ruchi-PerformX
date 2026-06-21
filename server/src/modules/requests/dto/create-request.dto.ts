import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

const REQUEST_TYPES = [
  'BUDGET_APPROVAL',
  'TRANSPORT_SUPPORT',
  'CROSS_DEPT_ASSISTANCE',
  'RESOURCE_REQUEST',
  'OTHER',
  'TASK_REASSIGNMENT',
] as const;

export class CreateRequestDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsIn(REQUEST_TYPES)
  type!: typeof REQUEST_TYPES[number];

  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsOptional()
  @IsUUID()
  currentAssigneeId?: string;

  @IsOptional()
  @IsUUID()
  requestedAssigneeId?: string;

  @IsOptional()
  @IsString()
  requestReason?: string;
}
