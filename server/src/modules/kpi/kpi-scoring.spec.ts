import { describe, expect, it } from 'vitest';
import { kpi_status_enum, role_enum } from '@prisma/client';

import { searchUnits } from './kpi-units';
import {
  binaryAchievement,
  kpiScore,
  milestoneAchievement,
  psScore,
  quantitativeAchievement,
  ratingAchievement,
  type KpiScoringConfig,
  type PsScoreInput,
} from './kpi-scoring';
import {
  acceptsActual,
  acceptsReview,
  isCountable,
  isSettled,
  transitionRoles,
} from './kpi-lifecycle';

/** The worked examples in the framework document, as the tests for the engine
 * that has to reproduce them. */

describe('quantitativeAchievement', () => {
  it('divides actual by target when higher is better', () => {
    // The document's sales example: 8 lakh against a 10 lakh target.
    expect(quantitativeAchievement(1_000_000, 800_000, 'HIGHER_IS_BETTER')).toBe(80);
  });

  it('does not read a slower resolution as overperformance', () => {
    // Five hours against a four hour target is 125% by plain division, and is
    // worse, not better. This is the case direction exists for.
    expect(quantitativeAchievement(4, 5, 'LOWER_IS_BETTER')).toBe(80);
  });

  it('treats zero as the best outcome when lower is better', () => {
    expect(quantitativeAchievement(5, 0, 'LOWER_IS_BETTER')).toBe(200);
  });

  it('penalises drift in both directions on an exact target', () => {
    expect(quantitativeAchievement(100, 100, 'EXACT_TARGET')).toBe(100);
    expect(quantitativeAchievement(100, 90, 'EXACT_TARGET')).toBe(90);
    expect(quantitativeAchievement(100, 110, 'EXACT_TARGET')).toBe(90);
  });

  it('measures improvement from a baseline rather than absolute level', () => {
    // 60 to 90 is the span; 75 is halfway along it, not 83% of the target.
    expect(quantitativeAchievement(90, 75, 'HIGHER_IS_BETTER', 60)).toBe(50);
  });

  it('measures a reduction from a baseline downwards', () => {
    // Cut complaints from 100 to 40. Reaching 70 is half the job done.
    expect(quantitativeAchievement(40, 70, 'LOWER_IS_BETTER', 100)).toBe(50);
  });

  it('lets achievement exceed 100 so a cap is a choice, not a default', () => {
    expect(quantitativeAchievement(1_000_000, 1_200_000, 'HIGHER_IS_BETTER')).toBe(120);
  });

  it('floors a miss at zero rather than going negative', () => {
    expect(quantitativeAchievement(90, 50, 'HIGHER_IS_BETTER', 60)).toBe(0);
  });
});

describe('milestoneAchievement', () => {
  const stages = [
    { title: 'Requirement Gathering', weight: 10 },
    { title: 'Process Design', weight: 20 },
    { title: 'Management Approval', weight: 15 },
    { title: 'Implementation', weight: 35 },
    { title: 'Final Rollout', weight: 20 },
  ];

  it('counts weight, not stages', () => {
    // Three of five complete is 45%, not 60%, because the stages that are done
    // are the light ones.
    const done = stages.map((stage) => ({
      weight: stage.weight,
      completed: ['Requirement Gathering', 'Process Design', 'Management Approval'].includes(
        stage.title,
      ),
    }));
    expect(milestoneAchievement(done)).toBe(45);
  });

  it('is zero with no stages, because nothing has been achieved', () => {
    expect(milestoneAchievement([])).toBe(0);
  });

  it('normalises a set whose weights do not total 100', () => {
    expect(
      milestoneAchievement([
        { weight: 30, completed: true },
        { weight: 30, completed: false },
      ]),
    ).toBe(50);
  });
});

describe('kpiScore', () => {
  it('passes achievement straight through under DIRECT', () => {
    expect(kpiScore(80, 'DIRECT')).toBe(80);
  });

  it('scores 100 for 80% achievement under a threshold that says so', () => {
    // The point of separating achievement from score: the same 80% is 80 under
    // DIRECT and 100 here, and neither is wrong.
    const config: KpiScoringConfig = {
      bands: [
        { min_achievement: 90, score: 100 },
        { min_achievement: 70, score: 80 },
      ],
      below_band_score: 60,
    };
    expect(kpiScore(95, 'THRESHOLD', config)).toBe(100);
    expect(kpiScore(80, 'THRESHOLD', config)).toBe(80);
    expect(kpiScore(50, 'THRESHOLD', config)).toBe(60);
  });

  it('caps overachievement only when the KPI asked to be capped', () => {
    expect(kpiScore(140, 'DIRECT')).toBe(140);
    expect(kpiScore(140, 'DIRECT', { cap_at: 100 })).toBe(100);
  });

  it('maps a rating through the rubric configured for that KPI', () => {
    const config: KpiScoringConfig = { rating_scores: [0, 40, 70, 90, 100] };
    expect(kpiScore(null, 'RATING', config, 3)).toBe(70);
    expect(kpiScore(null, 'RATING', config, 5)).toBe(100);
  });

  it('falls back to the share of the scale when no rubric was configured', () => {
    expect(kpiScore(null, 'RATING', {}, 4)).toBe(80);
    expect(ratingAchievement(4)).toBe(80);
  });

  it('returns null rather than zero when there is nothing to score', () => {
    expect(kpiScore(null, 'DIRECT')).toBeNull();
    expect(kpiScore(null, 'RATING', {}, null)).toBeNull();
  });

  it('has no third state for a binary outcome', () => {
    expect(kpiScore(binaryAchievement(true), 'DIRECT')).toBe(100);
    expect(kpiScore(binaryAchievement(false), 'DIRECT')).toBe(0);
  });
});

describe('psScore', () => {
  const line = (over: Partial<PsScoreInput>): PsScoreInput => ({
    kpi_id: over.kpi_id ?? 'k',
    weight: over.weight ?? 0,
    score: over.score ?? null,
    contribution_share: over.contribution_share ?? 100,
    excluded: over.excluded ?? false,
  });

  it('reproduces the three-KPI example from the framework', () => {
    const result = psScore([
      line({ kpi_id: 'revenue', weight: 50, score: 80 }),
      line({ kpi_id: 'retention', weight: 30, score: 70 }),
      line({ kpi_id: 'reporting', weight: 20, score: 90 }),
    ]);
    // 40 + 21 + 18.
    expect(result.ps_score).toBe(79);
    expect(result.counted_weight).toBe(100);
  });

  it('reproduces the complete employee journey', () => {
    const result = psScore([
      line({ kpi_id: 'revenue', weight: 50, score: 80 }),
      line({ kpi_id: 'customers', weight: 30, score: 90 }),
      line({ kpi_id: 'collection', weight: 20, score: 96.84 }),
    ]);
    // The document shows 86.4, having rounded the third KPI's score to 97
    // before multiplying. Carrying the full number gives 86.37, and both round
    // to the same figure at the precision anybody reads.
    expect(result.ps_score).toBeCloseTo(86.37, 2);
  });

  it('redistributes the weight of a cancelled KPI rather than zeroing it', () => {
    const result = psScore([
      line({ kpi_id: 'revenue', weight: 50, score: 80 }),
      line({ kpi_id: 'retention', weight: 30, score: 70 }),
      line({ kpi_id: 'dropped', weight: 20, score: null, excluded: true }),
    ]);
    // 50 and 30 become 62.5 and 37.5 of what is left, so the employee is not
    // marked down for a KPI the business withdrew.
    expect(result.ps_score).toBeCloseTo(76.25, 2);
    expect(result.counted_weight).toBe(80);
  });

  it('does not treat a missing actual as a zero', () => {
    const withMissing = psScore([
      line({ kpi_id: 'revenue', weight: 50, score: 80 }),
      line({ kpi_id: 'pending', weight: 50, score: null }),
    ]);
    expect(withMissing.ps_score).toBe(80);
    expect(withMissing.counted_weight).toBe(50);
  });

  it('reports a set that does not total 100 instead of quietly rescaling it', () => {
    const result = psScore([
      line({ kpi_id: 'a', weight: 40, score: 90 }),
      line({ kpi_id: 'b', weight: 40, score: 70 }),
    ]);
    expect(result.declared_weight).toBe(80);
    expect(result.ps_score).toBe(80);
  });

  it('gives each contributor their share of a shared outcome', () => {
    // One department KPI, three people. Nobody takes full credit for it.
    const share = (pct: number) =>
      psScore([line({ kpi_id: 'retention', weight: 20, score: 90, contribution_share: pct })])
        .ps_score;
    expect(share(30)).toBe(27);
    expect(share(40)).toBe(36);
    expect(share(30) + share(40) + share(30)).toBe(90);
  });

  it('scores an empty set as nothing to score, not as failure', () => {
    const result = psScore([]);
    expect(result.ps_score).toBe(0);
    expect(result.counted_weight).toBe(0);
  });
});

describe('searchUnits', () => {
  const labels = (query: string) => searchUnits(query).map((unit) => unit.label);

  it('returns the other currencies when one of them is typed', () => {
    const found = labels('rupee');
    expect(found[0]).toBe('Indian Rupee');
    expect(found).toEqual(
      expect.arrayContaining(['US Dollar', 'Euro', 'Pound Sterling', 'UAE Dirham']),
    );
  });

  it('finds every unit that carries the word', () => {
    const found = labels('ticket');
    expect(found.slice(0, 3)).toEqual([
      'Tickets',
      'Support Tickets',
      'Resolved Tickets',
    ]);
  });

  it('finds a unit through a word that is not in its label', () => {
    expect(labels('headcount')[0]).toBe('Employees');
    expect(labels('turnaround')[0]).toBe('Hours');
  });

  it('returns the library for an empty query rather than nothing', () => {
    expect(searchUnits('').length).toBeGreaterThan(0);
  });
});

describe('kpi lifecycle', () => {
  it('walks the documented path from draft to locked', () => {
    const path: [kpi_status_enum, kpi_status_enum][] = [
      ['DRAFT', 'PENDING_APPROVAL'],
      ['PENDING_APPROVAL', 'APPROVED'],
      ['APPROVED', 'ACTIVE'],
      ['ACTIVE', 'IN_PROGRESS'],
      ['IN_PROGRESS', 'PENDING_REVIEW'],
      ['PENDING_REVIEW', 'EVALUATED'],
      ['EVALUATED', 'FINALIZED'],
      ['FINALIZED', 'LOCKED'],
    ];
    for (const [from, to] of path) {
      expect(transitionRoles(from, to)).not.toBeNull();
    }
  });

  it('refuses a move that skips the middle of the cycle', () => {
    expect(transitionRoles('DRAFT', 'ACTIVE')).toBeNull();
    expect(transitionRoles('ACTIVE', 'LOCKED')).toBeNull();
  });

  it('lets nothing out of LOCKED', () => {
    expect(transitionRoles('LOCKED', 'EVALUATED')).toBeNull();
    expect(transitionRoles('LOCKED', 'CANCELLED')).toBeNull();
    expect(isSettled('LOCKED')).toBe(true);
  });

  it('keeps a HOD out of approving the target they set', () => {
    expect(transitionRoles('PENDING_APPROVAL', 'APPROVED')).not.toContain(role_enum.HOD);
    expect(transitionRoles('DRAFT', 'PENDING_APPROVAL')).toContain(role_enum.HOD);
  });

  it('accepts actuals only while the KPI is running', () => {
    expect(acceptsActual('ACTIVE')).toBe(true);
    expect(acceptsActual('IN_PROGRESS')).toBe(true);
    expect(acceptsActual('PENDING_REVIEW')).toBe(false);
    expect(acceptsActual('LOCKED')).toBe(false);
  });

  it('accepts a rating up to the point the KPI is evaluated', () => {
    expect(acceptsReview('PENDING_REVIEW')).toBe(true);
    expect(acceptsReview('EVALUATED')).toBe(false);
  });

  it('keeps drafts and cancellations out of the PS Score', () => {
    expect(isCountable('DRAFT')).toBe(false);
    expect(isCountable('PENDING_APPROVAL')).toBe(false);
    expect(isCountable('CANCELLED')).toBe(false);
    expect(isCountable('ACTIVE')).toBe(true);
    expect(isCountable('LOCKED')).toBe(true);
  });
});
