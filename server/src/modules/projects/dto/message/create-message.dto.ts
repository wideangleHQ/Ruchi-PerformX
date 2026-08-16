import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** A post to the project thread. The author comes from the JWT, never the body. */
export class CreateMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'Message content is required' })
  @MaxLength(4000)
  content!: string;
}
