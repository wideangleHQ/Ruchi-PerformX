import { role_enum } from '@prisma/client';

/**
 * The three roles that constitute the R&D oversight team. They read every
 * research thread and they are the only ones who can change the roster.
 */
export const OVERSIGHT_ROLES: role_enum[] = [
  role_enum.MD,
  role_enum.EA,
  role_enum.PA,
];

/**
 * `'ALL'` means no category filter is applied at all, which is not the same as
 * the list of categories that happen to exist today: a report submitted a
 * second later is still visible.
 */
export type CategoryScope = 'ALL' | string[];

/**
 * Which R&D report categories a caller may read.
 *
 * Three outcomes and no fourth: oversight reads everything, a team member reads
 * the categories they have research in, and anybody else reads nothing. An
 * empty array is a real answer, not a missing one, so callers must treat it as
 * "no reports" rather than "no filter".
 *
 * Pure on purpose. Membership and the member's categories are both queries, and
 * keeping the rule out of the query lets it be read and tested in one place
 * instead of being reconstructed from three service methods.
 */
export function visibleCategories(
  role: role_enum,
  isMember: boolean,
  memberCategories: string[],
): CategoryScope {
  if (OVERSIGHT_ROLES.includes(role)) return 'ALL';
  if (!isMember) return [];
  return [...new Set(memberCategories)];
}
