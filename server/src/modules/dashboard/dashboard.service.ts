import { Injectable } from '@nestjs/common';
import {
  Prisma,
  request_status_enum,
  role_enum,
  task_status_enum,
  transfer_status_enum,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../common/types/jwt-payload.type';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly terminalStatuses = [
    task_status_enum.COMPLETED,
    task_status_enum.REVIEWED,
    task_status_enum.CLOSED,
    task_status_enum.REJECTED,
  ];

  private readonly completedStatuses = [
    task_status_enum.COMPLETED,
    task_status_enum.REVIEWED,
    task_status_enum.CLOSED,
  ];

  async getDashboard(user: JwtPayload) {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const taskWhere = this.taskScope(user);
    const activeTaskWhere = { ...taskWhere, status: { notIn: this.terminalStatuses } };
    const completedTaskWhere = { ...taskWhere, status: { in: this.completedStatuses } };

    const [
      activeTasks,
      pendingRequests,
      totalTasks,
      completedTasks,
      incentivesTotal,
      pendingApprovals,
      transferRequests,
      escalatedTasks,
      overdueTasks,
      weeklyCompleted,
      departmentGroups,
      completedDepartmentGroups,
    ] = await Promise.all([
      this.prisma.tasks.count({ where: activeTaskWhere }),
      this.prisma.task_requests.count({ where: this.requestScope(user) }),
      this.prisma.tasks.count({ where: taskWhere }),
      this.prisma.tasks.count({ where: completedTaskWhere }),
      this.prisma.incentives.aggregate({
        _sum: { amount: true },
        where: {
          ...this.incentiveScope(user),
          is_approved: true,
          month: now.getMonth() + 1,
          year: now.getFullYear(),
        },
      }),
      this.prisma.task_requests.count({
        where: { ...this.requestScope(user), status: request_status_enum.PENDING },
      }),
      this.prisma.task_transfers.count({
        where: { ...this.transferScope(user), status: transfer_status_enum.PENDING },
      }),
      this.prisma.task_escalations.count({
        where: { ...this.escalationScope(user), is_resolved: false },
      }),
      this.prisma.tasks.count({
        where: { ...activeTaskWhere, due_date: { lt: now } },
      }),
      this.prisma.tasks.findMany({
        where: { ...completedTaskWhere, completed_at: { gte: weekStart } },
        select: { completed_at: true },
      }),
      this.prisma.tasks.groupBy({
        by: ['department_id'],
        where: taskWhere,
        _count: { id: true },
      }),
      this.prisma.tasks.groupBy({
        by: ['department_id'],
        where: completedTaskWhere,
        _count: { id: true },
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
      pendingApprovals,
      transferRequests,
      escalatedTasks,
      overdueTasks,
      chartData: this.weeklyChart(weeklyCompleted, weekStart),
      departmentSummary: departmentSummary.map(({ sortOrder, ...rest }) => rest),
    };
  }

  private hodDeptIds(user: JwtPayload): string[] {
    return user.departmentIds?.length ? user.departmentIds : user.departmentId ? [user.departmentId] : [];
  }

  private taskScope(user: JwtPayload): Prisma.tasksWhereInput {
    const base = { deleted_at: null };
    if (user.role === role_enum.MD || user.role === role_enum.ADMIN) return base;
    if (user.role === role_enum.HOD || user.role === role_enum.PURCHASE_HEAD) {
      const deptIds = this.hodDeptIds(user);
      return deptIds.length ? { ...base, ...this.departmentVisibility(deptIds) } : { id: { in: [] } };
    }
    return user.departmentId ? { ...base, ...this.departmentVisibility([user.departmentId]) } : { id: { in: [] } };
  }

  private requestScope(user: JwtPayload): Prisma.task_requestsWhereInput {
    const base = { status: request_status_enum.PENDING };
    if (user.role === role_enum.MD || user.role === role_enum.ADMIN) return base;
    if (user.role === role_enum.HOD || user.role === role_enum.PURCHASE_HEAD) {
      const deptIds = this.hodDeptIds(user);
      return deptIds.length
        ? { ...base, users_task_requests_requested_by_idTousers: { department_id: { in: deptIds } } }
        : { id: { in: [] } };
    }
    return { ...base, requested_by_id: user.sub };
  }

  private transferScope(user: JwtPayload): Prisma.task_transfersWhereInput {
    if (user.role === role_enum.MD || user.role === role_enum.ADMIN) return {};
    if (user.role === role_enum.HOD || user.role === role_enum.PURCHASE_HEAD) {
      const deptIds = this.hodDeptIds(user);
      return deptIds.length ? { OR: [{ from_dept_id: { in: deptIds } }, { to_dept_id: { in: deptIds } }] } : { id: { in: [] } };
    }
    return { initiated_by_id: user.sub };
  }

  private escalationScope(user: JwtPayload): Prisma.task_escalationsWhereInput {
    if (user.role === role_enum.MD || user.role === role_enum.ADMIN) return {};
    if (user.role === role_enum.HOD || user.role === role_enum.PURCHASE_HEAD) {
      const deptIds = this.hodDeptIds(user);
      return deptIds.length
        ? {
            tasks: {
              OR: [
                { department_id: { in: deptIds } },
                { task_departments: { some: { department_id: { in: deptIds } } } },
              ],
            },
          }
        : { id: { in: [] } };
    }
    return { escalated_to_id: user.sub };
  }

  private incentiveScope(user: JwtPayload): Prisma.incentivesWhereInput {
    if (user.role === role_enum.MD || user.role === role_enum.ADMIN) return {};
    if (user.role === role_enum.HOD || user.role === role_enum.PURCHASE_HEAD) {
      const deptIds = this.hodDeptIds(user);
      return deptIds.length
        ? { users_incentives_employee_idTousers: { department_id: { in: deptIds } } }
        : { id: { in: [] } };
    }
    return { employee_id: user.sub };
  }

  private percent(value: number, total: number) {
    return total ? Math.round((value / total) * 1000) / 10 : 0;
  }

  private departmentVisibility(departmentIds: string[]): Prisma.tasksWhereInput {
    return {
      OR: [
        { department_id: { in: departmentIds } },
        { task_departments: { some: { department_id: { in: departmentIds } } } },
      ],
    };
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
