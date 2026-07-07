import { Exclude, Expose, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Exclude()
export class RecentVisitorPersonDto {
  @ApiProperty()
  @Expose()
  fullName!: string;

  @ApiPropertyOptional()
  @Expose()
  companyName?: string;
}

@Exclude()
export class RecentVisitorHostDto {
  @ApiProperty()
  @Expose()
  fullName!: string;
}

@Exclude()
export class RecentVisitorDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  purpose!: string;

  @ApiPropertyOptional()
  @Expose()
  checkedInAt?: Date | null;

  @ApiPropertyOptional()
  @Expose()
  checkedOutAt?: Date | null;

  @ApiProperty()
  @Expose()
  status!: string;

  @ApiProperty()
  @Expose()
  updatedAt!: Date;

  @ApiProperty({ type: () => RecentVisitorPersonDto })
  @Expose()
  @Type(() => RecentVisitorPersonDto)
  visitor!: RecentVisitorPersonDto;

  @ApiPropertyOptional({ type: () => RecentVisitorHostDto })
  @Expose()
  @Type(() => RecentVisitorHostDto)
  hostEmployee?: RecentVisitorHostDto | null;
}
