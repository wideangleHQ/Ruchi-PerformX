import { Injectable } from '@nestjs/common';
import {
  Prisma,
  request_status_enum,
  role_enum,
  task_status_enum,
  task_type_enum,
  transfer_status_enum,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { DepartmentScopeService } from '../../common/services/department-scope.service';
import { DepartmentQueryHelper } from '../../common/helpers/department-query.helper';
// The business timezone, not a scoring detail. Birthday and holiday boundaries
// have to fall where the office falls, not where the database server does.
import { SCORE_TIMEZONE } from '../hod-score/hod-score.constants';
import { PollsService } from '../polls/polls.service';

type DepartmentScope = Awaited<ReturnType<DepartmentScopeService['resolveDepartmentScope']>>;

interface BirthdayRow {
  id: string;
  full_name: string;
  department_name: string | null;
}

interface UpcomingHolidayRow {
  id: string;
  name: string;
  holiday_date: Date;
  days_away: number;
}

// One screen's worth. The dashboard is one call by design, so a long list gets
// trimmed here rather than moved to its own endpoint.
const DASHBOARD_POLL_LIMIT = 5;

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly departmentScopeService: DepartmentScopeService,
    private readonly polls: PollsService,
  ) {}

  private readonly terminalStatuses = [
    task_status_enum.COMPLETED,
    task_status_enum.HOD_VERIFIED,
    task_status_enum.REJECTED,
    task_status_enum.CLOSED,
  ];

  private readonly completedStatuses = [
    task_status_enum.COMPLETED,
    task_status_enum.HOD_VERIFIED,
    task_status_enum.REVIEWED,
    task_status_enum.CLOSED,
  ];

  /**
   * The one call the home screen makes. Returns the task and request counters
   * plus the social layer: today's birthdays, the next holiday with a day
   * count, and open polls with the caller's vote already resolved.
   *
   * Kept as a single endpoint on purpose. This loads on every login, and five
   * requests to five endpoints is a worse first paint than one wide one. If a
   * list grows, trim it here rather than splitting the route.
   *
   * Throws whatever Prisma throws. The social lists are additive: an empty
   * `birthdays` or a null `upcomingHoliday` is a normal day, not an error.
   */
  async getDashboard(user: JwtPayload) {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    // Resolve department scope once for entire request
    const scope = await this.departmentScopeService.resolveDepartmentScope(user);

    // Build base filters using centralized helpers
    const taskBaseFilter = {
      deleted_at: null,
      ...this.buildCurrentOwnerDepartmentFilter(scope),
    };
    const activeTaskWhere = { ...taskBaseFilter, status: { notIn: this.terminalStatuses } };
    const completedTaskWhere = { ...taskBaseFilter, status: { in: this.completedStatuses } };

    const requestFilter = {
      status: request_status_enum.PENDING,
      ...DepartmentQueryHelper.buildRequestDepartmentFilter(scope),
    };

    const transferFilter = {
      status: transfer_status_enum.PENDING,
      ...DepartmentQueryHelper.buildTransferDepartmentFilter(scope),
    };

    const escalationFilter = {
      is_resolved: false,
      ...DepartmentQueryHelper.buildEscalationDepartmentFilter(scope),
    };

    const incentiveFilter = {
      ...DepartmentQueryHelper.buildIncentiveDepartmentFilter(scope),
      is_approved: true,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    };

    const [
      activeTasks,
      pendingRequests,
      totalTasks,
      completedTasks,
      incentivesTotal,
      transferRequests,
      escalatedTasks,
      overdueTasks,
      weeklyCompleted,
      departmentGroups,
      completedDepartmentGroups,
      employeeSharedTasks,
    ] = await Promise.all([
      this.prisma.tasks.count({ where: activeTaskWhere }),
      this.prisma.task_requests.count({ where: requestFilter }),
      this.prisma.tasks.count({ where: taskBaseFilter }),
      this.prisma.tasks.count({ where: completedTaskWhere }),
      this.prisma.incentives.aggregate({
        _sum: { amount: true },
        where: incentiveFilter,
      }),
      this.prisma.task_transfers.count({ where: transferFilter }),
      this.prisma.task_escalations.count({ where: escalationFilter }),
      this.prisma.tasks.count({
        where: { ...activeTaskWhere, due_date: { lt: now } },
      }),
      this.prisma.tasks.findMany({
        where: { ...completedTaskWhere, completed_at: { gte: weekStart } },
        select: { completed_at: true },
      }),
      this.prisma.tasks.groupBy({
        by: ['department_id'],
        where: taskBaseFilter,
        _count: { id: true },
      }),
      this.prisma.tasks.groupBy({
        by: ['department_id'],
        where: completedTaskWhere,
        _count: { id: true },
      }),
      this.prisma.tasks.count({
        where: { ...activeTaskWhere, task_type: task_type_enum.EMPLOYEE_SHARED },
      }),
    ]);

    const [birthdayRows, holidayRow, activePolls] = await Promise.all([
      this.todaysBirthdays(),
      this.nextHoliday(scope),
      this.polls.listActive(user.sub, DASHBOARD_POLL_LIMIT),
    ]);

    const birthdays = birthdayRows.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      departmentName: row.department_name,
    }));

    const upcomingHoliday = holidayRow && {
      id: holidayRow.id,
      name: holidayRow.name,
      holidayDate: holidayRow.holiday_date,
      daysAway: holidayRow.days_away,
    };

    const departments = await this.prisma.departments.findMany({
      where: { id: { in: departmentGroups.map((g) => g.department_id) } },
      select: { id: true, name: true, sort_order: true },
    });

    const completedByDepartment = new Map(completedDepartmentGroups.map((g) => [g.department_id, g._count.id]));
    const departmentNames = new Map(departments.map((d) => [d.id, d.name]));
    const sortOrderMap = new Map(departments.map((d) => [d.id, d.sort_order]));

    const departmentSummary = departmentGroups.map((group) => {
      const completed = completedByDepartment.get(group.department_id) ?? 0;
      const completionRate = this.percent(completed, group._count.id);
      return {
        department: departmentNames.get(group.department_id) ?? 'Unassigned',
        tasks: group._count.id,
        completion: `${completionRate}%`,
        status: completionRate >= 95 ? 'On Track' : completionRate >= 85 ? 'Stable' : 'Review',
        sortOrder: sortOrderMap.get(group.department_id) ?? 999,
      };
    });

    departmentSummary.sort((a, b) => a.sortOrder - b.sortOrder);

    return {
      activeTasks,
      pendingRequests,
      completionRate: this.percent(completedTasks, totalTasks),
      incentives: Number(incentivesTotal._sum.amount ?? 0),
      pendingApprovals: pendingRequests,
      transferRequests,
      escalatedTasks,
      overdueTasks,
      chartData: this.weeklyChart(weeklyCompleted, weekStart),
      departmentSummary: departmentSummary.map(({ sortOrder, ...rest }) => rest),
      employeeSharedTasks,
      birthdays,
      upcomingHoliday,
      activePolls,
    };
  }

  /**
   * Everyone whose birthday is today, matched on month and day so the year is
   * ignored. Derived from `users.date_of_birth` on every read; there is no
   * table to populate and nothing to expire at midnight.
   *
   * A null `date_of_birth` is a person who has cleared it from their profile
   * and simply does not appear.
   */
  private todaysBirthdays() {
    return this.prisma.$queryRaw<BirthdayRow[]>(Prisma.sql`
      WITH today AS (
        SELECT (NOW() AT TIME ZONE ${SCORE_TIMEZONE}::text)::date AS d
      )
      SELECT u.id, u.full_name, dep.name AS department_name
      FROM users u
      CROSS JOIN today t
      LEFT JOIN departments dep ON dep.id = u.department_id
      WHERE u.date_of_birth IS NOT NULL
        AND u.deleted_at IS NULL
        AND COALESCE(u.is_active, TRUE) = TRUE
        AND (
          (
            EXTRACT(MONTH FROM u.date_of_birth) = EXTRACT(MONTH FROM t.d)
            AND EXTRACT(DAY FROM u.date_of_birth) = EXTRACT(DAY FROM t.d)
          )
          OR (
            -- A 29 February birthday is shown on 28 February in a non-leap
            -- year, so a leap day birthday still gets a card every year rather
            -- than one every four. Deliberate, not a bug. The last clause is
            -- the leap year test: 31 December is day 366 only in a leap year.
            EXTRACT(MONTH FROM u.date_of_birth) = 2
            AND EXTRACT(DAY FROM u.date_of_birth) = 29
            AND EXTRACT(MONTH FROM t.d) = 2
            AND EXTRACT(DAY FROM t.d) = 28
            AND EXTRACT(DOY FROM (date_trunc('year', t.d) + INTERVAL '1 year' - INTERVAL '1 day')) <> 366
          )
        )
      ORDER BY u.full_name
    `);
  }

  /**
   * The next holiday on or after today with a whole day count, or null when the
   * calendar has run out. Company-wide holidays carry a null `department_id`
   * and are visible to everyone; a departmental one only reaches that
   * department, and the MD sees all of them.
   *
   * Reads `holidays` directly rather than calling `/holidays/upcoming`, because
   * the dashboard is one round trip and this is one join.
   */
  private async nextHoliday(scope: DepartmentScope): Promise<UpcomingHolidayRow | null> {
    const departmentFilter = scope.unrestricted
      ? Prisma.empty
      : Prisma.sql`AND (h.department_id IS NULL OR h.department_id = ANY(${scope.departmentIds}::uuid[]))`;

    const rows = await this.prisma.$queryRaw<UpcomingHolidayRow[]>(Prisma.sql`
      WITH today AS (
        SELECT (NOW() AT TIME ZONE ${SCORE_TIMEZONE}::text)::date AS d
      )
      SELECT h.id, h.name, h.holiday_date, (h.holiday_date - t.d) AS days_away
      FROM holidays h
      CROSS JOIN today t
      WHERE h.holiday_date >= t.d
      ${departmentFilter}
      ORDER BY h.holiday_date ASC
      LIMIT 1
    `);

    return rows[0] ?? null;
  }

  private percent(value: number, total: number) {
    return total ? Math.round((value / total) * 1000) / 10 : 0;
  }

  private buildCurrentOwnerDepartmentFilter(scope: DepartmentScope): Prisma.tasksWhereInput {
    if (scope.unrestricted) {
      return {};
    }

    if (scope.departmentIds.length === 0) {
      return { id: { in: [] } };
    }

    return { department_id: { in: scope.departmentIds } };
  }

  private weeklyChart(tasks: Array<{ completed_at: Date | null }>, weekStart: Date) {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      return {
        label: date.toLocaleDateString('en-US', { weekday: 'short' }),
        value: tasks.filter((t) => t.completed_at && t.completed_at.toDateString() === date.toDateString()).length,
      };
    });
  }
}
