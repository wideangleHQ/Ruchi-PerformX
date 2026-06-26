import { ApiPropertyOptional, PartialType } from './swagger-compat';
import { Exclude, Expose, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Matches,
} from 'class-validator';
import { CreateVisitorDto } from './create-visitor.dto';

@Exclude()
export class UpdateVisitorDto extends PartialType(CreateVisitorDto) {
  @ApiPropertyOptional({ maxLength: 100 })
  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  declare firstName: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  declare lastName: string;

  @ApiPropertyOptional({ format: 'email' })
  @Expose()
  @IsOptional()
  @IsEmail()
  declare email: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @Expose()
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^(?:\+91[-\s]?)?[6-9]\d{9}$/)
  declare mobileNumber: string;

  @ApiPropertyOptional({ example: '9123456789' })
  @Expose()
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^(?:\+91[-\s]?)?[6-9]\d{9}$/)
  declare alternateMobileNumber: string;

  @ApiPropertyOptional({ example: '1234', minLength: 4, maxLength: 4 })
  @Expose()
  @IsOptional()
  @IsString()
  @Length(4, 4)
  declare aadhaarLast4: string;

  @ApiPropertyOptional({ default: false })
  @Expose()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  declare faceRecognitionConsent: boolean;

  @ApiPropertyOptional({ maxLength: 1000 })
  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  declare notes: string;
}
