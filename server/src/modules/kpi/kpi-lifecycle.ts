import { kpi_status_enum, role_enum } from '@prisma/client';

/**
 * Which moves through the KPI lifecycle are legal, and who may make them.
 *
 * Draft, Pending Approval, Approved, Active, In Progress, Pending Review,
 * Evaluated, Finalized, Locked, with Cancelled reachable from anywhere except
 * Locked. Ten states is more than a smaller product would need, and they are
 * here because the framework names them: each one is a different answer to
 * "who can change this right now".
 *
 * ponytail: one table and one lookup, rather than an endpoint per transition.
 * The controller has a single `PATCH /kpis/:id/status`, so adding a state is an
 * entry here instead of a route, a DTO, and a service method.
 */

/** Roles that can author a KPI and drive it through its cycle. */
export const KPI_AUTHOR_ROLES: role_enum[] = [
  role_enum.MD,
  role_enum.EA,
  role_enum.PA,
  role_enum.DEPARTMENT_CONTROLLER,
  role_enum.HOD,
];

/**
 * Roles that approve, finalize, lock, and cancel.
 *
 * MD, EA and PA approve without restriction, matching their unrestricted
 * department scope everywhere else in PerformX. A HOD approves too, but only
 * within a department they head — `KpiService` checks that department scope
 * on every approver-gated move, since this list alone cannot express it.
 */
export const KPI_APPROVER_ROLES: role_enum[] = [
  role_enum.MD,
  role_enum.EA,
  role_enum.PA,
  role_enum.DEPARTMENT_CONTROLLER,
  role_enum.HOD,
];

const AUTHOR = KPI_AUTHOR_ROLES;
const APPROVER = KPI_APPROVER_ROLES;

const TRANSITIONS: Readonly<
  Partial<Record<kpi_status_enum, Partial<Record<kpi_status_enum, role_enum[]>>>>
> = {
  DRAFT: {
    PENDING_APPROVAL: AUTHOR,
    CANCELLED: AUTHOR,
  },
  PENDING_APPROVAL: {
    APPROVED: APPROVER,
    // Sent back with the target unchanged, so the author can rework it.
    DRAFT: APPROVER,
    CANCELLED: APPROVER,
  },
  APPROVED: {
    ACTIVE: AUTHOR,
    CANCELLED: APPROVER,
  },
  ACTIVE: {
    // Also reached automatically by the first update, without this endpoint.
    IN_PROGRESS: AUTHOR,
    PENDING_REVIEW: AUTHOR,
    CANCELLED: APPROVER,
  },
  IN_PROGRESS: {
    PENDING_REVIEW: AUTHOR,
    CANCELLED: APPROVER,
  },
  PENDING_REVIEW: {
    EVALUATED: AUTHOR,
    // Not good enough yet: back to the owner rather than evaluated badly.
    IN_PROGRESS: AUTHOR,
    CANCELLED: APPROVER,
  },
  EVALUATED: {
    FINALIZED: APPROVER,
    PENDING_REVIEW: APPROVER,
    CANCELLED: APPROVER,
  },
  FINALIZED: {
    LOCKED: APPROVER,
    EVALUATED: APPROVER,
    CANCELLED: APPROVER,
  },
  // LOCKED is the end. Target and actual are preserved from here on, and a
  // correction means a new KPI for the next cycle, not an edit to this one.
};

/**
 * The roles allowed to make one move, or null when the move itself is illegal.
 *
 * Null and `[]` mean different things: null is "that is not a transition",
 * which is a 400, and an empty list would be "nobody may", which nothing
 * returns today.
 */
export function transitionRoles(
  from: kpi_status_enum,
  to: kpi_status_enum,
): role_enum[] | null {
  return TRANSITIONS[from]?.[to] ?? null;
}

/** Statuses where the owner may enter an actual. */
export function acceptsActual(status: kpi_status_enum): boolean {
  return status === 'ACTIVE' || status === 'IN_PROGRESS';
}

/** Statuses where a reviewer may enter a rating or a review remark. */
export function acceptsReview(status: kpi_status_enum): boolean {
  return status === 'IN_PROGRESS' || status === 'PENDING_REVIEW';
}

/**
 * Whether a KPI belongs in a PS Score at all.
 *
 * A draft or an unapproved target is not a commitment yet, and a cancelled KPI
 * is explicitly not a failure. Everything from Approved onwards counts, and a
 * KPI with no update simply scores null and drops out during normalisation.
 */
export function isCountable(status: kpi_status_enum): boolean {
  return (
    status !== 'DRAFT' && status !== 'PENDING_APPROVAL' && status !== 'CANCELLED'
  );
}

/** Nothing about the KPI changes after this. */
export function isSettled(status: kpi_status_enum): boolean {
  return status === 'LOCKED' || status === 'CANCELLED';
}
