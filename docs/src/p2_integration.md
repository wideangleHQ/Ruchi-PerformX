# CareerX and VMS integration

Two things that already exist and need to be pulled into the PerformX shell.
The career portal becomes a tab, and visitor arrivals start reaching the host
employee's dashboard.

Neither is a rebuild. The scope document is explicit that career portal work is
"limited to embedding it as a tab within PerformX and aligning its data with the
HR module, not rebuilding it."

# CareerX

CareerX has its own handbook at `CareerX/docs`. Read its architecture and
auth pages if you are working on the CareerX side. This page covers the seam
between the two.

## How the link works today

```
User logs in to PerformX          POST /api/v1/auth/login
                                  gets a PerformX JWT
        |
        v
User clicks the Career tab
Client redirects to CareerX with the PerformX token
        |
        v
CareerX exchange                  POST /api/v1/auth/exchange
        |
        +-- local pre-verify: HS256 signature, expiry, issuer
        |   (skipped when PERFORMX_JWT_SECRET is unset)
        |
        +-- remote verify:  POST {PERFORMX_API_URL}/api/v1/auth/verify
        |   returns userId, email, role, departmentId, careerAccess
        |
        +-- HR access check: hr_employees.is_active plus
        |   hr_role_permissions for that role, or careerAccess = true
        |
        v
CareerX issues its own session    career_at cookie + career_rt refresh token
```

The PerformX token is never stored, logged, or returned by CareerX. That is
enforced in `SSOExchangeService` and it is worth preserving.

Two transports are supported. In development the PerformX JWT arrives as an
`Authorization: Bearer` header. In production it arrives as a `px_at` HTTP-only
cookie, which requires both apps on the same parent domain.

`users.can_access_career_hr` on the PerformX side is the master switch. It is
returned as `careerAccess` by `/auth/verify` and, when true, bypasses the
permission check in `validateHRResult`.

## What has to be fixed first

**CareerX calls an endpoint PerformX does not have.**

`CareerX/server/src/integrations/performx/performx.client.ts` has
`getEmployees()`, calling `GET /api/v1/internal/employees`. PerformX serves only
`/api/v1/internal/departments`. The employee sync cron runs every six hours,
gets a 404, converts it to `ServiceUnavailableException`, and fails silently.
`hr_employees` is therefore stale or populated by hand.

The fix is on the PerformX side. Add an internal employees controller alongside
the existing departments one:

```ts
@ApiExcludeController()
@Public()
@Controller('internal/employees')
@UseGuards(InternalApiGuard)
export class InternalEmployeesController {
  @Get()
  async getEmployees() {
    return this.usersService.findInternal();
  }
}
```

Return `{ id, fullName, email, departmentId, role, isActive }` per user. The
CareerX client accepts both camelCase and snake_case keys and both a bare array
and a `{ data: [...] }` envelope, so the exact shape is forgiving. Filter out
soft-deleted users; do not filter out inactive ones, because CareerX needs to
know somebody was deactivated in order to deactivate their `hr_employees` row.

This is a half-day fix and it unblocks everything else in this section.

**Set `PERFORMX_JWT_SECRET` on CareerX.** When it is unset, CareerX skips local
verification entirely and relies on the remote call. That was a deliberate
allowance for early development. It should not survive into Phase 2, because it
means a network partition degrades to no verification at all rather than to a
failure.

**Decide the production domain layout.** The cookie transport needs
`app.ruchiperformx.in` and the CareerX HR host on the same parent domain, with
`AUTH_COOKIE_DOMAIN` set on the CareerX side. Confirm this before building the
tab, because falling back to the header transport in production means the
PerformX JWT travels in a URL or in JavaScript-readable storage.

## Embedding as a tab

Three options, in order of preference.

**Same-tab navigation with a return path.** The Career nav item navigates the
browser to the CareerX HR host. CareerX renders its own shell, with a "back to
PerformX" link. Simplest, no iframe, no cross-origin problems, and the session
exchange already works this way.

The cost is that the user visibly leaves PerformX. For a tab that HR uses for a
stretch at a time rather than glancing at, that is acceptable.

**An iframe inside the PerformX shell.** Looks more integrated. Needs CareerX to
serve a chromeless variant, needs frame-ancestors headers configured, and
inherits every cookie-in-iframe problem that modern browsers create. Not worth
it for this budget.

**Rebuilding the HR screens inside PerformX against the CareerX API.** Explicitly
out of scope.

Take the first option. `client/app/(protected)/career/page.tsx` already exists
as a stub; wire it to redirect with the token exchange.

Show the Career nav item only when `can_access_career_hr` is true or the user's
role has career permissions. A tab that 403s on click reads as broken software.

## Aligning with the HR module

The scope document asks for candidate data to flow into HR onboarding without
re-entry, and for HR to see the career portal alongside leave and employee
documents.

The realistic Phase 2 version:

**Selected candidate to employee.** When a CareerX application reaches
`SELECTED` or `JOINED`, HR should be able to create a PerformX user from it
without retyping the name, email, and phone. That means a PerformX endpoint
CareerX can call, or a hand-off screen that pre-fills the PerformX user form
from CareerX data.

The lower-risk version is the pre-filled form: CareerX redirects to the PerformX
user creation screen with query parameters, HR reviews and submits. No new
service-to-service write path, no risk of CareerX creating accounts.

The tighter version is `POST /internal/users` on PerformX behind
`InternalApiGuard`, called by CareerX on status change. Cleaner for HR, but it
gives CareerX the ability to create PerformX accounts, which is a meaningful
increase in what a compromise of CareerX would allow.

Recommendation: pre-filled form for Phase 2. Revisit if HR complains about
volume.

**Do not merge the databases.** They are deliberately separate. CareerX caches
`departments` and `hr_employees` from PerformX and owns everything else. That
boundary is what lets the career portal be publicly reachable without exposing
employee data.

# Visitor management

VMS already works. Phase 2 extends it in two directions, and both are additive.

## Notify the host employee on check-in

Today reception checks a visitor in and nothing reaches the person being
visited. `Visit.hostEmployeeId` already points at a `users` row, and the socket
gateway already has a `user:<id>` room. The work is emitting.

In `visit.service.ts`, after a successful check-in:

```ts
await this.notifications.notify({
  recipientId: visit.hostEmployeeId,
  type: 'VISITOR_ARRIVED',
  title: 'Your visitor has arrived',
  message: `${visit.visitor.fullName} from ${visit.visitor.companyName} is at reception`,
  entityType: 'visit',
  entityId: visit.id,
});
```

Two things to watch.

The host is a PerformX user but the check-in is performed under a VMS token.
The VMS notification service is separate from the main one
(`modules/vms/notifications/`). Route this through the main engine so the
notification lands in the employee's ordinary bell, not a VMS-only channel.

`VISITOR_ARRIVED` should be in-app only. A visitor at reception is an immediate
event and email is the wrong medium for it.

## Visit history on employee dashboards

The scope document asks for visit history searchable by employee, department, or
date, available to every employee rather than only reception.

`GET /vms/reports/employee/:employeeId` already exists but is restricted to MD,
EA, PA, HOD, and ADMIN. Add an endpoint that returns the caller's own history
with no role restriction:

```
GET /vms/visits/mine
```

Filtered on `hostEmployeeId = caller`. This is the safe version: an employee
sees their own visitors and nobody else's. Widening it to department-level
visibility is a separate decision, and visitor records include personal contact
details, so it should be made explicitly rather than by default.

## What not to do

Do not extend the face recognition or Aadhaar verification columns. They are
schema-only leftovers from a descoped feature. See
[Visitor management](p1_vms.md#visitors-and-photos). Adding to them implies a
capability that does not exist.

Do not fix the `/audit` route prefix in this phase unless you are also updating
the VMS client in the same release. It should be `/vms/audit`, it is not, and
changing it breaks the reception audit screen.
