import { PrismaService } from '../../prisma/prisma.service';

/** The user fields a list row ever needs to display. */
export interface UserSummary {
  id: string;
  full_name: string;
  email: string;
  role: string;
  department_id: string | null;
}

/**
 * Phase 2 tables carry plain FK columns and no Prisma relations, so a list of
 * leave applications comes back with `user_id` and nothing to show a person.
 * This is the one place that gap gets closed.
 *
 * One query for the whole page rather than one per row, which is the reason
 * this exists instead of a findUnique inside a map.
 *
 * Ids that do not resolve are simply absent from the map. Callers decide
 * whether that is a deleted user or a bug; it is never an exception here,
 * because a soft-deleted assignee should not blank a whole list.
 */
export async function lookupUsers(
  prisma: PrismaService,
  ids: (string | null | undefined)[],
): Promise<Map<string, UserSummary>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (unique.length === 0) return new Map();

  const users = await prisma.users.findMany({
    where: { id: { in: unique } },
    select: {
      id: true,
      full_name: true,
      email: true,
      role: true,
      department_id: true,
    },
  });

  return new Map(users.map((u) => [u.id, u as UserSummary]));
}

/**
 * Attach user summaries to a list of rows in one pass.
 *
 * `fields` names the FK columns to resolve. Each becomes a sibling property
 * with `_user` appended, so `user_id` yields `user_id_user`. Verbose, but it
 * never collides with a column the table already has, which a plain `user`
 * would on any row that also selects a relation later.
 */
export async function attachUsers<T extends Record<string, unknown>>(
  prisma: PrismaService,
  rows: T[],
  fields: (keyof T & string)[],
): Promise<(T & Record<string, UserSummary | null>)[]> {
  if (rows.length === 0) return [];

  const ids = rows.flatMap((row) =>
    fields.map((f) => row[f] as string | null | undefined),
  );
  const map = await lookupUsers(prisma, ids);

  return rows.map((row) => {
    const extra: Record<string, UserSummary | null> = {};
    for (const f of fields) {
      const id = row[f] as string | null | undefined;
      extra[`${f}_user`] = id ? (map.get(id) ?? null) : null;
    }
    return { ...row, ...extra };
  });
}
