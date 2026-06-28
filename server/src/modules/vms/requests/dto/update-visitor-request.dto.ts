import { Exclude, Expose, Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional, PartialType } from './swagger-compat';
import { CreateVisitorRequestDto } from './create-visitor-request.dto';

const INDIAN_MOBILE_REGEX = /^(?:\+91[-\s]?)?[6-9]\d{9}$/;

@Exclude()
export class UpdateVisitorRequestDto extends PartialType(CreateVisitorRequestDto) {
  @ApiPropertyOptional({ maxLength: 255 })
  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  declare visitorName: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @Expose()
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(INDIAN_MOBILE_REGEX)
  declare mobileNumber: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  declare address: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @Expose()
  @IsOptional()
  @IsUUID()
  declare hostEmployeeId: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  declare purpose: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @Expose()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  declare expectedArrival: Date;

  @ApiPropertyOptional({ maxLength: 1000 })
  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  declare remarks: string;
}
