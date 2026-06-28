import { Exclude, Expose } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Exclude()
export class RecentVisitorDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  fullName!: string;

  @ApiPropertyOptional()
  @Expose()
  mobileNumber?: string;

  @ApiProperty()
  @Expose()
  purpose!: string;

  @ApiPropertyOptional()
  @Expose()
  checkInTime?: Date;

  @ApiProperty()
  @Expose()
  status!: string;
}
