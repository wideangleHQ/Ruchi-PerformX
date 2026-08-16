import { IsString, IsEmail, IsOptional, IsDateString, MaxLength, MinLength } from 'class-validator';

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

  // Nullable on purpose. Sending null clears it, which is how somebody who does
  // not want a birthday card on the company dashboard opts out. Never required.
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string | null;
}

