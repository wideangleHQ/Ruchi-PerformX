// src/modules/comments/dto/create-comment.dto.ts

import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty({ message: 'Content is required' })
  @MaxLength(1000)
  content!: string;

  @IsUUID()
  @IsNotEmpty({ message: 'Task ID is required' })
  taskId!: string;

  @IsOptional()
  @IsUUID()
  parentCommentId?: string;
}
