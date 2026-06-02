import { IsEnum, IsOptional } from 'class-validator';
import { request_status_enum , request_type_enum} from '@prisma/client';

export class RequestFilterDto {
  @IsOptional()
  @IsEnum(request_status_enum)
  status?: request_status_enum;

  @IsOptional()
  @IsEnum(request_type_enum)
  type?: request_type_enum;
}