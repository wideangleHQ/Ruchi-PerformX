import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { request_type_enum, task_priority_enum } from '@prisma/client';

export class CreateRequestDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsIn(Object.values(request_type_enum))
  type!: request_type_enum;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsIn(Object.values(task_priority_enum))
  priority?: task_priority_enum;

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
