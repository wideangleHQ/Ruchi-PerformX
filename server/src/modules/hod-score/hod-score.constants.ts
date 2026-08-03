// src/modules/hod-score/hod-score.constants.ts

/**
 * HOD Score configuration.
 *
 * Single source of truth for weights, targets and cache policy.
 * Weights follow the RUCHI PerformX Scoring Guide and must sum to 1.
 */

export const HOD_SCORE_COMPONENTS = [
  'taskCreation',
  'selfAction',
  'departmentCompletion',
  'departmentHealth',
  'activeParticipation',
  'leadershipBonus',
] as const;

export type HodScoreComponent = (typeof HOD_SCORE_COMPONENTS)[number];

export const HOD_SCORE_WEIGHTS: Record<HodScoreComponent, number> = {
  taskCreation: 0.25,
  selfAction: 0.2,
  departmentCompletion: 0.25,
  departmentHealth: 0.15,
  activeParticipation: 0.1,
  leadershipBonus: 0.05,
};

/**
 * Expected tasks created per employee per month.
 * 3 employees -> 18, 5 employees -> 30, 10 employees -> 60.
 */
export const TASKS_PER_EMPLOYEE_TARGET = 6;

/**
 * Business timezone used to derive month boundaries and calendar days.
 * Keeps "distinct days" and working-day counts stable regardless of server TZ.
 */
export const SCORE_TIMEZONE = process.env.SCORE_TIMEZONE ?? 'Asia/Kolkata';

/** Redis TTL for a computed monthly matrix (30 minutes). */
export const HOD_SCORE_CACHE_TTL_SECONDS = 30 * 60;

/** Cache key namespace - bump the version to invalidate every cached matrix. */
export const HOD_SCORE_CACHE_VERSION = 'v1';

/** Number of months returned by the trend endpoint. */
export const TREND_MONTHS = 6;

/** Earliest year accepted by the API - guards against enumeration probing. */
export const MIN_SCORE_YEAR = 2020;

/**
 * Task statuses that count as delivered work for department completion.
 */
export const COMPLETED_TASK_STATUSES = [
  'COMPLETED',
  'CLOSED',
  'REVIEWED',
  'HOD_VERIFIED',
] as const;

/**
 * Task statuses that count as "not yet started / awaiting action".
 */
export const PENDING_TASK_STATUSES = ['CREATED', 'ASSIGNED', 'PENDING'] as const;
