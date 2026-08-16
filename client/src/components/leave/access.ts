/**
 * Who sees which leave screen. The API is the real gate; this only decides what
 * to render, so that nobody is shown a button that 403s.
 *
 * ponytail: `role_enum` has no HR yet, which p2_leave.md flags as the first
 * question for the client. These are string compares rather than a `Role` union
 * so the HR checks already work the day the enum gains it. Fold HR into the
 * union once it exists.
 */
const HR_ROLES = ['HR', 'ADMIN'];

/** Approve and reject. MD is here because an approver's own leave routes to them. */
const APPROVER_ROLES = [...HR_ROLES, 'HOD', 'MD'];

export const isLeaveHr = (role?: string | null) => Boolean(role && HR_ROLES.includes(role));

export const canActOnLeave = (role?: string | null) => Boolean(role && APPROVER_ROLES.includes(role));
