import { ApiProperty } from '@nestjs/swagger';

export class AuditResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  user_id!: string;

  @ApiProperty()
  action!: string;

  @ApiProperty()
  entity!: string;

  @ApiProperty()
  entity_id!: string;

  @ApiProperty({ required: false })
  old_value?: string;

  @ApiProperty({ required: false })
  new_value?: string;

  @ApiProperty({ required: false })
  ip_address?: string;

  @ApiProperty()
  created_at!: Date;
}

export class PaginationMetaDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  totalItems!: number;

  @ApiProperty()
  totalPages!: number;

  @ApiProperty()
  hasNextPage!: boolean;

  @ApiProperty()
  hasPreviousPage!: boolean;
}

export class PaginatedAuditResponseDto {
  @ApiProperty({ type: [AuditResponseDto] })
  data!: AuditResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
