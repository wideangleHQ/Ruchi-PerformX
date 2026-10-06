import { kpi_status_enum, role_enum } from '@prisma/client';

import { DepartmentScope } from '../../common/types/department-scope.type';

/**
 * Who may do what to a KPI, and which status moves are legal.
 *
 * Four statuses, from the approved KPI specification: DRAFT, PENDING_APPROVAL,
 * PUBLISHED, DELETED. An authority's KPI is published the moment it is
 * submitted. An employee's own KPI waits for a quick approve. DELETED is a soft
 * delete: the row, its updates, and its revisions stay.
 *
 * Everything here is a pure function of the role, the status, and the caller's
 * department scope, so the role matrix is tested without a database.
 */

/** Roles that create KPIs straight into PUBLISHED, assign them to others, and
 * quick approve an employee's. */
export const KPI_AUTHORITY_ROLES: role_enum[] = [
  role_enum.MD,
  role_enum.EA,
  role_enum.PA,
  role_enum.HOD,
  role_enum.DEPARTMENT_CONTROLLER,
];

/** Authorities whose reach is the whole company. HOD and Department Controller
 * are held to the departments their scope resolves to. */
export const KPI_GLOBAL_ROLES: role_enum[] = [role_enum.MD, role_enum.EA, role_enum.PA];

/** Everyone's KPI weights are measured against this. A set below it is valid;
 * the PS Score normalises over what is there. */
export const PERMITTED_ALLOCATION = 100;

/** Weights are allowed this much float, because 33.33 three times is what a
 * real form produces. */
export const WEIGHT_TOLERANCE = 0.05;

export function isAuthority(role: role_enum): boolean {
  return KPI_AUTHORITY_ROLES.includes(role);
}

/**
 * Where a KPI lands when its creator submits it: PUBLISHED for an authority,
 * PENDING_APPROVAL for anyone else. Never the other way round, which is the
 * edge case the specification calls out by name.
 */
export function submittedStatus(role: role_enum): kpi_status_enum {
  return isAuthority(role) ? 'PUBLISHED' : 'PENDING_APPROVAL';
}

/**
 * Whether `role` with `scope` may assign a KPI to, approve a KPI of, or manage a
 * KPI in `departmentId`.
 *
 * MD, EA, and PA reach anyone. HOD and Department Controller reach only their
 * own departments, and a KPI with no department is outside every department, so
 * it is outside theirs. Employees reach nobody.
 */
export function canActOnDepartment(
  role: role_enum,
  scope: DepartmentScope,
  departmentId: string | null,
): boolean {
  if (!isAuthority(role)) return false;
  if (KPI_GLOBAL_ROLES.includes(role)) return true;
  return departmentId !== null && scope.departmentIds.includes(departmentId);
}

const MOVES: Readonly<Record<kpi_status_enum, kpi_status_enum[]>> = {
  // Submitted, published, or thrown away before anyone saw it.
  DRAFT: ['PUBLISHED', 'PENDING_APPROVAL', 'DELETED'],
  // Quick approve, sent back for rework, or deleted.
  PENDING_APPROVAL: ['PUBLISHED', 'DRAFT', 'DELETED'],
  PUBLISHED: ['DELETED'],
  // The end. A deleted KPI keeps its history and comes back as a new one.
  DELETED: [],
};

/** Whether `from` to `to` is a move at all. Who may make it is decided by the
 * service, because that depends on whose KPI it is. */
export function isLegalMove(from: kpi_status_enum, to: kpi_status_enum): boolean {
  return MOVES[from].includes(to);
}

/** The only status that accepts actuals, milestone ticks, and ratings. */
export function acceptsProgress(status: kpi_status_enum): boolean {
  return status === 'PUBLISHED';
}

/**
 * Whether a KPI belongs in a PS Score. A draft or an unapproved target is not a
 * commitment yet, and a deleted KPI is explicitly not a failure.
 */
export function isCountable(status: kpi_status_enum): boolean {
  return status === 'PUBLISHED';
}

/** Statuses that hold a share of a person's allocation. A draft does not: it
 * has not been committed to, and a stale one would block real assignments. */
export const ALLOCATING_STATUSES: kpi_status_enum[] = ['PENDING_APPROVAL', 'PUBLISHED'];

/** How much of a person's allocation is taken and how much is left. */
export function allocation(weights: number[]): { allocated: number; remaining: number } {
  const allocated = round2(weights.reduce((sum, weight) => sum + weight, 0));
  return { allocated, remaining: round2(Math.max(0, PERMITTED_ALLOCATION - allocated)) };
}

/** Whether `weight` fits in what is left, with the float tolerance. */
export function fitsAllocation(weights: number[], weight: number): boolean {
  return weight <= allocation(weights).remaining + WEIGHT_TOLERANCE;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
