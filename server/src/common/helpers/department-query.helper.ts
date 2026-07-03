// src/common/helpers/department-query.helper.ts

import { Prisma } from '@prisma/client';
import { DepartmentScope } from '../types/department-scope.type';

/**
 * DepartmentQueryHelper
 * 
 * Reusable Prisma query builders for department-scoped queries.
 * Eliminates duplicated WHERE clause logic across services.
 */
export class DepartmentQueryHelper {
  /**
   * Build Prisma WHERE clause for tasks based on department scope.
   * 
   * Uses task_departments junction table as the single source of truth.
   * Never uses tasks.department_id for authorization.
   * 
   * @param scope - Department scope from DepartmentScopeService
   * @returns Prisma WHERE clause or empty object for unrestricted access
   * 
   * @example
   * const scope = await departmentScopeService.resolveDepartmentScope(user);
   * const where = {
   *   deleted_at: null,
   *   ...DepartmentQueryHelper.buildTaskDepartmentFilter(scope),
   * };
   * const tasks = await prisma.tasks.findMany({ where });
   */
  static buildTaskDepartmentFilter(scope: DepartmentScope): Prisma.tasksWhereInput {
    if (scope.unrestricted) {
      return {};
    }

    if (scope.departmentIds.length === 0) {
      // No accessible departments - return impossible condition
      return { id: { in: [] } };
    }

    return {
      task_departments: {
        some: {
          department_id: { in: scope.departmentIds },
        },
      },
    };
  }

  /**
   * Build Prisma WHERE clause for self actions based on department scope.
   * 
   * Uses self_action_departments junction table.
   * 
   * @param scope - Department scope from DepartmentScopeService
   * @returns Prisma WHERE clause or empty object for unrestricted access
   * 
   * @example
   * const scope = await departmentScopeService.resolveDepartmentScope(user);
   * const where = {
   *   deleted_at: null,
   *   ...DepartmentQueryHelper.buildSelfActionDepartmentFilter(scope),
   * };
   * const actions = await prisma.self_actions.findMany({ where });
   */
  static buildSelfActionDepartmentFilter(scope: DepartmentScope): Prisma.self_actionsWhereInput {
    if (scope.unrestricted) {
      return {};
    }

    if (scope.departmentIds.length === 0) {
      return { id: { in: [] } };
    }

    return {
      self_action_departments: {
        some: {
          department_id: { in: scope.departmentIds },
        },
      },
    };
  }

  /**
   * Build Prisma WHERE clause for task requests based on department scope.
   * 
   * Filters by the requesting user's department.
   * 
   * @param scope - Department scope from DepartmentScopeService
   * @returns Prisma WHERE clause or empty object for unrestricted access
   */
  static buildRequestDepartmentFilter(scope: DepartmentScope): Prisma.task_requestsWhereInput {
    if (scope.unrestricted) {
      return {};
    }

    if (scope.departmentIds.length === 0) {
      return { id: { in: [] } };
    }

    return {
      users_task_requests_requested_by_idTousers: {
        department_id: { in: scope.departmentIds },
      },
    };
  }

  /**
   * Build Prisma WHERE clause for task transfers based on department scope.
   * 
   * User can see transfers where their departments are either source or destination.
   * 
   * @param scope - Department scope from DepartmentScopeService
   * @returns Prisma WHERE clause or empty object for unrestricted access
   */
  static buildTransferDepartmentFilter(scope: DepartmentScope): Prisma.task_transfersWhereInput {
    if (scope.unrestricted) {
      return {};
    }

    if (scope.departmentIds.length === 0) {
      return { id: { in: [] } };
    }

    return {
      OR: [
        { from_dept_id: { in: scope.departmentIds } },
        { to_dept_id: { in: scope.departmentIds } },
      ],
    };
  }

  /**
   * Build Prisma WHERE clause for task escalations based on department scope.
   * 
   * Filters escalations by task department visibility.
   * 
   * @param scope - Department scope from DepartmentScopeService
   * @returns Prisma WHERE clause or empty object for unrestricted access
   */
  static buildEscalationDepartmentFilter(scope: DepartmentScope): Prisma.task_escalationsWhereInput {
    if (scope.unrestricted) {
      return {};
    }

    if (scope.departmentIds.length === 0) {
      return { id: { in: [] } };
    }

    return {
      tasks: {
        task_departments: {
          some: {
            department_id: { in: scope.departmentIds },
          },
        },
      },
    };
  }

  /**
   * Build Prisma WHERE clause for incentives based on department scope.
   * 
   * Filters by employee's department.
   * 
   * @param scope - Department scope from DepartmentScopeService
   * @returns Prisma WHERE clause or empty object for unrestricted access
   */
  static buildIncentiveDepartmentFilter(scope: DepartmentScope): Prisma.incentivesWhereInput {
    if (scope.unrestricted) {
      return {};
    }

    if (scope.departmentIds.length === 0) {
      return { id: { in: [] } };
    }

    return {
      users_incentives_employee_idTousers: {
        department_id: { in: scope.departmentIds },
      },
    };
  }

  /**
   * Build Prisma WHERE clause for users based on department scope.
   * 
   * Filters users by their primary department.
   * 
   * @param scope - Department scope from DepartmentScopeService
   * @returns Prisma WHERE clause or empty object for unrestricted access
   */
  static buildUserDepartmentFilter(scope: DepartmentScope): Prisma.usersWhereInput {
    if (scope.unrestricted) {
      return {};
    }

    if (scope.departmentIds.length === 0) {
      return { id: { in: [] } };
    }

    return {
      department_id: { in: scope.departmentIds },
    };
  }

  /**
   * Build Prisma WHERE clause for notifications based on department scope.
   * 
   * Filters notifications through related task departments.
   * 
   * @param scope - Department scope from DepartmentScopeService
   * @returns Prisma WHERE clause or empty object for unrestricted access
   */
  static buildNotificationDepartmentFilter(scope: DepartmentScope): Prisma.notificationsWhereInput {
    if (scope.unrestricted) {
      return {};
    }

    if (scope.departmentIds.length === 0) {
      return { id: { in: [] } };
    }

    return {
      tasks: {
        task_departments: {
          some: {
            department_id: { in: scope.departmentIds },
          },
        },
      },
    };
  }
}
