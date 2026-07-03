// src/common/types/department-scope.type.ts

/**
 * Department Scope Type
 * 
 * Single source of truth for department-based authorization and data visibility.
 * 
 * @property unrestricted - If true, user has company-wide access (MD, ADMIN, EA, PA)
 * @property departmentIds - Array of department IDs the user can access
 * 
 * @example Employee
 * { unrestricted: false, departmentIds: ['sales-dept-id'] }
 * 
 * @example HOD (multiple departments)
 * { unrestricted: false, departmentIds: ['production-id', 'maintenance-id'] }
 * 
 * @example MD/EA/PA (unrestricted)
 * { unrestricted: true, departmentIds: [] }
 */
export interface DepartmentScope {
  /**
   * True for roles with company-wide access: MD, ADMIN, EA, PA
   * False for department-scoped roles: HOD, PURCHASE_HEAD, DEPARTMENT_CONTROLLER, EMPLOYEE
   */
  unrestricted: boolean;

  /**
   * Array of accessible department IDs.
   * 
   * - Empty array for unrestricted roles (MD, ADMIN, EA, PA)
   * - One or more department IDs for HOD, PURCHASE_HEAD, DEPARTMENT_CONTROLLER
   * - Single department ID for EMPLOYEE
   */
  departmentIds: string[];
}
