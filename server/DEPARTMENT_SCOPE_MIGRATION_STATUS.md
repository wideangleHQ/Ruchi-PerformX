# Department Scope Architecture Migration Status

## Overview

This document tracks the migration of all business modules to use the centralized Department Scope Architecture.

**Migration Date**: Started
**Architecture Components**: ✅ Complete
**Build Status**: ✅ Passing

---

## ✅ Completed Migrations

### 1. **Dashboard Module** (Reference Implementation)
**File**: `src/modules/dashboard/dashboard.service.ts`

**Status**: ✅ **COMPLETE**

**Changes Made**:
- ✅ Injected `DepartmentScopeService`
- ✅ Removed `hodDeptIds()` helper method
- ✅ Removed `taskScope()` helper method
- ✅ Removed `requestScope()` helper method
- ✅ Removed `transferScope()` helper method
- ✅ Removed `escalationScope()` helper method
- ✅ Removed `incentiveScope()` helper method
- ✅ Removed `departmentVisibility()` helper method
- ✅ Replaced all department resolution with `resolveDepartmentScope()`
- ✅ Used `DepartmentQueryHelper` for all WHERE clauses
- ✅ Single scope resolution per request (cached)
- ✅ Uses `task_departments` junction table
- ✅ Unrestricted roles (MD, ADMIN, EA, PA) get empty filters (not `id: {in: []}`)
- ✅ Fixed enum values: COMPLETED, HOD_VERIFIED, REJECTED, CLOSED, REVIEWED

**Verification**:
```typescript
// Before
private taskScope(user: JwtPayload): Prisma.tasksWhereInput {
  if (user.role === role_enum.MD) return { deleted_at: null };
  const deptIds = this.hodDeptIds(user);
  return { deleted_at: null, department_id: { in: deptIds } };
}

// After
const scope = await this.departmentScopeService.resolveDepartmentScope(user);
const where = {
  deleted_at: null,
  ...DepartmentQueryHelper.buildTaskDepartmentFilter(scope),
};
```

---

### 2. **Tasks Module**
**File**: `src/modules/tasks/tasks.service.ts`

**Status**: ✅ **COMPLETE**

**Changes Made**:
- ✅ Injected `DepartmentScopeService`
- ✅ Imported `DepartmentQueryHelper`
- ✅ Removed `mappedDepts()` helper method
- ✅ Removed `departmentVisibility()` helper method
- ✅ Removed `hasDepartmentAccess()` helper method
- ✅ Migrated `findAll()` to use `buildTaskDepartmentFilter()`
- ✅ Migrated `getPending()` to use department scope
- ✅ Migrated `getOverdue()` to use department scope
- ✅ Migrated `getDepartments()` to use department scope
- ✅ Migrated `getAssignees()` to use `validateDepartmentAccess()`
- ✅ Migrated `assertAccess()` to use department scope
- ✅ Migrated `assertCreateAccess()` to use `validateDepartmentAccess()`
- ✅ Migrated `remove()` to use department scope
- ✅ Migrated `transition()` to use department scope
- ✅ Updated `buildWhereFromFilters()` to use `task_departments`
- ✅ Employee Shared Task validation uses department scope
- ✅ Removed direct queries to `hod_departments` and `assistant_departments`

**Key Improvements**:
- Uses `task_departments` junction table as single source of truth
- Server-side department validation for all create/update operations
- Unrestricted roles get proper empty filters
- Employee ownership validation combined with department scope
- Removed 3 legacy helper methods

**Before**:
```typescript
private mappedDepts(user: JwtPayload): string[] {
  return user.departmentIds?.length ? user.departmentIds : user.departmentId ? [user.departmentId] : [];
}

private departmentVisibility(departmentIds: string[]): Prisma.tasksWhereInput {
  if (!departmentIds.length) return { id: { in: [] } };
  return {
    OR: [
      { department_id: { in: departmentIds } },
      { task_departments: { some: { department_id: { in: departmentIds } } } },
    ],
  };
}
```

**After**:
```typescript
const scope = await this.departmentScopeService.resolveDepartmentScope(user);
const departmentFilter = DepartmentQueryHelper.buildTaskDepartmentFilter(scope);
```

---

## 🚧 Pending Migrations

The following modules still contain legacy department filtering logic and must be migrated:

### 3. **Self Actions Module** 
**File**: `src/modules/self-actions/self-actions.service.ts`
**Priority**: HIGH

**Legacy Code Identified**:
- ❌ Direct access to `user.departmentId`
- ❌ Direct access to `user.departmentIds`
- ❌ Manual role checks: `role === role_enum.HOD`, `role === role_enum.MD`
- ❌ Manual department filtering in `getVisibilityFilter()`
- ❌ Direct queries to `self_action_departments` for authorization
- ❌ Custom department resolution logic

**Required Changes**:
1. Inject `DepartmentScopeService`
2. Replace `getVisibilityFilter()` with `buildSelfActionDepartmentFilter()`
3. Replace `checkReadAccess()` authorization with department scope
4. Replace `canEditAction()` with department scope validation
5. Use `validateDepartmentAccess()` in create/update operations
6. Remove all direct `user.departmentId` and `user.departmentIds` references

**Migration Pattern**:
```typescript
// Before
private getVisibilityFilter(user: JwtPayload) {
  if (user.role === role_enum.MD || user.role === role_enum.ADMIN) return null;
  if (DEPARTMENT_SCOPED_ROLES.includes(user.role)) {
    return {
      self_action_departments: { some: { department_id: { in: user.departmentIds || [] } } },
    };
  }
}

// After
const scope = await this.departmentScopeService.resolveDepartmentScope(user);
const filter = DepartmentQueryHelper.buildSelfActionDepartmentFilter(scope);
```

---

### 4. **Requests Module**
**File**: `src/modules/requests/requests.service.ts`
**Priority**: HIGH

**Legacy Code Identified**:
- ❌ `getManagedDepartmentIds()` helper method
- ❌ Direct access to `user.departmentId`
- ❌ Direct access to `user.departmentIds`
- ❌ Manual role checks: `role === role_enum.EMPLOYEE`
- ❌ Custom department scope resolution
- ❌ `hasDepartmentAccess()` helper method

**Required Changes**:
1. Inject `DepartmentScopeService`
2. Remove `getManagedDepartmentIds()` helper
3. Replace with `resolveDepartmentScope()`
4. Use `buildRequestDepartmentFilter()` for queries
5. Use `validateDepartmentAccess()` for create operations
6. Remove all manual department ID resolution

---

### 5. **Comments Module**
**File**: `src/modules/comments/comments.service.ts`
**Priority**: MEDIUM

**Legacy Code Identified**:
- ❌ Direct access to `user.departmentId`
- ❌ Direct access to `user.departmentIds`
- ❌ Manual department access checking

**Required Changes**:
1. Inject `DepartmentScopeService`
2. Replace manual department checks with scope validation
3. Use task department scope for access control

---

### 6. **Attachments Module**
**File**: `src/modules/attachments/attachments.service.ts`
**Priority**: MEDIUM

**Legacy Code Identified**:
- ❌ Direct access to `user.departmentId`
- ❌ Direct access to `user.departmentIds`
- ❌ `taskDepartmentIds()` helper with manual checks
- ❌ `hasOverlap()` helper for department matching

**Required Changes**:
1. Inject `DepartmentScopeService`
2. Replace manual department checks with scope validation
3. Delegate to task/self-action access control

---

### 7. **Transfers Module**
**File**: `src/modules/transfers/transfers.service.ts`
**Priority**: MEDIUM

**Legacy Code Identified**:
- ❌ Direct access to `user.departmentId`
- ❌ Manual department filtering: `from_dept_id: user.departmentId`
- ❌ Manual role checks

**Required Changes**:
1. Inject `DepartmentScopeService`
2. Use `buildTransferDepartmentFilter()`
3. Replace manual checks with scope validation

---

### 8. **Scoring Module**
**File**: `src/modules/scoring/scoring.service.ts`
**Priority**: LOW

**Legacy Code Identified**:
- ❌ Direct access to `user.departmentId`
- ❌ Manual department filtering in queries

**Required Changes**:
1. Inject `DepartmentScopeService`
2. Use department scope for visibility filtering

---

### 9. **Notifications Module**
**File**: `src/modules/notifications/notifications.service.ts`
**Priority**: LOW

**Legacy Code Identified**:
- Check if manual department filtering exists

**Required Changes**:
1. Use `buildNotificationDepartmentFilter()` if needed
2. Verify notification visibility respects department scope

---

### 10. **Analytics Module**
**File**: `src/modules/analytics/analytics.service.ts` (if exists)
**Priority**: LOW

**Required Changes**:
1. Use department scope for all analytics queries
2. Ensure aggregations respect department boundaries

---

### 11. **Users Module**
**File**: `src/modules/users/users.service.ts`
**Priority**: LOW (Special Case)

**Note**: Users module manages user-department relationships and is used BY DepartmentScopeService. 
- ✅ Keep existing logic for HOD/PURCHASE_HEAD department management
- ✅ Keep `findPending()`, `approve()`, `reject()`, `resetPassword()` role checks
- ❌ Consider migrating `findAssignable()` to use department scope for consistency

---

## Migration Checklist

For each module, follow this process:

### Step 1: Dependency Injection
```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly departmentScopeService: DepartmentScopeService, // Add this
) {}
```

### Step 2: Import Helpers
```typescript
import { DepartmentScopeService } from '../../common/services/department-scope.service';
import { DepartmentQueryHelper } from '../../common/helpers/department-query.helper';
```

### Step 3: Replace Department Resolution
```typescript
// Before
const deptIds = user.departmentIds || (user.departmentId ? [user.departmentId] : []);

// After
const scope = await this.departmentScopeService.resolveDepartmentScope(user);
```

### Step 4: Replace WHERE Clauses
```typescript
// Before
const where = {
  department_id: { in: deptIds },
};

// After
const where = {
  ...DepartmentQueryHelper.buildTaskDepartmentFilter(scope),
};
```

### Step 5: Validate Department Access
```typescript
// Before
if (user.role !== role_enum.MD && !deptIds.includes(dto.departmentId)) {
  throw new ForbiddenException();
}

// After
const isValid = await this.departmentScopeService.validateDepartmentAccess(
  user,
  [dto.departmentId],
);
if (!isValid) {
  throw new ForbiddenException('You do not have access to this department');
}
```

### Step 6: Remove Legacy Helpers
Delete these methods after migration:
- `mappedDepts()`
- `hodDeptIds()`
- `departmentVisibility()`
- `hasDepartmentAccess()`
- `getManagedDepartmentIds()`
- Any method that directly queries `hod_departments` or `assistant_departments`

### Step 7: Update Queries
Replace:
- `department_id: { in: [] }` with proper scope filters
- Manual `OR` clauses with helper functions
- Legacy department fields with junction tables

---

## Verification Tests

After migrating each module, verify:

### ✅ ADMIN Role
```bash
# Should see ALL resources across all departments
GET /api/v1/tasks
GET /api/v1/self-actions
GET /api/v1/requests
```

### ✅ MD Role
```bash
# Should see ALL resources across all departments
GET /api/v1/tasks
GET /api/v1/self-actions
GET /api/v1/requests
```

### ✅ EA Role
```bash
# Should see ALL departments
# Should be able to create tasks in ANY department
POST /api/v1/tasks { departmentIds: ["any-dept-id"] }
GET /api/v1/self-actions
GET /api/v1/requests
```

### ✅ PA Role
```bash
# Same as EA
# Full company-wide access
```

### ✅ PURCHASE_HEAD Role
```bash
# Should see ONLY Purchase Agro and Purchase Non Agro departments
GET /api/v1/tasks?departmentId=purchase-agro-id
GET /api/v1/tasks?departmentId=production-id  # Should return 403
```

### ✅ DEPARTMENT_CONTROLLER Role
```bash
# Should see ONLY assigned departments
GET /api/v1/tasks
# Should NOT see other departments
```

### ✅ HOD Role
```bash
# Should see ONLY mapped departments (can be multiple)
GET /api/v1/tasks
# Should be able to create tasks in mapped departments
POST /api/v1/tasks { departmentIds: ["mapped-dept-1", "mapped-dept-2"] }
# Should NOT see other departments
GET /api/v1/tasks?departmentId=other-dept-id  # Should return empty
```

### ✅ EMPLOYEE Role
```bash
# Should see ONLY own department
# Should see ONLY assigned or created tasks
GET /api/v1/tasks  # Filtered by department AND ownership
# Should NOT create official tasks
POST /api/v1/tasks  # Should return 403
# CAN create Employee Shared Tasks in own department
POST /api/v1/employee-shared/tasks
```

---

## Common Pitfalls to Avoid

### ❌ Empty Array for Unrestricted Roles
```typescript
// WRONG
if (scope.unrestricted) {
  return { department_id: { in: [] } };  // Returns ZERO records!
}

// CORRECT
if (scope.unrestricted) {
  return {};  // No filter = ALL records
}
```

### ❌ Using Legacy Department Fields for Authorization
```typescript
// WRONG
where: { department_id: { in: scope.departmentIds } }

// CORRECT
where: {
  task_departments: { some: { department_id: { in: scope.departmentIds } } }
}
```

### ❌ Trusting Client Department Payload
```typescript
// WRONG
const departmentIds = dto.departmentIds;
// Use them directly without validation

// CORRECT
const isValid = await this.departmentScopeService.validateDepartmentAccess(
  user,
  dto.departmentIds,
);
if (!isValid) throw new ForbiddenException();
```

### ❌ Bypassing Department Scope for Employees
```typescript
// WRONG
if (user.role === role_enum.EMPLOYEE) {
  // Skip department checks, only check ownership
  return task.assigned_to_id === user.sub;
}

// CORRECT
const scope = await this.departmentScopeService.resolveDepartmentScope(user);
// Check BOTH department access AND ownership
```

---

## Build & Test Status

**Current Build**: ✅ **PASSING**

**Modules Compiling**:
- ✅ DepartmentScopeService
- ✅ DepartmentQueryHelper
- ✅ CommonModule
- ✅ DashboardService (✅ Complete)
- ✅ TasksService (✅ Complete)
- 🚧 SelfActionsService (Pending)
- 🚧 RequestsService (Pending)
- 🚧 CommentsService (Pending)
- 🚧 AttachmentsService (Pending)
- 🚧 TransfersService (Pending)

**TypeScript Errors**: 0

---

## Next Steps

1. **Self Actions Module** - Migrate `self-actions.service.ts`
2. **Requests Module** - Migrate `requests.service.ts`
3. **Comments Module** - Migrate `comments.service.ts`
4. **Attachments Module** - Migrate `attachments.service.ts`
5. **Transfers Module** - Migrate `transfers.service.ts`
6. **Scoring Module** - Migrate `scoring.service.ts`
7. **Notifications Module** - Verify and migrate if needed
8. **Complete Verification** - Test all roles against all endpoints

---

## Summary

**Architecture Status**: ✅ Complete
- DepartmentScope type: ✅ Implemented
- DepartmentScopeService: ✅ Implemented
- DepartmentQueryHelper: ✅ Implemented with 8 helpers
- CommonModule: ✅ Registered globally
- Request-scoped caching: ✅ Active

**Modules Migrated**: 2 / 11
- ✅ Dashboard (reference implementation)
- ✅ Tasks (complete migration)
- 🚧 9 modules remaining

**Benefits Achieved**:
- Single source of truth for department resolution
- Eliminated duplicated helper methods (10+ methods removed)
- Server-side department validation
- Request-scoped performance caching
- Type-safe department scoping
- Unrestricted roles properly handled
- Uses junction tables as single source of truth

**Backward Compatibility**: ✅ Maintained
- No API changes
- No DTO changes
- No database changes
- No frontend changes required

The architecture is production-ready. Complete the remaining module migrations following the documented patterns.
