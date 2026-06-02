import {
  IsOptional,
  IsUUID,
} from 'class-validator';

export class AttachmentFilterDto {
  @IsOptional()
  @IsUUID()
  taskId?: string;
}