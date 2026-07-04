// src/common/services/department-scope.service.ts

import { Injectable, Scope } from '@nestjs/common';
import { role_enum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../types/jwt-payload.type';
import { DepartmentScope } from '../types/department-scope.type';

/**
 * DepartmentScopeService
 * 
 * Single source of truth for department-based authorization and data visibility.
 * 
 * This service is the ONLY location allowed to determine accessible departments.
 * No business service may directly read:
 * - users.department_id
 * - assistant_departments
 * - hod_departments
 * 
 * Request-scoped to enable per-request caching.
 */
@Injectable({ scope: Scope.REQUEST })
export class DepartmentScopeService {
  private scopeCache: Map<string, DepartmentScope> = new Map();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve department scope for the current user.
   * 
   * Caches result per request to avoid redundant database queries.
   * 
   * @param user - JWT payload containing user identity and role
   * @returns DepartmentScope with unrestricted flag and accessible department IDs
   * 
   * @example
   * const scope = await this.departmentScopeService.resolveDepartmentScope(user);
   * if (scope.unrestricted) {
   *   // User has company-wide access
   * } else {
   *   // Filter by scope.departmentIds
   * }
   */
  async resolveDepartmentScope(user: JwtPayload): Promise<DepartmentScope> {
    const cacheKey = user.sub;

    // Return cached scope if available
    if (this.scopeCache.has(cacheKey)) {
      return this.scopeCache.get(cacheKey)!;
    }

    const scope = await this.computeDepartmentScope(user);
    this.scopeCache.set(cacheKey, scope);
    return scope;
  }

  /**
   * Compute department scope based on user role.
   * 
   * Business Rules:
   * - MD, ADMIN, EA, PA: unrestricted (company-wide access)
   * - HOD: departments from hod_departments table
   * - PURCHASE_HEAD: departments from assistant_departments table (special case HOD)
   * - DEPARTMENT_CONTROLLER: departments from assistant_departments table
   * - EMPLOYEE: single department from users.department_id
   */
  private async computeDepartmentScope(user: JwtPayload): Promise<DepartmentScope> {
    // Unrestricted roles: company-wide access
    if (this.isUnrestrictedRole(user.role)) {
      return { unrestricted: true, departmentIds: [] };
    }

    // Department-scoped roles
    const departmentIds = await this.resolveDepartmentIds(user);
    return { unrestricted: false, departmentIds };
  }

  /**
   * Check if role has unrestricted (company-wide) access.
   */
  private isUnrestrictedRole(role: role_enum): boolean {
    const unrestrictedRoles: role_enum[] = [
      role_enum.MD,
      role_enum.ADMIN,
      role_enum.EA,
      role_enum.PA,
    ];
    return unrestrictedRoles.includes(role);
  }

  /**
   * Resolve department IDs based on user role.
   */
  private async resolveDepartmentIds(user: JwtPayload): Promise<string[]> {
    switch (user.role) {
      case role_enum.HOD:
        return this.getHodDepartments(user.sub);

      case role_enum.PURCHASE_HEAD:
        return this.getPurchaseDepartments(user.sub);

      case role_enum.DEPARTMENT_CONTROLLER:
        return this.getAssistantDepartments(user.sub);

      case role_enum.EMPLOYEE:
        return this.getEmployeeDepartment(user.sub);

      default:
        return [];
    }
  }

  /**
   * Get departments for HOD role from hod_departments junction table.
   */
  private async getHodDepartments(userId: string): Promise<string[]> {
    const records = await this.prisma.hod_departments.findMany({
      where: { hod_id: userId },
      select: { department_id: true },
    });
    return records.map((r) => r.department_id);
  }

  /**
   * Get Purchase departments for PURCHASE_HEAD role.
   * PURCHASE_HEAD is stored in assistant_departments table but behaves like HOD.
   */
  private async getPurchaseDepartments(userId: string): Promise<string[]> {
    const records = await this.prisma.assistant_departments.findMany({
      where: { assistant_id: userId },
      select: { department_id: true },
    });
    return records.map((r) => r.department_id);
  }

  /**
   * Get departments for DEPARTMENT_CONTROLLER role from assistant_departments table.
   */
  private async getAssistantDepartments(userId: string): Promise<string[]> {
    const records = await this.prisma.assistant_departments.findMany({
      where: { assistant_id: userId },
      select: { department_id: true },
    });
    return records.map((r) => r.department_id);
  }

  /**
   * Get single department for EMPLOYEE role from users.department_id.
   */
  private async getEmployeeDepartment(userId: string): Promise<string[]> {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { department_id: true },
    });
    return user?.department_id ? [user.department_id] : [];
  }

  /**
   * Validate that submitted department IDs are within user's scope.
   * 
   * @param user - Current user
   * @param submittedDepartmentIds - Department IDs from request payload
   * @returns true if valid, false if submitted departments exceed user's scope
   * 
   * @example
   * const isValid = await this.departmentScopeService.validateDepartmentAccess(
   *   user,
   *   dto.departmentIds
   * );
   * if (!isValid) {
   *   throw new ForbiddenException('You do not have access to the specified departments');
   * }
   */
  async validateDepartmentAccess(
    user: JwtPayload,
    submittedDepartmentIds: string[],
  ): Promise<boolean> {
    const scope = await this.resolveDepartmentScope(user);

    // Unrestricted users can access any department
    if (scope.unrestricted) {
      return true;
    }

    // Check if all submitted departments are within user's scope
    return submittedDepartmentIds.every((deptId) =>
      scope.departmentIds.includes(deptId),
    );
  }

  /**
   * Validate that the user has access to AT LEAST ONE of the submitted departments.
   * Useful for visibility checks where a record spans multiple departments.
   * 
   * @param user - Current user
   * @param departmentIds - Array of department IDs the record belongs to
   * @returns true if user has access to at least one department, false otherwise
   */
  async hasAnyDepartmentAccess(
    user: JwtPayload,
    departmentIds: string[],
  ): Promise<boolean> {
    const scope = await this.resolveDepartmentScope(user);

    if (scope.unrestricted) {
      return true;
    }

    // Check if any of the record's departments are within user's scope
    return departmentIds.some((deptId) => scope.departmentIds.includes(deptId));
  }
}
