// src/modules/hod-score/hod-score.service.ts

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, role_enum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { DepartmentScopeService } from '../../common/services/department-scope.service';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import {
  HOD_SCORE_CACHE_TTL_SECONDS,
  HOD_SCORE_CACHE_VERSION,
  HOD_SCORE_COMPONENTS,
  HodScoreComponent,
  MIN_SCORE_YEAR,
  SCORE_TIMEZONE,
  TASKS_PER_EMPLOYEE_TARGET,
  TREND_MONTHS,
} from './hod-score.constants';
import {
  CompanyScoreResponse,
  DepartmentScoreResponse,
  HodScoreBreakdown,
  HodScoreRecord,
  HodScoreResponse,
  HodScoreTrendPoint,
  TrendsResponse,
} from './dto/hod-score-response.dto';
import { HodScoreQueryDto } from './dto/hod-score-query.dto';
import { HodScoreTrendsQueryDto } from './dto/hod-score-trends-query.dto';

/** Shape returned by the aggregate SQL - one row per HOD. */
interface MatrixRow {
  hod_id: string;
  hod_name: string;
  department_ids: string[];
  department_names: string[];
  primary_department_id: string | null;
  primary_department_name: string | null;
  employee_count: number;
  working_days: number;
  created_tasks: number;
  expected_tasks: number;
  self_actions_total: number;
  self_actions_completed: number;
  self_action_days: number;
  dept_tasks_total: number;
  dept_tasks_completed: number;
  dept_tasks_pending: number;
  dept_tasks_overdue: number;
  active_days: number;
  features_used: number;
  reviewed_tasks: number;
  avg_review_hours: number | null;
  requests_reviewed: number;
  avg_request_hours: number | null;
  task_creation_score: number | null;
  self_action_score: number | null;
  dept_completion_score: number | null;
  dept_health_score: number | null;
  active_participation_score: number | null;
  leadership_score: number | null;
  final_score: number | null;
  department_rank: number | null;
  department_total: number;
  company_rank: number | null;
  company_total: number;
}

interface Period {
  month: number;
  year: number;
}

/** Request metadata captured for the access audit trail. */
export interface AccessContext {
  ip?: string | null;
}

@Injectable()
export class HodScoreService {
  private readonly logger = new Logger(HodScoreService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly departmentScopeService: DepartmentScopeService,
  ) {}

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Score for the authenticated HOD. Identity always comes from the JWT.
   */
  async getMyScore(
    user: JwtPayload,
    query: HodScoreQueryDto,
    context: AccessContext = {},
  ): Promise<HodScoreResponse> {
    if (user.role !== role_enum.HOD) {
      throw new ForbiddenException(
        'Only a HOD has a personal HOD score. Use /hod-score/company or /hod-score/:hodId.',
      );
    }
    const period = this.resolvePeriod(query);
    const result = await this.buildScoreResponse(user.sub, period);
    this.recordAccess(user, context, 'VIEW_OWN_HOD_SCORE', user.sub, period);
    return result;
  }

  /**
   * Score for a specific HOD, subject to the caller's visibility.
   */
  async getHodScore(
    user: JwtPayload,
    hodId: string,
    query: HodScoreQueryDto,
    context: AccessContext = {},
  ): Promise<HodScoreResponse> {
    await this.assertCanViewHod(user, hodId);
    const period = this.resolvePeriod(query);
    const result = await this.buildScoreResponse(hodId, period);
    this.recordAccess(user, context, 'VIEW_HOD_SCORE', hodId, period);
    return result;
  }

  /**
   * Every HOD attached to a department, plus that department's aggregate.
   */
  async getDepartmentScore(
    user: JwtPayload,
    departmentId: string,
    query: HodScoreQueryDto,
    context: AccessContext = {},
  ): Promise<DepartmentScoreResponse> {
    await this.assertCanViewDepartment(user, departmentId);

    const period = this.resolvePeriod(query);
    const matrix = await this.getMatrix(period);

    const department = await this.prisma.departments.findUnique({
      where: { id: departmentId },
      select: { id: true, name: true },
    });
    if (!department) throw new NotFoundException('Department not found');

    const visible = (await this.filterVisible(user, matrix)).filter((row) =>
      row.departments.some((d) => d.id === departmentId),
    );

    this.recordAccess(user, context, 'VIEW_DEPARTMENT_SCORE', departmentId, period);

    return {
      department,
      month: period.month,
      year: period.year,
      departmentScore: this.average(visible.filter((r) => r.hasData).map((r) => r.score)),
      hodCount: visible.length,
      averageBreakdown: this.averageBreakdown(visible),
      hods: visible,
    };
  }

  /**
   * Company-wide ranking, already narrowed to what the caller may see.
   */
  async getCompanyScores(
    user: JwtPayload,
    query: HodScoreQueryDto,
    context: AccessContext = {},
  ): Promise<CompanyScoreResponse> {
    const period = this.resolvePeriod(query);
    const matrix = await this.getMatrix(period);
    const visible = await this.filterVisible(user, matrix);

    this.recordAccess(user, context, 'VIEW_COMPANY_HOD_SCORES', user.sub, period);

    return {
      month: period.month,
      year: period.year,
      companyAverage: this.average(visible.filter((r) => r.hasData).map((r) => r.score)),
      hodCount: visible.length,
      hods: visible,
    };
  }

  /**
   * Monthly trend for a HOD, a department, or the visible company average.
   *
   * Each month is a single aggregated query served from cache when warm; there
   * is no per-row query anywhere in this path.
   */
  async getTrends(user: JwtPayload, query: HodScoreTrendsQueryDto): Promise<TrendsResponse> {
    const period = this.resolvePeriod(query);
    const months = query.months ?? TREND_MONTHS;

    let scope: TrendsResponse['scope'] = 'company';
    let hodId: string | null = null;
    let departmentId: string | null = null;

    if (query.hodId) {
      await this.assertCanViewHod(user, query.hodId);
      hodId = query.hodId;
      scope = query.hodId === user.sub ? 'self' : 'hod';
    } else if (query.departmentId) {
      await this.assertCanViewDepartment(user, query.departmentId);
      departmentId = query.departmentId;
      scope = 'department';
    } else if (user.role === role_enum.HOD) {
      hodId = user.sub;
      scope = 'self';
    }

    const trend = await this.buildTrend(user, { hodId, departmentId }, period, months);

    return { scope, hodId, departmentId, months, trend };
  }

  /**
   * Drop the cached matrix for a period so the next read recomputes.
   *
   * Call from task / self-action / department write paths. Invalidating the
   * current month only is the common case; pass a period for backfills.
   */
  async invalidatePeriod(period?: Period): Promise<void> {
    const target = period ?? this.currentPeriod();
    await this.redis.del(this.cacheKey(target));
  }

  // ---------------------------------------------------------------------------
  // Audit trail
  // ---------------------------------------------------------------------------

  /**
   * Append a read to the existing audit_logs table.
   *
   * Fire-and-forget: an audit failure must never fail the request or leak a
   * database error to the caller. Only the viewer's identity, role, department
   * scope and requested period are stored - never token contents or scores.
   */
  private recordAccess(
    user: JwtPayload,
    context: AccessContext,
    action: string,
    entityId: string,
    period: Period,
  ): void {
    const payload = {
      role: user.role,
      departmentIds: user.departmentIds ?? [],
      month: period.month,
      year: period.year,
    };

    void this.prisma.audit_logs
      .create({
        data: {
          user_id: user.sub,
          action,
          entity: 'hod_score',
          entity_id: entityId,
          new_value: JSON.stringify(payload),
          ip_address: this.normalizeIp(context.ip),
        },
      })
      .catch((error) => {
        this.logger.warn(
          `Failed to write HOD score audit log: ${(error as Error)?.message ?? error}`,
        );
      });
  }

  private normalizeIp(ip?: string | null): string | null {
    if (!ip) return null;
    return ip.slice(0, 100);
  }

  // ---------------------------------------------------------------------------
  // Aggregate computation
  // ---------------------------------------------------------------------------

  /**
   * Compute (or read from cache) every HOD's score for a period.
   *
   * One SQL statement: all six components, all counters and both ranks are
   * aggregated inside PostgreSQL. Nothing is calculated in JavaScript beyond
   * shaping the rows into the response DTO.
   */
  private async getMatrix(period: Period): Promise<HodScoreRecord[]> {
    const key = this.cacheKey(period);

    const cached = await this.redis.get<HodScoreRecord[]>(key);
    if (cached) return cached;

    const rows = await this.queryMatrix(period);
    const records = rows.map((row) => this.toRecord(row, period));

    await this.redis.set(key, records, HOD_SCORE_CACHE_TTL_SECONDS);
    return records;
  }

  private async queryMatrix(period: Period): Promise<MatrixRow[]> {
    const { month, year } = period;
    const tz = SCORE_TIMEZONE;
    const target = TASKS_PER_EMPLOYEE_TARGET;

    return this.prisma.$queryRaw<MatrixRow[]>(Prisma.sql`
      WITH params AS (
        SELECT
          ((make_date(${year}::int, ${month}::int, 1))::timestamp AT TIME ZONE ${tz}::text) AS month_start,
          ((make_date(${year}::int, ${month}::int, 1) + INTERVAL '1 month')::timestamp AT TIME ZONE ${tz}::text) AS month_end,
          ${tz}::text AS tz,
          NOW() AS now_ts,
          ${target}::numeric AS per_employee_target
      ),

      -- Active HODs and the active departments they currently lead.
      hod_base AS (
        SELECT
          u.id AS hod_id,
          u.full_name AS hod_name,
          u.created_at AS hod_created_at,
          ARRAY_AGG(DISTINCT hd.department_id) AS department_ids,
          (ARRAY_AGG(d.id ORDER BY d.sort_order, d.name))[1] AS primary_department_id,
          (ARRAY_AGG(d.name ORDER BY d.sort_order, d.name))[1] AS primary_department_name,
          ARRAY_AGG(DISTINCT d.name) AS department_names
        FROM users u
        JOIN hod_departments hd ON hd.hod_id = u.id
        JOIN departments d ON d.id = hd.department_id AND d.is_active = TRUE
        WHERE u.role = 'HOD'
          AND u.deleted_at IS NULL
          AND COALESCE(u.is_active, TRUE) = TRUE
        GROUP BY u.id, u.full_name, u.created_at
      ),

      -- Scoring window: clipped to the account start (new HOD) and to now
      -- (partial / in-flight month) so targets are never inflated.
      hod_window AS (
        SELECT
          hb.hod_id,
          GREATEST(p.month_start, COALESCE(hb.hod_created_at, p.month_start)) AS win_start,
          LEAST(p.month_end, p.now_ts) AS win_end
        FROM hod_base hb CROSS JOIN params p
      ),

      working_days AS (
        SELECT
          hw.hod_id,
          COALESCE(SUM(CASE WHEN EXTRACT(ISODOW FROM gs.d) < 6 THEN 1 ELSE 0 END), 0)::int AS working_days
        FROM hod_window hw
        CROSS JOIN params p
        LEFT JOIN LATERAL generate_series(
          date_trunc('day', hw.win_start AT TIME ZONE p.tz),
          GREATEST(
            date_trunc('day', hw.win_start AT TIME ZONE p.tz),
            (hw.win_end AT TIME ZONE p.tz) - INTERVAL '1 microsecond'
          ),
          INTERVAL '1 day'
        ) AS gs(d) ON hw.win_end > hw.win_start
        GROUP BY hw.hod_id
      ),

      -- Weekdays in the whole month, used to pro-rate month-long targets so an
      -- in-flight month is not scored against a full month's expectation.
      month_working_days AS (
        SELECT
          COALESCE(SUM(CASE WHEN EXTRACT(ISODOW FROM gs.d) < 6 THEN 1 ELSE 0 END), 0)::int AS full_working_days
        FROM params p
        CROSS JOIN generate_series(
          date_trunc('day', p.month_start AT TIME ZONE p.tz),
          (p.month_end AT TIME ZONE p.tz) - INTERVAL '1 microsecond',
          INTERVAL '1 day'
        ) AS gs(d)
      ),

      employee_counts AS (
        SELECT hb.hod_id, COUNT(DISTINCT e.id)::int AS employee_count
        FROM hod_base hb
        LEFT JOIN users e
          ON e.department_id = ANY(hb.department_ids)
         AND e.role = 'EMPLOYEE'
         AND COALESCE(e.is_active, TRUE) = TRUE
         AND e.deleted_at IS NULL
        GROUP BY hb.hod_id
      ),

      task_creation AS (
        SELECT hb.hod_id, COUNT(t.id)::int AS created_tasks
        FROM hod_base hb CROSS JOIN params p
        LEFT JOIN tasks t
          ON t.assigned_by_id = hb.hod_id
         AND t.created_at >= p.month_start AND t.created_at < p.month_end
         AND t.deleted_at IS NULL
        GROUP BY hb.hod_id
      ),

      self_action_stats AS (
        SELECT
          hb.hod_id,
          COUNT(sa.id)::int AS self_actions_total,
          COUNT(sa.id) FILTER (WHERE sa.status = 'COMPLETED')::int AS self_actions_completed,
          COUNT(DISTINCT (sa.created_at AT TIME ZONE p.tz)::date)::int AS self_action_days
        FROM hod_base hb CROSS JOIN params p
        LEFT JOIN self_actions sa
          ON sa.created_by_id = hb.hod_id
         AND sa.created_at >= p.month_start AND sa.created_at < p.month_end
         AND sa.deleted_at IS NULL
        GROUP BY hb.hod_id
      ),

      -- Department workload. task_departments is the source of truth for
      -- task -> department (never tasks.department_id). Rejected and
      -- soft-deleted tasks are excluded from both numerator and denominator.
      dept_task_stats AS (
        SELECT
          hb.hod_id,
          COUNT(t.id)::int AS dept_tasks_total,
          COUNT(t.id) FILTER (
            WHERE t.status IN ('COMPLETED','CLOSED','REVIEWED','HOD_VERIFIED')
          )::int AS dept_tasks_completed,
          COUNT(t.id) FILTER (
            WHERE t.status IN ('CREATED','ASSIGNED','PENDING')
          )::int AS dept_tasks_pending,
          COUNT(t.id) FILTER (
            WHERE t.status NOT IN ('COMPLETED','CLOSED','REVIEWED','HOD_VERIFIED')
              AND t.due_date < LEAST(p.month_end, p.now_ts)
          )::int AS dept_tasks_overdue
        FROM hod_base hb CROSS JOIN params p
        LEFT JOIN tasks t
          ON t.deleted_at IS NULL
         AND t.status IS DISTINCT FROM 'REJECTED'
         AND t.created_at >= p.month_start AND t.created_at < p.month_end
         AND EXISTS (
           SELECT 1 FROM task_departments td
           WHERE td.task_id = t.id
             AND td.department_id = ANY(hb.department_ids)
         )
        GROUP BY hb.hod_id
      ),

      -- Days on which the HOD did something meaningful. A bare login is not
      -- meaningful and is deliberately absent from this union.
      activity_days AS (
        SELECT hb.hod_id, (t.created_at AT TIME ZONE p.tz)::date AS d
        FROM hod_base hb CROSS JOIN params p
        JOIN tasks t ON t.assigned_by_id = hb.hod_id AND t.deleted_at IS NULL
         AND t.created_at >= p.month_start AND t.created_at < p.month_end
        UNION
        SELECT hb.hod_id, (t.reviewed_at AT TIME ZONE p.tz)::date
        FROM hod_base hb CROSS JOIN params p
        JOIN tasks t ON t.assigned_by_id = hb.hod_id AND t.deleted_at IS NULL
         AND t.reviewed_at >= p.month_start AND t.reviewed_at < p.month_end
        UNION
        SELECT hb.hod_id, (sa.created_at AT TIME ZONE p.tz)::date
        FROM hod_base hb CROSS JOIN params p
        JOIN self_actions sa ON sa.created_by_id = hb.hod_id AND sa.deleted_at IS NULL
         AND sa.created_at >= p.month_start AND sa.created_at < p.month_end
        UNION
        SELECT hb.hod_id, (tc.created_at AT TIME ZONE p.tz)::date
        FROM hod_base hb CROSS JOIN params p
        JOIN task_comments tc ON tc.user_id = hb.hod_id
         AND tc.created_at >= p.month_start AND tc.created_at < p.month_end
        UNION
        SELECT hb.hod_id, (tt.created_at AT TIME ZONE p.tz)::date
        FROM hod_base hb CROSS JOIN params p
        JOIN task_transfers tt ON tt.initiated_by_id = hb.hod_id
         AND tt.created_at >= p.month_start AND tt.created_at < p.month_end
        UNION
        SELECT hb.hod_id, (tr.reviewed_at AT TIME ZONE p.tz)::date
        FROM hod_base hb CROSS JOIN params p
        JOIN task_requests tr ON tr.reviewed_by_id = hb.hod_id
         AND tr.reviewed_at >= p.month_start AND tr.reviewed_at < p.month_end
      ),

      activity_stats AS (
        SELECT hb.hod_id, COALESCE(COUNT(ad.d), 0)::int AS active_days
        FROM hod_base hb
        LEFT JOIN activity_days ad ON ad.hod_id = hb.hod_id
        GROUP BY hb.hod_id
      ),

      -- Breadth of platform usage: how many of the six capabilities were touched.
      feature_usage AS (
        SELECT
          hb.hod_id,
          (
            (CASE WHEN EXISTS (
              SELECT 1 FROM tasks t WHERE t.assigned_by_id = hb.hod_id AND t.deleted_at IS NULL
                AND t.created_at >= p.month_start AND t.created_at < p.month_end) THEN 1 ELSE 0 END)
          + (CASE WHEN EXISTS (
              SELECT 1 FROM tasks t WHERE t.assigned_by_id = hb.hod_id AND t.deleted_at IS NULL
                AND t.reviewed_at >= p.month_start AND t.reviewed_at < p.month_end) THEN 1 ELSE 0 END)
          + (CASE WHEN EXISTS (
              SELECT 1 FROM self_actions sa WHERE sa.created_by_id = hb.hod_id AND sa.deleted_at IS NULL
                AND sa.created_at >= p.month_start AND sa.created_at < p.month_end) THEN 1 ELSE 0 END)
          + (CASE WHEN EXISTS (
              SELECT 1 FROM task_comments tc WHERE tc.user_id = hb.hod_id
                AND tc.created_at >= p.month_start AND tc.created_at < p.month_end) THEN 1 ELSE 0 END)
          + (CASE WHEN EXISTS (
              SELECT 1 FROM task_transfers tt WHERE tt.initiated_by_id = hb.hod_id
                AND tt.created_at >= p.month_start AND tt.created_at < p.month_end) THEN 1 ELSE 0 END)
          + (CASE WHEN EXISTS (
              SELECT 1 FROM task_requests tr WHERE tr.reviewed_by_id = hb.hod_id
                AND tr.reviewed_at >= p.month_start AND tr.reviewed_at < p.month_end) THEN 1 ELSE 0 END)
          )::int AS features_used
        FROM hod_base hb CROSS JOIN params p
      ),

      leadership_stats AS (
        SELECT
          hb.hod_id,
          AVG(EXTRACT(EPOCH FROM (t.reviewed_at - t.completed_at)) / 3600.0)
            FILTER (WHERE t.reviewed_at IS NOT NULL AND t.completed_at IS NOT NULL
                      AND t.reviewed_at >= t.completed_at) AS avg_review_hours,
          COUNT(t.id) FILTER (WHERE t.reviewed_at IS NOT NULL AND t.completed_at IS NOT NULL
                      AND t.reviewed_at >= t.completed_at)::int AS reviewed_tasks
        FROM hod_base hb CROSS JOIN params p
        LEFT JOIN tasks t
          ON t.assigned_by_id = hb.hod_id
         AND t.deleted_at IS NULL
         AND t.reviewed_at >= p.month_start AND t.reviewed_at < p.month_end
        GROUP BY hb.hod_id
      ),

      request_response AS (
        SELECT
          hb.hod_id,
          AVG(EXTRACT(EPOCH FROM (tr.reviewed_at - tr.created_at)) / 3600.0)
            FILTER (WHERE tr.reviewed_at >= tr.created_at) AS avg_request_hours,
          COUNT(tr.id)::int AS requests_reviewed
        FROM hod_base hb CROSS JOIN params p
        LEFT JOIN task_requests tr
          ON tr.reviewed_by_id = hb.hod_id
         AND tr.reviewed_at >= p.month_start AND tr.reviewed_at < p.month_end
        GROUP BY hb.hod_id
      ),

      -- Component scores. NULL means NEUTRAL: no data existed, so the component
      -- is excluded from the weighted average instead of being scored zero.
      computed AS (
        SELECT
          hb.hod_id,
          hb.hod_name,
          hb.department_ids,
          hb.department_names,
          hb.primary_department_id,
          hb.primary_department_name,
          ec.employee_count,
          wd.working_days,
          tc.created_tasks,
          -- Target scales with headcount and with how much of the month has
          -- actually elapsed for this HOD.
          (
            ec.employee_count * p.per_employee_target
            * (wd.working_days::numeric / NULLIF(mwd.full_working_days, 0))
          )::numeric AS expected_tasks,
          sas.self_actions_total,
          sas.self_actions_completed,
          sas.self_action_days,
          dts.dept_tasks_total,
          dts.dept_tasks_completed,
          dts.dept_tasks_pending,
          dts.dept_tasks_overdue,
          acs.active_days,
          fu.features_used,
          ls.reviewed_tasks,
          ls.avg_review_hours,
          rr.requests_reviewed,
          rr.avg_request_hours,

          -- 1. Task creation (25%) - size adjusted, capped at 100.
          CASE
            WHEN ec.employee_count = 0 OR wd.working_days = 0 THEN NULL
            ELSE LEAST(
              (
                tc.created_tasks::numeric
                / NULLIF(
                    ec.employee_count * p.per_employee_target
                    * (wd.working_days::numeric / NULLIF(mwd.full_working_days, 0)),
                    0
                  )
              ) * 100,
              100
            )
          END AS task_creation_score,

          -- 2. Self actions (20%) - 70% completion, 30% consistency.
          CASE
            WHEN sas.self_actions_total = 0 OR wd.working_days = 0 THEN NULL
            ELSE
              0.7 * (sas.self_actions_completed::numeric / NULLIF(sas.self_actions_total, 0) * 100)
            + 0.3 * (LEAST(sas.self_action_days::numeric / NULLIF(wd.working_days, 0), 1) * 100)
          END AS self_action_score,

          -- 3. Department completion (25%).
          CASE
            WHEN dts.dept_tasks_total = 0 THEN NULL
            ELSE dts.dept_tasks_completed::numeric / NULLIF(dts.dept_tasks_total, 0) * 100
          END AS dept_completion_score,

          -- 4. Department health (15%) - penalise pending and overdue, floor at 0.
          CASE
            WHEN dts.dept_tasks_total = 0 THEN NULL
            ELSE GREATEST(0, LEAST(100,
              100
              - (dts.dept_tasks_pending::numeric / NULLIF(dts.dept_tasks_total, 0) * 100) * 0.5
              - (dts.dept_tasks_overdue::numeric / NULLIF(dts.dept_tasks_total, 0) * 100) * 1.5
            ))
          END AS dept_health_score,

          -- 5. Active participation (10%) - 70% active days, 30% feature breadth.
          CASE
            WHEN wd.working_days = 0 THEN NULL
            ELSE
              0.7 * LEAST(acs.active_days::numeric / NULLIF(wd.working_days, 0) * 100, 100)
            + 0.3 * (fu.features_used::numeric / 6 * 100)
          END AS active_participation_score,

          -- 6. Leadership bonus (5%) - responsiveness on reviews and requests.
          CASE
            WHEN COALESCE(ls.reviewed_tasks, 0) = 0 AND COALESCE(rr.requests_reviewed, 0) = 0 THEN NULL
            ELSE LEAST(100, GREATEST(0,
              100
              - COALESCE(ls.avg_review_hours, 0) * 1.5
              - COALESCE(rr.avg_request_hours, 0) * 0.5
            ))
          END AS leadership_score

        FROM hod_base hb
        CROSS JOIN params p
        CROSS JOIN month_working_days mwd
        LEFT JOIN employee_counts ec ON ec.hod_id = hb.hod_id
        LEFT JOIN working_days wd ON wd.hod_id = hb.hod_id
        LEFT JOIN task_creation tc ON tc.hod_id = hb.hod_id
        LEFT JOIN self_action_stats sas ON sas.hod_id = hb.hod_id
        LEFT JOIN dept_task_stats dts ON dts.hod_id = hb.hod_id
        LEFT JOIN activity_stats acs ON acs.hod_id = hb.hod_id
        LEFT JOIN feature_usage fu ON fu.hod_id = hb.hod_id
        LEFT JOIN leadership_stats ls ON ls.hod_id = hb.hod_id
        LEFT JOIN request_response rr ON rr.hod_id = hb.hod_id
      ),

      -- Redistribute the weight of every NEUTRAL component across the rest.
      weighted AS (
        SELECT
          c.*,
          (
            (CASE WHEN c.task_creation_score        IS NULL THEN 0 ELSE 0.25 END)
          + (CASE WHEN c.self_action_score          IS NULL THEN 0 ELSE 0.20 END)
          + (CASE WHEN c.dept_completion_score      IS NULL THEN 0 ELSE 0.25 END)
          + (CASE WHEN c.dept_health_score          IS NULL THEN 0 ELSE 0.15 END)
          + (CASE WHEN c.active_participation_score IS NULL THEN 0 ELSE 0.10 END)
          + (CASE WHEN c.leadership_score           IS NULL THEN 0 ELSE 0.05 END)
          )::numeric AS total_weight,
          (
            COALESCE(c.task_creation_score, 0)        * (CASE WHEN c.task_creation_score        IS NULL THEN 0 ELSE 0.25 END)
          + COALESCE(c.self_action_score, 0)          * (CASE WHEN c.self_action_score          IS NULL THEN 0 ELSE 0.20 END)
          + COALESCE(c.dept_completion_score, 0)      * (CASE WHEN c.dept_completion_score      IS NULL THEN 0 ELSE 0.25 END)
          + COALESCE(c.dept_health_score, 0)          * (CASE WHEN c.dept_health_score          IS NULL THEN 0 ELSE 0.15 END)
          + COALESCE(c.active_participation_score, 0) * (CASE WHEN c.active_participation_score IS NULL THEN 0 ELSE 0.10 END)
          + COALESCE(c.leadership_score, 0)           * (CASE WHEN c.leadership_score           IS NULL THEN 0 ELSE 0.05 END)
          )::numeric AS weighted_sum
        FROM computed c
      ),

      scored AS (
        SELECT
          w.*,
          CASE
            WHEN w.total_weight = 0 THEN NULL
            ELSE ROUND(w.weighted_sum / w.total_weight, 2)
          END AS final_score
        FROM weighted w
      )

      SELECT
        s.hod_id,
        s.hod_name,
        s.department_ids,
        s.department_names,
        s.primary_department_id,
        s.primary_department_name,
        s.employee_count,
        s.working_days,
        s.created_tasks,
        s.expected_tasks::float8            AS expected_tasks,
        s.self_actions_total,
        s.self_actions_completed,
        s.self_action_days,
        s.dept_tasks_total,
        s.dept_tasks_completed,
        s.dept_tasks_pending,
        s.dept_tasks_overdue,
        s.active_days,
        s.features_used,
        s.reviewed_tasks,
        ROUND(s.avg_review_hours, 2)::float8   AS avg_review_hours,
        s.requests_reviewed,
        ROUND(s.avg_request_hours, 2)::float8  AS avg_request_hours,
        ROUND(s.task_creation_score, 2)::float8        AS task_creation_score,
        ROUND(s.self_action_score, 2)::float8          AS self_action_score,
        ROUND(s.dept_completion_score, 2)::float8      AS dept_completion_score,
        ROUND(s.dept_health_score, 2)::float8          AS dept_health_score,
        ROUND(s.active_participation_score, 2)::float8 AS active_participation_score,
        ROUND(s.leadership_score, 2)::float8           AS leadership_score,
        s.final_score::float8                          AS final_score,
        CASE WHEN s.final_score IS NULL THEN NULL ELSE
          RANK() OVER (PARTITION BY s.primary_department_id ORDER BY s.final_score DESC NULLS LAST)
        END::int AS department_rank,
        COUNT(*) OVER (PARTITION BY s.primary_department_id)::int AS department_total,
        CASE WHEN s.final_score IS NULL THEN NULL ELSE
          RANK() OVER (ORDER BY s.final_score DESC NULLS LAST)
        END::int AS company_rank,
        COUNT(*) OVER ()::int AS company_total
      FROM scored s
      ORDER BY s.final_score DESC NULLS LAST, s.hod_name ASC
    `);
  }

  // ---------------------------------------------------------------------------
  // Shaping
  // ---------------------------------------------------------------------------

  private toRecord(row: MatrixRow, period: Period): HodScoreRecord {
    const breakdown: HodScoreBreakdown = {
      taskCreation: this.nullableNumber(row.task_creation_score),
      selfAction: this.nullableNumber(row.self_action_score),
      departmentCompletion: this.nullableNumber(row.dept_completion_score),
      departmentHealth: this.nullableNumber(row.dept_health_score),
      activeParticipation: this.nullableNumber(row.active_participation_score),
      leadershipBonus: this.nullableNumber(row.leadership_score),
    };

    const neutralComponents = HOD_SCORE_COMPONENTS.filter(
      (component) => breakdown[component] === null,
    ) as HodScoreComponent[];

    const departmentIds = row.department_ids ?? [];
    const departmentNames = row.department_names ?? [];
    const departments = departmentIds.map((id, index) => ({
      id,
      name: departmentNames[index] ?? '',
    }));

    const finalScore = this.nullableNumber(row.final_score);

    return {
      hodId: row.hod_id,
      hodName: row.hod_name,
      departments,
      primaryDepartment: row.primary_department_id
        ? { id: row.primary_department_id, name: row.primary_department_name ?? '' }
        : null,
      month: period.month,
      year: period.year,
      score: finalScore ?? 0,
      hasData: finalScore !== null,
      departmentRank: row.department_rank ?? null,
      departmentTotal: Number(row.department_total ?? 0),
      companyRank: row.company_rank ?? null,
      companyTotal: Number(row.company_total ?? 0),
      breakdown,
      neutralComponents,
      metrics: {
        employeeCount: Number(row.employee_count ?? 0),
        workingDays: Number(row.working_days ?? 0),
        createdTasks: Number(row.created_tasks ?? 0),
        expectedTasks: Number(row.expected_tasks ?? 0),
        selfActionsTotal: Number(row.self_actions_total ?? 0),
        selfActionsCompleted: Number(row.self_actions_completed ?? 0),
        selfActionDays: Number(row.self_action_days ?? 0),
        departmentTasksTotal: Number(row.dept_tasks_total ?? 0),
        departmentTasksCompleted: Number(row.dept_tasks_completed ?? 0),
        departmentTasksPending: Number(row.dept_tasks_pending ?? 0),
        departmentTasksOverdue: Number(row.dept_tasks_overdue ?? 0),
        activeDays: Number(row.active_days ?? 0),
        featuresUsed: Number(row.features_used ?? 0),
        reviewedTasks: Number(row.reviewed_tasks ?? 0),
        avgReviewHours: this.nullableNumber(row.avg_review_hours),
        requestsReviewed: Number(row.requests_reviewed ?? 0),
        avgRequestResponseHours: this.nullableNumber(row.avg_request_hours),
      },
    };
  }

  private async buildScoreResponse(hodId: string, period: Period): Promise<HodScoreResponse> {
    const matrix = await this.getMatrix(period);
    const record = matrix.find((row) => row.hodId === hodId);

    if (!record) {
      throw new NotFoundException('No HOD score available for this user and period');
    }

    const trend = await this.buildTrend(null, { hodId, departmentId: null }, period, TREND_MONTHS);
    return { ...record, trend };
  }

  /**
   * Walk back `months` periods and pull the relevant figure from each matrix.
   * Every month is one cached aggregate query.
   */
  private async buildTrend(
    user: JwtPayload | null,
    target: { hodId: string | null; departmentId: string | null },
    period: Period,
    months: number,
  ): Promise<HodScoreTrendPoint[]> {
    const periods = this.previousPeriods(period, months);
    const matrices = await Promise.all(
      periods.map(async (p) => ({ period: p, rows: await this.getMatrix(p) })),
    );

    const points: HodScoreTrendPoint[] = [];

    for (const entry of matrices) {
      const p = entry.period;
      const rows = user ? await this.filterVisible(user, entry.rows) : entry.rows;

      let score: number | null;
      if (target.hodId) {
        const row = rows.find((r) => r.hodId === target.hodId);
        score = row?.hasData ? row.score : null;
      } else if (target.departmentId) {
        const scoped = rows.filter(
          (r) => r.hasData && r.departments.some((d) => d.id === target.departmentId),
        );
        score = this.average(scoped.map((r) => r.score));
      } else {
        score = this.average(rows.filter((r) => r.hasData).map((r) => r.score));
      }

      points.push({ month: p.month, year: p.year, label: this.periodLabel(p), score });
    }

    return points;
  }

  // ---------------------------------------------------------------------------
  // Authorization
  // ---------------------------------------------------------------------------

  /**
   * Narrow a computed matrix to the rows the caller is allowed to see.
   *
   * - MD / EA / PA: unrestricted (per DepartmentScopeService)
   * - DEPARTMENT_CONTROLLER: HODs of its assigned departments
   * - HOD: itself only
   */
  private async filterVisible(
    user: JwtPayload,
    matrix: HodScoreRecord[],
  ): Promise<HodScoreRecord[]> {
    if (user.role === role_enum.HOD) {
      return matrix.filter((row) => row.hodId === user.sub);
    }

    const scope = await this.departmentScopeService.resolveDepartmentScope(user);
    if (scope.unrestricted) return matrix;

    if (!scope.departmentIds.length) return [];

    return matrix.filter((row) =>
      row.departments.some((d) => scope.departmentIds.includes(d.id)),
    );
  }

  private async assertCanViewHod(user: JwtPayload, hodId: string): Promise<void> {
    if (user.role === role_enum.HOD) {
      if (hodId !== user.sub) {
        throw new ForbiddenException('You can only view your own HOD score');
      }
      return;
    }

    const scope = await this.departmentScopeService.resolveDepartmentScope(user);
    if (scope.unrestricted) return;

    const departments = await this.prisma.hod_departments.findMany({
      where: { hod_id: hodId },
      select: { department_id: true },
    });

    const allowed = departments.some((d) => scope.departmentIds.includes(d.department_id));
    if (!allowed) {
      throw new ForbiddenException('Access denied');
    }
  }

  private async assertCanViewDepartment(user: JwtPayload, departmentId: string): Promise<void> {
    if (user.role === role_enum.HOD) {
      const owned = await this.prisma.hod_departments.findFirst({
        where: { hod_id: user.sub, department_id: departmentId },
        select: { id: true },
      });
      if (!owned) {
        throw new ForbiddenException('You can only view your own department');
      }
      return;
    }

    const hasAccess = await this.departmentScopeService.hasAnyDepartmentAccess(user, [
      departmentId,
    ]);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }
  }

  // ---------------------------------------------------------------------------
  // Period helpers
  // ---------------------------------------------------------------------------

  /**
   * Resolve and validate the requested period. Defaults to the current month in
   * the business timezone; future periods are rejected.
   */
  private resolvePeriod(query: HodScoreQueryDto): Period {
    const current = this.currentPeriod();

    const month = query.month ?? current.month;
    const year = query.year ?? current.year;

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('month must be an integer between 1 and 12');
    }
    if (!Number.isInteger(year) || year < MIN_SCORE_YEAR || year > current.year + 1) {
      throw new BadRequestException('year is out of range');
    }
    if (year > current.year || (year === current.year && month > current.month)) {
      throw new BadRequestException('Cannot score a future period');
    }

    return { month, year };
  }

  /** Current month/year in the business timezone, not the server timezone. */
  private currentPeriod(): Period {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: SCORE_TIMEZONE,
      year: 'numeric',
      month: 'numeric',
    }).formatToParts(new Date());

    const year = Number(parts.find((p) => p.type === 'year')?.value);
    const month = Number(parts.find((p) => p.type === 'month')?.value);

    return { month, year };
  }

  private previousPeriods(period: Period, months: number): Period[] {
    const list: Period[] = [];
    let { month, year } = period;

    for (let i = 0; i < months; i += 1) {
      list.unshift({ month, year });
      month -= 1;
      if (month === 0) {
        month = 12;
        year -= 1;
      }
    }

    return list.filter((p) => p.year >= MIN_SCORE_YEAR);
  }

  private periodLabel(period: Period): string {
    const date = new Date(Date.UTC(period.year, period.month - 1, 1));
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  private cacheKey(period: Period): string {
    return `hod-score:${HOD_SCORE_CACHE_VERSION}:${period.year}:${period.month}`;
  }

  // ---------------------------------------------------------------------------
  // Small numeric helpers
  // ---------------------------------------------------------------------------

  private nullableNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  private average(values: number[]): number | null {
    if (!values.length) return null;
    const sum = values.reduce((acc, value) => acc + value, 0);
    return Math.round((sum / values.length) * 100) / 100;
  }

  private averageBreakdown(records: HodScoreRecord[]): HodScoreBreakdown {
    const result = {} as HodScoreBreakdown;

    for (const component of HOD_SCORE_COMPONENTS) {
      const values = records
        .map((record) => record.breakdown[component])
        .filter((value): value is number => value !== null);
      result[component] = this.average(values);
    }

    return result;
  }
}
