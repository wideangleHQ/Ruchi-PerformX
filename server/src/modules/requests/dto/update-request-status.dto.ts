import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateRequestStatusDto {
  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @IsOptional()
  @IsUUID()
  newAssigneeId?: string;
}
