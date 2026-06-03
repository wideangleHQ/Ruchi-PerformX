import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateTransferDto {
  @IsNotEmpty()
  @IsUUID()
  taskId!: string;

  @IsNotEmpty()
  @IsUUID()
  toDepartmentId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}