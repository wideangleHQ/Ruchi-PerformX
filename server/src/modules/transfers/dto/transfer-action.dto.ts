import { IsOptional, IsString } from 'class-validator';

export class TransferActionDto {
  @IsOptional()
  @IsString()
  reason?: string;
}