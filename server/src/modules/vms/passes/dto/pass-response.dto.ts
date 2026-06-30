import { Exclude, Expose, Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VisitorImageResponseDto } from '../../visitors/dto/visitor-response.dto';

@Exclude()
class PassVisitorDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  fullName!: string;
  
  @ApiPropertyOptional()
  @Expose()
  mobileNumber?: string;

  @ApiPropertyOptional()
  @Expose()
  email?: string;

  @ApiPropertyOptional()
  @Expose()
  company?: string;

  @ApiPropertyOptional()
  @Expose()
  address?: string;

  @ApiPropertyOptional({ type: () => [VisitorImageResponseDto] })
  @Expose()
  @Type(() => VisitorImageResponseDto)
  images?: VisitorImageResponseDto[];

  @ApiPropertyOptional({ type: () => String })
  @Expose()
  @Transform(({ obj }) => {
    if (obj.images && obj.images.length > 0) {
      return obj.images[0].fileUrl;
    }
    return null;
  })
  profileImage?: string | null;
}

@Exclude()
class PassEmployeeDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  full_name!: string;
}

@Exclude()
export class PassResponseDto {
  @ApiProperty()
  @Expose()
  passNumber!: string;

  @ApiProperty()
  @Expose()
  @Type(() => PassVisitorDto)
  visitor!: PassVisitorDto;

  @ApiProperty()
  @Expose()
  @Type(() => PassEmployeeDto)
  employee!: PassEmployeeDto;

  @ApiProperty()
  @Expose()
  visitId!: string;

  @ApiPropertyOptional()
  @Expose()
  checkInTime?: Date;

  @ApiProperty()
  @Expose()
  status!: string;

  @ApiPropertyOptional()
  @Expose()
  purpose?: string;

  @ApiPropertyOptional({ default: 1 })
  @Expose()
  peopleCount!: number;
}
