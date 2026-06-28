import { Exclude, Expose, Type, Transform } from 'class-transformer';
import { VisitStatus } from '../../common/enums/visit-status.enum';
import { VisitorImageSource } from '../../common/enums/visitor-image-source.enum';
import { VisitorImageType } from '../../common/enums/visitor-image-type.enum';
import { VisitorStatus } from '../../common/enums/visitor-status.enum';
import { ApiProperty, ApiPropertyOptional } from './swagger-compat';

@Exclude()
export class VisitorImageResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  visitorId!: string;

  @ApiPropertyOptional()
  @Expose()
  visitId?: string | null;

  @ApiProperty({ enum: VisitorImageType })
  @Expose()
  imageType!: VisitorImageType;

  @ApiProperty({ enum: VisitorImageSource })
  @Expose()
  imageSource!: VisitorImageSource;

  @ApiPropertyOptional()
  @Expose()
  fileName?: string | null;

  @ApiProperty()
  @Expose()
  fileUrl!: string;

  @ApiPropertyOptional()
  @Expose()
  storagePath?: string | null;

  @ApiPropertyOptional()
  @Expose()
  mimeType?: string | null;

  @ApiPropertyOptional()
  @Expose()
  fileSizeKb?: number | null;

  @ApiProperty()
  @Expose()
  isPrimary!: boolean;

  @ApiProperty()
  @Expose()
  isFaceTemplate!: boolean;

  @ApiPropertyOptional()
  @Expose()
  faceEmbeddingVersion?: string | null;

  @ApiPropertyOptional()
  @Expose()
  faceMatchScore?: string | null;

  @ApiProperty()
  @Expose()
  createdAt!: Date;

  @ApiProperty()
  @Expose()
  updatedAt!: Date;
}

@Exclude()
export class VisitResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  visitorId!: string;

  @ApiProperty()
  @Expose()
  branchId!: string;

  @ApiProperty()
  @Expose()
  hostEmployeeId!: string;

  @ApiProperty({ enum: VisitStatus })
  @Expose()
  status!: VisitStatus;

  @ApiPropertyOptional()
  @Expose()
  visitCode?: string | null;

  @ApiPropertyOptional()
  @Expose()
  appointmentReference?: string | null;

  @ApiProperty()
  @Expose()
  purpose!: string;

  @ApiPropertyOptional()
  @Expose()
  meetingDetails?: string | null;

  @ApiPropertyOptional()
  @Expose()
  scheduledAt?: Date | null;

  @ApiPropertyOptional()
  @Expose()
  checkInTime?: Date | null;

  @ApiPropertyOptional()
  @Expose()
  checkOutTime?: Date | null;

  @ApiPropertyOptional()
  @Expose()
  qrPassIssuedAt?: Date | null;

  @ApiPropertyOptional()
  @Expose()
  qrPassExpiresAt?: Date | null;

  @ApiPropertyOptional()
  @Expose()
  faceVerifiedAt?: Date | null;

  @ApiPropertyOptional()
  @Expose()
  faceMatchScore?: string | null;

  @ApiPropertyOptional()
  @Expose()
  aadhaarVerifiedAt?: Date | null;

  @ApiProperty()
  @Expose()
  createdAt!: Date;

  @ApiProperty()
  @Expose()
  updatedAt!: Date;

  @ApiPropertyOptional({ type: () => [VisitorImageResponseDto] })
  @Expose()
  @Type(() => VisitorImageResponseDto)
  images?: VisitorImageResponseDto[];
}

@Exclude()
export class VisitorResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  firstName!: string;

  @ApiPropertyOptional()
  @Expose()
  lastName?: string | null;

  @ApiProperty()
  @Expose()
  fullName!: string;

  @ApiPropertyOptional()
  @Expose()
  email?: string | null;

  @ApiPropertyOptional()
  @Expose()
  mobileNumber?: string | null;

  @ApiProperty()
  @Expose()
  companyName!: string;

  @ApiProperty()
  @Expose()
  address!: string;

  @ApiProperty({ enum: VisitorStatus })
  @Expose()
  status!: VisitorStatus;

  @ApiPropertyOptional()
  @Expose()
  blacklistReason?: string | null;

  @ApiPropertyOptional()
  @Expose()
  blacklistedAt?: Date | null;

  @ApiProperty()
  @Expose()
  faceRecognitionConsent!: boolean;

  @ApiPropertyOptional()
  @Expose()
  notes?: string | null;

  @ApiProperty()
  @Expose()
  createdAt!: Date;

  @ApiProperty()
  @Expose()
  updatedAt!: Date;

  @ApiPropertyOptional()
  @Expose()
  deletedAt?: Date | null;

  @ApiPropertyOptional({ type: () => [VisitResponseDto] })
  @Expose()
  @Type(() => VisitResponseDto)
  visits?: VisitResponseDto[];

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
