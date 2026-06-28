import { Exclude, Expose } from 'class-transformer';
import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

@Exclude()
export class GeneratePassDto {
  @ApiProperty({ description: 'ID of the visit to generate a pass for', format: 'uuid' })
  @Expose()
  @IsNotEmpty()
  @IsUUID()
  visitId!: string;
}
