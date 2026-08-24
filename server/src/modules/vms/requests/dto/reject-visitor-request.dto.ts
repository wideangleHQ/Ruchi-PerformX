import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * The reason travels to the requester on the rejected request, so it is worth
 * collecting. Optional: the service falls back to a generic line, which is what
 * it always used before this DTO existed.
 */
export class RejectVisitorRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
