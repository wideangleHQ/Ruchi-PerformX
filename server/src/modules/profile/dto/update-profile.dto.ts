import { IsString, IsEmail, IsOptional, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  fullName?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(50)
  username?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  mobileNumber?: string;
}

