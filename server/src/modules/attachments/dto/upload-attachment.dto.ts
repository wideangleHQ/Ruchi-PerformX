import {
  IsUUID,
  IsNotEmpty,
} from 'class-validator';

export class UploadAttachmentDto {
  @IsUUID()
  @IsNotEmpty()
  taskId!: string;
}