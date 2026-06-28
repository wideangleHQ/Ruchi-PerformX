import { Exclude, Expose, Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from './swagger-compat';

const INDIAN_MOBILE_REGEX = /^(?:\+91[-\s]?)?[6-9]\d{9}$/;

@Exclude()
export class CreateVisitorRequestDto {
  @ApiProperty({ maxLength: 255 })
  @Expose()
  @IsString()
  @MaxLength(255)
  visitorName!: string;

  @ApiProperty({ example: '9876543210' })
  @Expose()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(INDIAN_MOBILE_REGEX)
  mobileNumber!: string;

  @ApiProperty({ maxLength: 500 })
  @Expose()
  @IsString()
  @MaxLength(500)
  address!: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  @IsUUID()
  hostEmployeeId!: string;

  @ApiProperty({ maxLength: 255 })
  @Expose()
  @IsString()
  @MaxLength(255)
  purpose!: string;

  @ApiProperty({ format: 'date-time' })
  @Expose()
  @Type(() => Date)
  @IsDate()
  expectedArrival!: Date;

  @ApiPropertyOptional({ maxLength: 1000 })
  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remarks?: string;
}
