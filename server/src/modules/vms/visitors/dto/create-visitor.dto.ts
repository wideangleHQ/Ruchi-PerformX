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
import { ApiProperty, ApiPropertyOptional } from './swagger-compat';

@Exclude()
export class CreateVisitorDto {
  @ApiProperty({ maxLength: 100 })
  @Expose()
  @IsString()
  @MaxLength(100)
  firstName!: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ format: 'email' })
  @Expose()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: '9876543210' })
  @Expose()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^(?:\+91[-\s]?)?[6-9]\d{9}$/)
  mobileNumber!: string;

  @ApiPropertyOptional({ example: '9123456789' })
  @Expose()
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^(?:\+91[-\s]?)?[6-9]\d{9}$/)
  alternateMobileNumber?: string;

  @ApiPropertyOptional({ example: '1234', minLength: 4, maxLength: 4 })
  @Expose()
  @IsOptional()
  @IsString()
  @Length(4, 4)
  aadhaarLast4?: string;

  @ApiPropertyOptional({ default: false })
  @Expose()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  faceRecognitionConsent?: boolean;

  @ApiPropertyOptional({ maxLength: 1000 })
  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
