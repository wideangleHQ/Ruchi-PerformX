import { BadRequestException } from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { UpdateChecklistItemDto } from './update-checklist-item.dto';

/**
 * Everything a MEMBER is allowed to write on a checklist item assigned to them.
 * One field, and it stays one field.
 */
export class MemberTickChecklistDto {
  @IsBoolean()
  is_done!: boolean;
}

/**
 * Narrows a checklist PATCH body to the member field set.
 *
 * The route binds `UpdateChecklistItemDto` because Nest picks the body type per
 * route, not per caller, so the whitelist has to be applied after the role is
 * known. Doing it here rather than with an `if` around each assignment is the
 * point: a member who can also set `due_date`, `priority`, `title` or
 * `assigned_to_id` can move their own goalposts, which is editing project
 * progress by hand with extra steps. Extra keys are dropped, not rejected,
 * because a UI that reuses the Lead's form is a client bug and not an attack.
 *
 * Throws `BadRequestException` when `is_done` is absent, because a member PATCH
 * with nothing to tick is a caller mistake worth surfacing.
 */
export function toMemberTick(
  dto: UpdateChecklistItemDto,
): MemberTickChecklistDto {
  if (typeof dto.is_done !== 'boolean') {
    throw new BadRequestException(
      'A member can only set is_done on a checklist item',
    );
  }
  return { is_done: dto.is_done };
}
