import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateSelfActionCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  content!: string;

  @IsOptional()
  @IsUUID()
  parentCommentId?: string;
}
