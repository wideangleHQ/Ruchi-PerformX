import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyAccessDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}
