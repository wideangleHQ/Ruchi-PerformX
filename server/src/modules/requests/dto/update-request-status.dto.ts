import { IsOptional, IsString } from 'class-validator';

export class UpdateRequestStatusDto {
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}