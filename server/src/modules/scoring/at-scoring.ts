/**
 * AT (Action Tracker) Score Arithmetic Engine.
 *
 * Implements pure calculations for:
 * 1. Employee / EA / PA AT Score:
 *    - Self Actions (50%): Completion (40%), Consistency (20%), Timeliness (15%), Quality (25%)
 *    - Assigned Tasks (30%): Completion (45%), Timeliness (25%), Quality (20%), Work Discipline (10%)
 *    - Projects (20%): Assigned Work (40%), Timeliness (20%), Quality (20%), Outcome (20%)
 *    - Normalization: If no projects apply, weights redistribute: Self Actions 62.5%, Tasks 37.5%.
 *
 * 2. HOD AT Score:
 *    - Personal Execution (40%)
 *    - Department Execution (35%)
 *    - Projects (15%)
 *    - Leadership Discipline (10%)
 *    - Normalization: If no projects apply, weights redistribute: Personal 47.06%, Dept 41.18%, Leadership 11.76%.
 */

export interface SelfActionMetrics {
  total: number;
  completed: number;
  activeDays: number;
  workingDays: number;
  onTimeCompleted: number;
  reviewedAccepted: number;
  totalReviewed: number;
}

export interface TaskMetrics {
  total: number;
  completed: number;
  onTimeCompleted: number;
  late1to2Days: number;
  late3to5Days: number;
  lateOver5Days: number;
  reviewedAccepted: number;
  reviewedRework: number;
  totalReviewed: number;
  overdueCount: number;
  escalatedCount: number;
}

export interface ProjectMetrics {
  hasProjects: boolean;
  totalItems: number;
  completedItems: number;
  onTimeItems: number;
  qualityScore: number; // 0-100
  outcomeScore: number; // 0-100
}

export interface DepartmentExecutionMetrics {
  totalTasks: number;
  completedTasks: number;
  onTimeTasks: number;
  pendingTasks: number;
  overdueTasks: number;
}

export interface LeadershipMetrics {
  avgReviewHours: number | null;
  requestsHandled: number;
  totalRequests: number;
}

export interface ComponentBreakdown {
  score: number;
  weight: number;
  weightedScore: number;
  applicable: boolean;
  subcomponents: Record<string, { score: number; weight: number; value?: string | number }>;
}

export interface AtScoreResult {
  score: number; // 0-100
  status: 'CALCULATED' | 'NOT_CALCULATED' | 'IN_PROGRESS';
  isNormalized: boolean;
  components: {
    selfAction: ComponentBreakdown;
    assignedTask: ComponentBreakdown;
    project: ComponentBreakdown;
    departmentExecution?: ComponentBreakdown;
    leadership?: ComponentBreakdown;
  };
}

/** Round to 2 decimal places */
export function round2(num: number): number {
  return Math.round(num * 100) / 100;
}

/** Clamp value between min and max */
export function clamp(val: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Total working days in a month (excluding Sundays and optional holiday keys).
 */
export function getWorkingDaysInMonth(year: number, month: number, holidayKeys: Set<string> = new Set()): number {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let count = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCDay() !== 0) {
      const key = d.toISOString().slice(0, 10);
      if (!holidayKeys.has(key)) {
        count++;
      }
    }
  }
  return count > 0 ? count : 26;
}

/**
 * Calculate Self Action Score (0-100)
 * Completion (40%), Consistency (20%), Timeliness (15%), Quality (25%)
 */
export function calculateSelfActionScore(m: SelfActionMetrics): ComponentBreakdown {
  if (m.total <= 0 && m.workingDays <= 0) {
    return {
      score: 100,
      weight: 50,
      weightedScore: 50,
      applicable: false,
      subcomponents: {
        completion: { score: 100, weight: 40, value: '0/0' },
        consistency: { score: 100, weight: 20, value: '0/0 days' },
        timeliness: { score: 100, weight: 15, value: '0/0' },
        quality: { score: 100, weight: 25, value: '0/0' },
      },
    };
  }

  const completion = m.total > 0 ? (m.completed / m.total) * 100 : 100;
  const consistency = m.workingDays > 0 ? (m.activeDays / m.workingDays) * 100 : 100;
  const timeliness = m.completed > 0 ? (m.onTimeCompleted / m.completed) * 100 : 100;
  const quality = m.totalReviewed > 0 ? (m.reviewedAccepted / m.totalReviewed) * 100 : 100;

  const score = clamp(
    round2(
      completion * 0.40 +
      consistency * 0.20 +
      timeliness * 0.15 +
      quality * 0.25
    )
  );

  return {
    score,
    weight: 50,
    weightedScore: round2(score * 0.50),
    applicable: m.total > 0 || m.workingDays > 0,
    subcomponents: {
      completion: { score: round2(completion), weight: 40, value: `${m.completed}/${m.total}` },
      consistency: { score: round2(consistency), weight: 20, value: `${m.activeDays}/${m.workingDays} days` },
      timeliness: { score: round2(timeliness), weight: 15, value: `${m.onTimeCompleted}/${m.completed}` },
      quality: { score: round2(quality), weight: 25, value: `${m.reviewedAccepted}/${m.totalReviewed}` },
    },
  };
}

/**
 * Calculate Assigned Task Score (0-100)
 * Completion (45%), Timeliness (25%), Quality (20%), Work Discipline (10%)
 */
export function calculateTaskScore(m: TaskMetrics): ComponentBreakdown {
  if (m.total <= 0) {
    return {
      score: 100,
      weight: 30,
      weightedScore: 30,
      applicable: false,
      subcomponents: {
        completion: { score: 100, weight: 45, value: '0/0' },
        timeliness: { score: 100, weight: 25, value: '0/0' },
        quality: { score: 100, weight: 20, value: '0/0' },
        discipline: { score: 100, weight: 10, value: '0 overdue' },
      },
    };
  }

  const completion = (m.completed / m.total) * 100;

  // Timeliness curve: On-time: 100%, 1-2 days late: 80%, 3-5 days late: 50%, >5 days late: 0%
  let timeliness = 100;
  if (m.completed > 0) {
    const weightedTime =
      m.onTimeCompleted * 100 +
      m.late1to2Days * 80 +
      m.late3to5Days * 50 +
      m.lateOver5Days * 0;
    timeliness = weightedTime / m.completed;
  }

  // Quality: accepted: 100%, rework: 70%, unreviewed: 100% default
  let quality = 100;
  if (m.totalReviewed > 0) {
    quality = ((m.reviewedAccepted * 100 + m.reviewedRework * 70) / (m.totalReviewed * 100)) * 100;
  }

  // Work discipline: 100 minus overdue penalty (-10 each) and escalation penalty (-20 each)
  const disciplinePenalty = (m.overdueCount * 10) + (m.escalatedCount * 20);
  const discipline = clamp(100 - disciplinePenalty);

  const score = clamp(
    round2(
      completion * 0.45 +
      timeliness * 0.25 +
      quality * 0.20 +
      discipline * 0.10
    )
  );

  return {
    score,
    weight: 30,
    weightedScore: round2(score * 0.30),
    applicable: true,
    subcomponents: {
      completion: { score: round2(completion), weight: 45, value: `${m.completed}/${m.total}` },
      timeliness: { score: round2(timeliness), weight: 25, value: `${m.onTimeCompleted}/${m.completed} on time` },
      quality: { score: round2(quality), weight: 20, value: `${m.reviewedAccepted}/${m.totalReviewed} accepted` },
      discipline: { score: round2(discipline), weight: 10, value: `${m.overdueCount} overdue, ${m.escalatedCount} escalated` },
    },
  };
}

/**
 * Calculate Project Score (0-100)
 * Assigned Work (40%), Timeliness (20%), Quality (20%), Outcome (20%)
 */
export function calculateProjectScore(m: ProjectMetrics): ComponentBreakdown {
  if (!m.hasProjects || m.totalItems <= 0) {
    return {
      score: 100,
      weight: 20,
      weightedScore: 20,
      applicable: false,
      subcomponents: {
        assignedWork: { score: 100, weight: 40, value: 'None' },
        timeliness: { score: 100, weight: 20, value: 'None' },
        quality: { score: 100, weight: 20, value: 'None' },
        outcome: { score: 100, weight: 20, value: 'None' },
      },
    };
  }

  const assignedWork = (m.completedItems / m.totalItems) * 100;
  const timeliness = m.completedItems > 0 ? (m.onTimeItems / m.completedItems) * 100 : 100;
  const quality = clamp(m.qualityScore);
  const outcome = clamp(m.outcomeScore);

  const score = clamp(
    round2(
      assignedWork * 0.40 +
      timeliness * 0.20 +
      quality * 0.20 +
      outcome * 0.20
    )
  );

  return {
    score,
    weight: 20,
    weightedScore: round2(score * 0.20),
    applicable: true,
    subcomponents: {
      assignedWork: { score: round2(assignedWork), weight: 40, value: `${m.completedItems}/${m.totalItems}` },
      timeliness: { score: round2(timeliness), weight: 20, value: `${m.onTimeItems}/${m.completedItems}` },
      quality: { score: round2(quality), weight: 20 },
      outcome: { score: round2(outcome), weight: 20 },
    },
  };
}

/**
 * Calculate Complete Employee / EA / PA AT Score (0-100)
 */
export function calculateEmployeeAtScore(
  selfAction: SelfActionMetrics,
  task: TaskMetrics,
  project: ProjectMetrics,
): AtScoreResult {
  const sa = calculateSelfActionScore(selfAction);
  const tk = calculateTaskScore(task);
  const pr = calculateProjectScore(project);

  let finalScore: number;
  let isNormalized = false;

  if (!pr.applicable) {
    // Normalization rule: redistribute 20% across Self Actions (62.5%) and Tasks (37.5%)
    isNormalized = true;
    sa.weight = 62.5;
    tk.weight = 37.5;
    pr.weight = 0;
    sa.weightedScore = round2(sa.score * 0.625);
    tk.weightedScore = round2(tk.score * 0.375);
    pr.weightedScore = 0;
    finalScore = clamp(round2(sa.weightedScore + tk.weightedScore));
  } else {
    finalScore = clamp(round2(sa.weightedScore + tk.weightedScore + pr.weightedScore));
  }

  return {
    score: finalScore,
    status: 'CALCULATED',
    isNormalized,
    components: {
      selfAction: sa,
      assignedTask: tk,
      project: pr,
    },
  };
}

/**
 * Calculate HOD AT Score (0-100)
 * Personal Execution (40%), Department Execution (35%), Projects (15%), Leadership (10%)
 */
export function calculateHodAtScore(
  personalResult: AtScoreResult,
  dept: DepartmentExecutionMetrics,
  project: ProjectMetrics,
  leadership: LeadershipMetrics,
): AtScoreResult {
  const personalScore = personalResult.score;

  // Department Execution Score:
  // Completion (50%), On-Time (30%), Overdue Health (20%)
  const completionRate = dept.totalTasks > 0 ? (dept.completedTasks / dept.totalTasks) * 100 : 100;
  const onTimeRate = dept.completedTasks > 0 ? (dept.onTimeTasks / dept.completedTasks) * 100 : 100;
  const overdueRate = dept.totalTasks > 0 ? (dept.overdueTasks / dept.totalTasks) * 100 : 0;
  const healthRate = clamp(100 - overdueRate);

  const deptScore = clamp(
    round2(
      completionRate * 0.50 +
      onTimeRate * 0.30 +
      healthRate * 0.20
    )
  );

  const deptComponent: ComponentBreakdown = {
    score: deptScore,
    weight: 35,
    weightedScore: round2(deptScore * 0.35),
    applicable: dept.totalTasks > 0,
    subcomponents: {
      completionRate: { score: round2(completionRate), weight: 50, value: `${dept.completedTasks}/${dept.totalTasks}` },
      onTimeRate: { score: round2(onTimeRate), weight: 30, value: `${dept.onTimeTasks}/${dept.completedTasks}` },
      healthRate: { score: round2(healthRate), weight: 20, value: `${dept.overdueTasks} overdue` },
    },
  };

  // Projects component (15%)
  const pr = calculateProjectScore(project);
  pr.weight = 15;
  pr.weightedScore = round2(pr.score * 0.15);

  // Leadership component (10%)
  // Review turnaround: <=24h = 100, <=48h = 80, >48h = 50, no reviews = 100
  let reviewScore = 100;
  if (leadership.avgReviewHours !== null) {
    if (leadership.avgReviewHours <= 24) reviewScore = 100;
    else if (leadership.avgReviewHours <= 48) reviewScore = 80;
    else reviewScore = 50;
  }
  const requestResolution = leadership.totalRequests > 0
    ? (leadership.requestsHandled / leadership.totalRequests) * 100
    : 100;
  const leadershipScore = clamp(round2(reviewScore * 0.60 + requestResolution * 0.40));

  const leadComponent: ComponentBreakdown = {
    score: leadershipScore,
    weight: 10,
    weightedScore: round2(leadershipScore * 0.10),
    applicable: true,
    subcomponents: {
      reviewTurnaround: {
        score: round2(reviewScore),
        weight: 60,
        value: leadership.avgReviewHours !== null ? `${Math.round(leadership.avgReviewHours)}h avg` : 'No reviews',
      },
      requestResolution: {
        score: round2(requestResolution),
        weight: 40,
        value: `${leadership.requestsHandled}/${leadership.totalRequests}`,
      },
    },
  };

  let finalScore: number;
  let isNormalized = false;

  if (!pr.applicable) {
    // Normalization rule: redistribute 15% across Personal (47.06%), Dept (41.18%), Leadership (11.76%)
    isNormalized = true;
    const personalWeight = 47.06;
    const deptWeight = 41.18;
    const leadWeight = 11.76;
    pr.weight = 0;
    pr.weightedScore = 0;

    const personalWeighted = round2((personalScore * personalWeight) / 100);
    const deptWeighted = round2((deptScore * deptWeight) / 100);
    const leadWeighted = round2((leadershipScore * leadWeight) / 100);

    finalScore = clamp(round2(personalWeighted + deptWeighted + leadWeighted));
  } else {
    finalScore = clamp(
      round2(
        personalScore * 0.40 +
        deptComponent.weightedScore +
        pr.weightedScore +
        leadComponent.weightedScore
      )
    );
  }

  return {
    score: finalScore,
    status: 'CALCULATED',
    isNormalized,
    components: {
      selfAction: personalResult.components.selfAction,
      assignedTask: personalResult.components.assignedTask,
      project: pr,
      departmentExecution: deptComponent,
      leadership: leadComponent,
    },
  };
}
