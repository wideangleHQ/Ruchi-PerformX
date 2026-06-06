import { ArrayNotEmpty, ArrayUnique, IsArray, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { task_priority_enum } from '@prisma/client';

export class CreateTaskDto {
  @IsNotEmpty()
  @IsString()
  title!: string;

  @IsNotEmpty()
  @IsString()
  description!: string;

  @IsNotEmpty()
  @IsEnum(task_priority_enum)
  priority!: task_priority_enum;

  @IsNotEmpty()
  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  departmentIds?: string[];

  @IsOptional()
  @IsUUID()
  parentTaskId?: string;
}
