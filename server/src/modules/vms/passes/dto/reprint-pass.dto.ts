import { Exclude, Expose } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

@Exclude()
export class ReprintPassDto {
  @ApiPropertyOptional({ description: 'Reason for reprinting the pass', maxLength: 255 })
  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
