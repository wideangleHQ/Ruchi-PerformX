import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { CHECKLIST_PRIORITIES } from './create-checklist-item.dto';

/**
 * The full field set for `PATCH /projects/:id/checklist/:itemId`, which only
 * the Lead and Co-Lead ever get. A member's body is narrowed to
 * `MemberTickChecklistDto` by `toMemberTick` before it reaches Prisma; see the
 * note there for why that is a separate type rather than an `if` in the service.
 */
export class UpdateChecklistItemDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(CHECKLIST_PRIORITIES)
  priority?: string;

  @IsOptional()
  @IsBoolean()
  is_done?: boolean;

  @IsOptional()
  @IsUUID()
  assigned_to_id?: string;

  @IsOptional()
  @IsDateString()
  due_date?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;
}
