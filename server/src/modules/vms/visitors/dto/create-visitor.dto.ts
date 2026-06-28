import { Exclude, Expose, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Matches,
  IsNotEmpty,
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

  @ApiProperty({ example: 'PerformX Inc.', maxLength: 255 })
  @Expose()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  companyName!: string;

  @ApiProperty({ example: '123 Business St, Tech Park', maxLength: 1000 })
  @Expose()
  @IsString()
  @IsNotEmpty()
  address!: string;

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
