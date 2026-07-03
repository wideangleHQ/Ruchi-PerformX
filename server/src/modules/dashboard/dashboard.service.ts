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

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly departmentScopeService: DepartmentScopeService,
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
      ...DepartmentQueryHelper.buildTaskDepartmentFilter(scope),
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
      this.prisma.task_departments.groupBy({
        by: ['department_id'],
        where: {
          tasks: taskBaseFilter,
        },
        _count: { id: true },
      }),
      this.prisma.task_departments.groupBy({
        by: ['department_id'],
        where: {
          tasks: completedTaskWhere,
        },
        _count: { id: true },
      }),
      this.prisma.tasks.count({
        where: { ...activeTaskWhere, task_type: task_type_enum.EMPLOYEE_SHARED },
      }),
    ]);

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
    };
  }

  private percent(value: number, total: number) {
    return total ? Math.round((value / total) * 1000) / 10 : 0;
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
