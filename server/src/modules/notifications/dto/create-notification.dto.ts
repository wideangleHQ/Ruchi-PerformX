import {
  IsString,
  IsUUID,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { notification_type_enum } from '@prisma/client';

export class CreateNotificationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message!: string;

  @IsUUID()
  recipientId!: string;

  @IsEnum(notification_type_enum)
  @IsOptional()
  type?: notification_type_enum;
}