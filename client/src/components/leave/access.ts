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

/**
 * The three admin routes do not share a role list, so neither do these.
 * Mirrors `@Roles` on `leave.controller.ts` exactly:
 *
 *   POST/PATCH /leave/types      HR, ADMIN
 *   GET/PATCH  /leave/balances   HR
 *   GET        /leave/reports/*  HR, MD
 *
 * ADMIN can define leave types but not read everybody's balances, and the MD
 * can read the report but not edit a type. Showing one screen's button on
 * another's role is exactly the 403 this file exists to avoid.
 */
export const canManageLeaveTypes = (role?: string | null) =>
  Boolean(role && HR_ROLES.includes(role));

export const canManageLeaveBalances = (role?: string | null) => role === 'HR';

export const canReadLeaveReports = (role?: string | null) =>
  Boolean(role && (role === 'HR' || role === 'MD'));

/** Whether to show the Admin entry point at all. */
export const canAdminLeave = (role?: string | null) =>
  canManageLeaveTypes(role) || canManageLeaveBalances(role) || canReadLeaveReports(role);
