import {
  kpi_direction_enum,
  kpi_scoring_method_enum,
} from '@prisma/client';

/**
 * The PS Score arithmetic, with no Prisma and no Nest in it.
 *
 * This is the part of the module that is expensive to get wrong and silent when
 * it is, so it lives here as plain functions and is tested directly in
 * `kpi-scoring.spec.ts` against the worked examples in the framework document.
 *
 * The one idea the whole file is built around: achievement and score are two
 * different numbers. Achievement says how close the actual got to the target.
 * Score is what the KPI's configured rule makes of that. Eighty percent
 * achievement is 80 under DIRECT and can be 100 under a THRESHOLD band that
 * treats anything above 75 as fully met, and neither is a bug.
 */

/** One band of a THRESHOLD rule: achievement at or above `min_achievement`
 * scores `score`. Bands are configured per KPI, so 70-89 can be worth 80 in
 * one department and something else in another. */
export interface ThresholdBand {
  min_achievement: number;
  score: number;
}

export interface KpiScoringConfig {
  /** THRESHOLD only. Order does not matter; the highest qualifying band wins. */
  bands?: ThresholdBand[];
  /** THRESHOLD only. Score when no band qualifies. Defaults to 0. */
  below_band_score?: number;
  /** RATING only. `rating_scores[0]` is the score for a rating of 1. */
  rating_scores?: number[];
  /** RATING only. Defaults to 5. */
  max_rating?: number;
  /** Upper bound on the score. Absent means overachievement flows through. */
  cap_at?: number;
}

/** Two decimals, which is the precision the columns carry and the UI shows. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Percentages are never negative here: missing the target completely is 0. */
function floorAtZero(value: number): number {
  return value < 0 ? 0 : value;
}

/**
 * How close an actual came to its target, in percent.
 *
 * `direction` is what stops a plain actual/target from lying. Five hours
 * against a four hour target is 125% by division and is worse, not better, so
 * LOWER_IS_BETTER inverts the comparison.
 *
 * `baseline` turns the measure into improvement rather than absolute level:
 * with a baseline of 60 and a target of 90, an actual of 75 is halfway, not
 * 83%. Null baseline measures from zero, which is the usual case.
 *
 * Returns null when there is no target to compare against. Assumes `target` and
 * `actual` are finite; the DTO's `@IsNumber` is what guarantees that.
 */
export function quantitativeAchievement(
  target: number,
  actual: number,
  direction: kpi_direction_enum,
  baseline: number | null = null,
): number | null {
  if (!Number.isFinite(target)) return null;

  if (direction === 'EXACT_TARGET') {
    // Both over and under are undesirable, so the gap is what counts.
    if (target === 0) return actual === 0 ? 100 : 0;
    const drift = Math.abs(actual - target) / Math.abs(target);
    return round2(floorAtZero(100 - drift * 100));
  }

  if (direction === 'HIGHER_IS_BETTER') {
    const from = baseline ?? 0;
    const span = target - from;
    // A baseline at or above the target is a misconfiguration rather than a
    // division to attempt. Fall back to the plain hit/miss it implies.
    if (span <= 0) return actual >= target ? 100 : 0;
    return round2(floorAtZero(((actual - from) / span) * 100));
  }

  // LOWER_IS_BETTER.
  if (baseline === null) {
    // Zero complaints against a target of five is the best outcome available,
    // not a division by zero.
    if (actual <= 0) return target <= 0 ? 100 : 200;
    if (target <= 0) return 0;
    return round2(floorAtZero((target / actual) * 100));
  }
  const span = baseline - target;
  if (span <= 0) return actual <= target ? 100 : 0;
  return round2(floorAtZero(((baseline - actual) / span) * 100));
}

/**
 * Completed weight of a milestone set, in percent.
 *
 * Three of five stages complete is not 60%. It is whatever those three weigh,
 * which is the entire reason milestones carry weights. Weights are normalised
 * against their own total so a set that does not add up to 100 still reports a
 * percentage rather than a number that looks like one.
 *
 * An empty set is 0, not 100: a milestone KPI with no stages has achieved
 * nothing, and the service refuses to create one.
 */
export function milestoneAchievement(
  milestones: readonly { weight: number; completed: boolean }[],
): number {
  const total = milestones.reduce((sum, m) => sum + m.weight, 0);
  if (total <= 0) return 0;
  const done = milestones
    .filter((m) => m.completed)
    .reduce((sum, m) => sum + m.weight, 0);
  return round2((done / total) * 100);
}

/** Completed is everything, not completed is nothing. There is no third state. */
export function binaryAchievement(done: boolean): number {
  return done ? 100 : 0;
}

/**
 * A rating expressed as a percentage of the scale, so a rating KPI has a
 * progress number like every other mode. The score it earns is a separate
 * question, answered by `rating_scores`.
 */
export function ratingAchievement(rating: number, maxRating = 5): number {
  if (maxRating <= 0) return 0;
  return round2((rating / maxRating) * 100);
}

function applyCap(score: number, config: KpiScoringConfig): number {
  return config.cap_at === undefined ? score : Math.min(score, config.cap_at);
}

/**
 * Turn achievement into the KPI's score using its configured rule.
 *
 * The rule is fixed when the KPI is created and is never adjusted afterwards to
 * change an outcome, which is what makes a score defensible six months later.
 *
 * Returns null when the KPI has nothing to score yet: no actual entered, or a
 * rating KPI the reviewer has not reached. Null is not zero. A KPI nobody
 * updated is excluded from the PS Score rather than counted as a failure,
 * because the business has not decided that a missing update is a zero.
 *
 * Throws nothing. A THRESHOLD rule with no bands scores `below_band_score`,
 * which defaults to 0, and the DTO is what stops that configuration existing.
 */
export function kpiScore(
  achievement: number | null,
  method: kpi_scoring_method_enum,
  config: KpiScoringConfig = {},
  rating: number | null = null,
): number | null {
  if (method === 'RATING') {
    if (rating === null) return null;
    const scores = config.rating_scores;
    if (scores && scores.length >= rating && rating >= 1) {
      return round2(applyCap(scores[rating - 1] as number, config));
    }
    // No rubric mapping configured: the rating is its share of the scale.
    return round2(applyCap(ratingAchievement(rating, config.max_rating ?? 5), config));
  }

  if (achievement === null) return null;

  if (method === 'THRESHOLD') {
    const qualifying = (config.bands ?? [])
      .filter((band) => achievement >= band.min_achievement)
      .sort((a, b) => b.min_achievement - a.min_achievement);
    const band = qualifying[0];
    return round2(band ? band.score : (config.below_band_score ?? 0));
  }

  // DIRECT and MILESTONE both score the achievement itself. They are separate
  // methods because a milestone KPI's achievement comes from weighted stages
  // rather than a division, not because the last step differs.
  return round2(applyCap(achievement, config));
}

/** One KPI as it enters the PS Score. */
export interface PsScoreInput {
  kpi_id: string;
  /** Percent of the owner's PS Score this KPI was given. */
  weight: number;
  /** Null when nothing has been entered yet. Not the same as zero. */
  score: number | null;
  /** The person's share of a shared outcome, 0-100. 100 when they own it. */
  contribution_share: number;
  /** Cancelled, or otherwise not applicable to this person this period. */
  excluded: boolean;
}

export interface PsScoreLine extends PsScoreInput {
  /** `weight` after the set is normalised over what is actually countable. */
  effective_weight: number;
  /** What this KPI adds to the PS Score. Null when it is not counted. */
  contribution: number | null;
  counted: boolean;
}

export interface PsScoreResult {
  ps_score: number;
  /** Weight that produced the score. */
  counted_weight: number;
  /** Weight of every live KPI, scored or not. A set that does not total 100 is
   * visible here rather than quietly changing what the score means. */
  declared_weight: number;
  lines: PsScoreLine[];
}

/**
 * The PS Score for one person's KPI set: score times weight, summed.
 *
 * Weights are normalised over the KPIs that actually counted, which is one rule
 * doing three jobs the framework asks for separately. A cancelled KPI has its
 * weight redistributed rather than zeroed, so a KPI dropped for legitimate
 * business reasons cannot fail anybody. A KPI with no update yet is left out on
 * the same path, so a missing actual is not silently a zero. And a set whose
 * weights do not total 100 still produces a defensible number instead of a
 * score out of 80 presented as if it were out of 100.
 *
 * `contribution_share` is applied after normalisation and is deliberately a
 * separate number from weight: weight says how important the goal is, share
 * says how much of it was this person's. Multiplying them is what stops three
 * people each taking full credit for one department outcome.
 *
 * An empty or entirely uncounted set scores 0 with `counted_weight` 0, which
 * callers should read as "nothing to score" rather than as a bad result.
 */
export function psScore(inputs: readonly PsScoreInput[]): PsScoreResult {
  const live = inputs.filter((input) => !input.excluded);
  const counted = live.filter((input) => input.score !== null);
  const countedWeight = counted.reduce((sum, input) => sum + input.weight, 0);

  const lines: PsScoreLine[] = inputs.map((input) => {
    const isCounted = counted.includes(input);
    if (!isCounted || countedWeight <= 0) {
      return { ...input, effective_weight: 0, contribution: null, counted: false };
    }
    const effective = (input.weight / countedWeight) * 100;
    const contribution =
      ((input.score as number) * effective * input.contribution_share) / 10000;
    return {
      ...input,
      effective_weight: round2(effective),
      contribution: round2(contribution),
      counted: true,
    };
  });

  const total = lines.reduce((sum, line) => sum + (line.contribution ?? 0), 0);

  return {
    ps_score: round2(total),
    counted_weight: round2(countedWeight),
    declared_weight: round2(live.reduce((sum, input) => sum + input.weight, 0)),
    lines,
  };
}
