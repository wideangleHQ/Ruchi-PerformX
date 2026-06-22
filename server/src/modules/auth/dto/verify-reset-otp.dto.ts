import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';

export class VerifyResetOtpDto {
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{6}$/)
  otp!: string;
}
