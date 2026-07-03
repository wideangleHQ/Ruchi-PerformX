# Department Scope Architecture

## Overview

The **Department Scope Architecture** is a centralized authorization system that serves as the single source of truth for department-based data visibility and access control across the RUCHI PerformX ERP system.

This architecture eliminates duplicated department resolution logic from business modules and provides a consistent, secure, and maintainable approach to department-scoped queries.

## Core Principles

1. **Single Source of Truth**: `DepartmentScopeService` is the ONLY location that determines accessible departments
2. **No Direct Queries**: Business services must NEVER directly query `hod_departments`, `assistant_departments`, or `users.department_id`
3. **Request-Scoped Caching**: Department scope is resolved once per HTTP request and cached
4. **Type Safety**: All department filters use strongly typed `DepartmentScope` objects
5. **Security First**: All department validation happens server-side; never trust client payloads

## Architecture Components

### 1. DepartmentScope Type

**Location**: `src/common/types/department-scope.type.ts`

```typescript
interface DepartmentScope {
  unrestricted: boolean;  // true for MD, ADMIN, EA, PA
  departmentIds: string[]; // accessible department IDs
}
```

### 2. DepartmentScopeService

**Location**: `src/common/services/department-scope.service.ts`

**Responsibility**: Resolve department visibility based on user role

**Key Methods**:
- `resolveDepartmentScope(user: JwtPayload): Promise<DepartmentScope>`
- `validateDepartmentAccess(user: JwtPayload, submittedDepartmentIds: string[]): Promise<boolean>`

**Business Rules**:

| Role | Access Type | Department Source |
|------|-------------|-------------------|
| MD | Unrestricted | N/A (company-wide) |
| ADMIN | Unrestricted | N/A (company-wide) |
| EA | Unrestricted | N/A (company-wide) |
| PA | Unrestricted | N/A (company-wide) |
| HOD | Department-scoped | `hod_departments` table |
| PURCHASE_HEAD | Department-scoped | `assistant_departments` table |
| DEPARTMENT_CONTROLLER | Department-scoped | `assistant_departments` table |
| EMPLOYEE | Department-scoped | `users.department_id` |

### 3. DepartmentQueryHelper

**Location**: `src/common/helpers/department-query.helper.ts`

**Responsibility**: Provide reusable Prisma WHERE clause builders

**Available Helpers**:
- `buildTaskDepartmentFilter(scope)` - Uses `task_departments` junction table
- `buildSelfActionDepartmentFilter(scope)` - Uses `self_action_departments` junction table
- `buildRequestDepartmentFilter(scope)` - Filters by requester's department
- `buildTransferDepartmentFilter(scope)` - Filters by source/destination departments
- `buildEscalationDepartmentFilter(scope)` - Filters by task departments
- `buildIncentiveDepartmentFilter(scope)` - Filters by employee department
- `buildUserDepartmentFilter(scope)` - Filters users by department
- `buildNotificationDepartmentFilter(scope)` - Filters through task departments

## Usage Pattern

### Standard Implementation Flow

```typescript
@Injectable()
export class YourService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly departmentScopeService: DepartmentScopeService,
  ) {}

  async yourMethod(user: JwtPayload) {
    // Step 1: Resolve department scope (cached per request)
    const scope = await this.departmentScopeService.resolveDepartmentScope(user);

    // Step 2: Build query with centralized helper
    const where = {
      deleted_at: null,
      ...DepartmentQueryHelper.buildTaskDepartmentFilter(scope),
    };

    // Step 3: Execute query
    return this.prisma.tasks.findMany({ where });
  }
}
```

### Department Validation (Create/Update Operations)

```typescript
async createTask(dto: CreateTaskDto, user: JwtPayload) {
  // Validate submitted departments are within user's scope
  const isValid = await this.departmentScopeService.validateDepartmentAccess(
    user,
    dto.departmentIds,
  );

  if (!isValid) {
    throw new ForbiddenException(
      'You do not have access to the specified departments'
    );
  }

  // Proceed with creation
  return this.prisma.tasks.create({ data: dto });
}
```

## Integrated Modules

The following modules have been refactored to use the Department Scope Architecture:

### ✅ Dashboard Module

**File**: `src/modules/dashboard/dashboard.service.ts`

**Changes**:
- Removed `hodDeptIds()`, `taskScope()`, `requestScope()`, `transferScope()`, `escalationScope()`, `incentiveScope()`, `departmentVisibility()` helper methods
- Replaced all department resolution logic with `DepartmentScopeService.resolveDepartmentScope()`
- Replaced all WHERE clauses with `DepartmentQueryHelper` builders
- Single department scope resolution cached for entire dashboard request
- Queries now use `task_departments` junction table instead of `tasks.department_id`

**Before**:
```typescript
private taskScope(user: JwtPayload): Prisma.tasksWhereInput {
  if (user.role === role_enum.MD) return { deleted_at: null };
  if (user.role === role_enum.HOD) {
    const deptIds = user.departmentIds || [];
    return { deleted_at: null, department_id: { in: deptIds } };
  }
  // ... more duplicated logic
}
```

**After**:
```typescript
const scope = await this.departmentScopeService.resolveDepartmentScope(user);
const where = {
  deleted_at: null,
  ...DepartmentQueryHelper.buildTaskDepartmentFilter(scope),
};
```

## Database Schema Notes

### Task Departments (Junction Table)

**Table**: `task_departments`

This is the **single source of truth** for task authorization. Do NOT use `tasks.department_id` for access control.

**Why?**
- Tasks can span multiple departments
- `tasks.department_id` is legacy metadata only
- `task_departments` junction table properly models many-to-many relationships

### Self Action Departments (Junction Table)

**Table**: `self_action_departments`

Similar to tasks, self actions use a junction table for department associations.

### Legacy Fields Preserved

The following fields remain in the database for backward compatibility and reporting:
- `users.department_id` (used ONLY for EMPLOYEE role resolution)
- `tasks.department_id` (legacy metadata, NOT used for authorization)

## Security Considerations

### ✅ Server-Side Validation

All department scope resolution and validation happens server-side. Never trust client-supplied department IDs without validation.

```typescript
// ❌ WRONG: Trusting client payload
const where = { department_id: { in: dto.departmentIds } };

// ✅ CORRECT: Server-side validation
const isValid = await this.departmentScopeService.validateDepartmentAccess(
  user,
  dto.departmentIds,
);
if (!isValid) throw new ForbiddenException();
```

### ✅ Horizontal Authorization

Department scope prevents users from accessing data outside their authorized departments.

```typescript
// HOD of Sales cannot access Production department data
// Scope automatically enforces: departmentIds = ['sales-id']
```

### ✅ Vertical Privilege Escalation Prevention

Users cannot escalate privileges by modifying role in request payloads. Role always comes from verified JWT token.

```typescript
// Role always derived from JWT, never from request body
const scope = await this.departmentScopeService.resolveDepartmentScope(user);
```

## Performance Optimizations

### Request-Scoped Caching

`DepartmentScopeService` uses NestJS `@Injectable({ scope: Scope.REQUEST })` to cache department scope resolution per HTTP request.

**Before** (Multiple DB Queries):
```typescript
// Dashboard makes 10 service calls
// Each service queries hod_departments/assistant_departments
// Result: 10 database queries
```

**After** (Single DB Query):
```typescript
// Scope resolved once, cached for request lifetime
// All services reuse cached scope
// Result: 1 database query
```

### Indexed Lookups

All department junction tables have proper indexes:
- `task_departments.department_id`
- `self_action_departments.department_id`
- `hod_departments.hod_id`
- `assistant_departments.assistant_id`

## Migration Guide

### Step 1: Inject DepartmentScopeService

```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly departmentScopeService: DepartmentScopeService, // Add this
) {}
```

### Step 2: Replace Department Resolution Logic

```typescript
// Before
const deptIds = user.role === role_enum.HOD
  ? user.departmentIds
  : user.departmentId ? [user.departmentId] : [];

// After
const scope = await this.departmentScopeService.resolveDepartmentScope(user);
```

### Step 3: Replace WHERE Clauses

```typescript
// Before
const where = {
  deleted_at: null,
  OR: [
    { department_id: { in: deptIds } },
    { task_departments: { some: { department_id: { in: deptIds } } } },
  ],
};

// After
const where = {
  deleted_at: null,
  ...DepartmentQueryHelper.buildTaskDepartmentFilter(scope),
};
```

### Step 4: Add Department Validation

```typescript
// For create/update operations
const isValid = await this.departmentScopeService.validateDepartmentAccess(
  user,
  dto.departmentIds,
);
if (!isValid) {
  throw new ForbiddenException('Invalid department access');
}
```

## Testing

### Unit Testing

Mock `DepartmentScopeService` in your tests:

```typescript
const mockDepartmentScopeService = {
  resolveDepartmentScope: jest.fn().mockResolvedValue({
    unrestricted: false,
    departmentIds: ['dept-1', 'dept-2'],
  }),
  validateDepartmentAccess: jest.fn().mockResolvedValue(true),
};
```

### Integration Testing

Test different role scenarios:

```typescript
describe('Dashboard with Department Scope', () => {
  it('should return company-wide data for MD', async () => {
    const mdUser = { role: role_enum.MD, sub: 'md-id' };
    const result = await service.getDashboard(mdUser);
    expect(result.activeTasks).toBeGreaterThan(0);
  });

  it('should return department-scoped data for HOD', async () => {
    const hodUser = {
      role: role_enum.HOD,
      sub: 'hod-id',
      departmentIds: ['sales-id'],
    };
    const result = await service.getDashboard(hodUser);
    // Verify only sales department data returned
  });

  it('should reject invalid department access', async () => {
    const employeeUser = { role: role_enum.EMPLOYEE, departmentId: 'sales-id' };
    await expect(
      service.createTask({ departmentIds: ['production-id'] }, employeeUser)
    ).rejects.toThrow(ForbiddenException);
  });
});
```

## Backward Compatibility

### API Contracts Unchanged

All existing REST endpoints maintain the same:
- Request DTOs
- Response formats
- HTTP status codes
- Route paths

### Frontend Compatibility

No frontend changes required. The refactor is purely backend architecture.

### Database Schema Unchanged

No database migrations needed. All tables and columns remain intact.

## Future Enhancements

### Employee Multi-Department Support

The architecture is designed to easily support employees belonging to multiple departments:

1. Create `employee_departments` junction table
2. Update `DepartmentScopeService.getEmployeeDepartment()` to query junction table
3. No changes needed in business modules (they already use `DepartmentScope`)

### Department Hierarchies

Support for department hierarchies can be added:

```typescript
async resolveHierarchicalScope(user: JwtPayload): Promise<DepartmentScope> {
  const scope = await this.resolveDepartmentScope(user);
  const childDepartments = await this.getChildDepartments(scope.departmentIds);
  return {
    unrestricted: scope.unrestricted,
    departmentIds: [...scope.departmentIds, ...childDepartments],
  };
}
```

## Troubleshooting

### Issue: User Cannot See Data

**Check**:
1. Verify role in JWT token: `console.log(user.role)`
2. Check department scope: `const scope = await departmentScopeService.resolveDepartmentScope(user)`
3. Verify junction table entries: `SELECT * FROM hod_departments WHERE hod_id = '...'`

### Issue: Performance Degradation

**Check**:
1. Verify request-scoped caching is working
2. Check database indexes on junction tables
3. Monitor N+1 query patterns

### Issue: Forbidden Errors on Valid Operations

**Check**:
1. Verify `validateDepartmentAccess()` is called correctly
2. Check submitted departmentIds match user's scope
3. Verify unrestricted roles (MD/EA/PA) bypass validation

## Conclusion

The Department Scope Architecture provides:

✅ **Centralized** department resolution logic  
✅ **Consistent** authorization across all modules  
✅ **Secure** server-side validation  
✅ **Performant** request-scoped caching  
✅ **Maintainable** single source of truth  
✅ **Type-safe** strongly typed scopes  
✅ **Backward compatible** no breaking changes  

For questions or issues, refer to:
- `src/common/services/department-scope.service.ts`
- `src/common/helpers/department-query.helper.ts`
- `src/modules/dashboard/dashboard.service.ts` (reference implementation)
