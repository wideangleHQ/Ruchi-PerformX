import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { task_priority_enum } from '@prisma/client';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(task_priority_enum)
  priority?: task_priority_enum;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;
}