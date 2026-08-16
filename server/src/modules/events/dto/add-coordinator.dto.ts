import { IsNotEmpty, IsUUID } from 'class-validator';

export class AddCoordinatorDto {
  @IsNotEmpty()
  @IsUUID()
  userId!: string;
}
