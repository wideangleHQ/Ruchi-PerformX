// src/modules/hod-score/dto/hod-score-response.dto.ts

import { HodScoreComponent } from '../hod-score.constants';

/**
 * Per-component score. `null` means NEUTRAL - the component had no data and
 * its weight was redistributed across the remaining components.
 */
export type HodScoreBreakdown = Record<HodScoreComponent, number | null>;

/** Raw counters behind the breakdown, used by the UI to explain a score. */
export interface HodScoreMetrics {
  employeeCount: number;
  workingDays: number;
  createdTasks: number;
  expectedTasks: number;
  selfActionsTotal: number;
  selfActionsCompleted: number;
  selfActionDays: number;
  departmentTasksTotal: number;
  departmentTasksCompleted: number;
  departmentTasksPending: number;
  departmentTasksOverdue: number;
  activeDays: number;
  featuresUsed: number;
  reviewedTasks: number;
  avgReviewHours: number | null;
  requestsReviewed: number;
  avgRequestResponseHours: number | null;
}

export interface HodScoreDepartment {
  id: string;
  name: string;
}

export interface HodScoreTrendPoint {
  month: number;
  year: number;
  label: string;
  score: number | null;
}

export interface HodScoreRecord {
  hodId: string;
  hodName: string;
  departments: HodScoreDepartment[];
  primaryDepartment: HodScoreDepartment | null;
  month: number;
  year: number;
  score: number;
  hasData: boolean;
  departmentRank: number | null;
  departmentTotal: number;
  companyRank: number | null;
  companyTotal: number;
  breakdown: HodScoreBreakdown;
  neutralComponents: HodScoreComponent[];
  metrics: HodScoreMetrics;
}

/** Response of GET /hod-score/me and GET /hod-score/:hodId */
export interface HodScoreResponse extends HodScoreRecord {
  trend: HodScoreTrendPoint[];
}

/** Response of GET /hod-score/department/:id */
export interface DepartmentScoreResponse {
  department: HodScoreDepartment;
  month: number;
  year: number;
  departmentScore: number | null;
  hodCount: number;
  averageBreakdown: HodScoreBreakdown;
  hods: HodScoreRecord[];
}

/** Response of GET /hod-score/company */
export interface CompanyScoreResponse {
  month: number;
  year: number;
  companyAverage: number | null;
  hodCount: number;
  hods: HodScoreRecord[];
}

/** Response of GET /hod-score/trends */
export interface TrendsResponse {
  scope: 'self' | 'hod' | 'department' | 'company';
  hodId: string | null;
  departmentId: string | null;
  months: number;
  trend: HodScoreTrendPoint[];
}
