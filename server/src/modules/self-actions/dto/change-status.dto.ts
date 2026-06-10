import { IsEnum, IsNotEmpty } from 'class-validator';
import { self_action_status_enum } from '@prisma/client';

export class ChangeStatusDto {
  @IsEnum(self_action_status_enum)
  @IsNotEmpty()
  status!: self_action_status_enum;
}
