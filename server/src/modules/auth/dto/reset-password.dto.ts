import { IsJWT, IsNotEmpty, IsString, Matches } from 'class-validator';

export class ResetPasswordDto {
  @IsNotEmpty()
  @IsJWT()
  resetToken!: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/)
  newPassword!: string;
}
