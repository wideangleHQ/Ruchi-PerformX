import { project_status_enum } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { PROJECT_TRANSITIONS, canTransition } from './projects.service';

const S = project_status_enum;
const ALL = Object.values(project_status_enum);

/**
 * The transition table is the only thing standing between a PATCH and a
 * project that jumped from DRAFT to COMPLETED. It is pure, so it is tested
 * exhaustively: every ordered pair of statuses is asserted, not just the ones
 * somebody thought to list.
 */
const LEGAL: [project_status_enum, project_status_enum][] = [
  [S.DRAFT, S.PLANNED],
  [S.PLANNED, S.ACTIVE],
  [S.ACTIVE, S.ON_HOLD],
  [S.ACTIVE, S.AT_RISK],
  [S.ACTIVE, S.COMPLETED],
  [S.ACTIVE, S.CANCELLED],
  [S.ACTIVE, S.ARCHIVED],
  [S.ON_HOLD, S.ACTIVE],
  [S.ON_HOLD, S.ARCHIVED],
  [S.AT_RISK, S.ACTIVE],
  [S.AT_RISK, S.ARCHIVED],
  [S.COMPLETED, S.ARCHIVED],
  [S.CANCELLED, S.ARCHIVED],
];

const isLegal = (from: project_status_enum, to: project_status_enum) =>
  LEGAL.some(([f, t]) => f === from && t === to);

describe('canTransition', () => {
  it('allows every move the lifecycle draws', () => {
    // A closure report exists, so COMPLETED is not being rejected for that.
    const refused = LEGAL.filter(([from, to]) => !canTransition(from, to, true));
    expect(refused).toEqual([]);
  });

  it('refuses every move the lifecycle does not draw', () => {
    const allowed = ALL.flatMap((from) =>
      ALL.filter((to) => !isLegal(from, to) && canTransition(from, to, true)).map(
        (to) => `${from} -> ${to}`,
      ),
    );
    expect(allowed).toEqual([]);
  });

  it('refuses COMPLETED without a closure report', () => {
    expect(canTransition(S.ACTIVE, S.COMPLETED, false)).toBe(false);
    expect(canTransition(S.ACTIVE, S.COMPLETED, true)).toBe(true);
  });

  it('gates COMPLETED on the report and nothing else on it', () => {
    const changed = LEGAL.filter(
      ([from, to]) =>
        to !== S.COMPLETED &&
        canTransition(from, to, true) !== canTransition(from, to, false),
    );
    expect(changed).toEqual([]);
  });

  it('never treats a status as a move to itself', () => {
    const selfMoves = ALL.filter((s) => canTransition(s, s, true));
    expect(selfMoves).toEqual([]);
  });

  it('leaves ARCHIVED terminal', () => {
    const onward = ALL.filter((to) => canTransition(S.ARCHIVED, to, true));
    expect(onward).toEqual([]);
  });

  it('keeps ARCHIVED reachable from every settled status', () => {
    const settled = [S.ACTIVE, S.ON_HOLD, S.AT_RISK, S.COMPLETED, S.CANCELLED];
    const stuck = settled.filter((from) => !canTransition(from, S.ARCHIVED, true));
    expect(stuck).toEqual([]);
  });

  it('has a row for every status, so a new enum value fails loudly', () => {
    const missing = ALL.filter((s) => !PROJECT_TRANSITIONS[s]);
    expect(missing).toEqual([]);
  });
});
