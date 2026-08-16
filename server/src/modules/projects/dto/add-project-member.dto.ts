import { IsIn, IsOptional, IsUUID } from 'class-validator';

/** Every value `project_members.role` is allowed to hold. */
export const PROJECT_MEMBER_ROLES = [
  'PROJECT_LEAD',
  'CO_LEAD',
  'MEMBER',
  'OBSERVER',
] as const;

export type ProjectMemberRole = (typeof PROJECT_MEMBER_ROLES)[number];

/**
 * The two roles this endpoint may hand out.
 *
 * Leadership is not invited, it is assigned: `projects.lead_id` and
 * `projects.co_lead_id` are the source of truth and the service keeps the
 * matching member rows in step on PATCH. Letting this endpoint write
 * PROJECT_LEAD would produce a project with two leads that disagree, one on
 * the project row and one in the member list.
 */
export const INVITABLE_MEMBER_ROLES = ['MEMBER', 'OBSERVER'] as const;

export class AddProjectMemberDto {
  @IsUUID()
  user_id!: string;

  /** Defaults to MEMBER. OBSERVER reads everything and writes nothing. */
  @IsOptional()
  @IsIn(INVITABLE_MEMBER_ROLES)
  role?: (typeof INVITABLE_MEMBER_ROLES)[number];
}
