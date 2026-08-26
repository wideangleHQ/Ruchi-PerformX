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

**CareerX called an endpoint PerformX did not have. Built.**

`CareerX/server/src/integrations/performx/performx.client.ts` has
`getEmployees()`, calling `GET /api/v1/internal/employees`. PerformX served only
`/api/v1/internal/departments`. The employee sync cron ran every six hours, got
a 404, converted it to `ServiceUnavailableException`, and failed silently.
`hr_employees` is therefore stale or populated by hand until the next sync runs.

`modules/internal/` now serves it, alongside the existing departments
controller and behind the same `InternalApiGuard`:

```ts
@ApiExcludeController()
@Public()
@Controller('internal/employees')
@UseGuards(InternalApiGuard)
export class InternalEmployeesController {
  @Get()
  async getEmployees() {
    return this.internalEmployeesService.findInternal();
  }
}
```

It returns `{ id, fullName, email, departmentId, role, isActive }` per user. The
CareerX client accepts both camelCase and snake_case keys and both a bare array
and a `{ data: [...] }` envelope, so the exact shape is forgiving. Soft-deleted
users are filtered out; inactive ones are not, because CareerX needs to know
somebody was deactivated in order to deactivate their `hr_employees` row.

The shaping is a pure function, `toInternalEmployees` in
`internal-employees.service.ts`, and the pinning test is
`internal-employees.spec.ts`. Getting those two filters the wrong way round is
silent: a departed employee keeps career portal access.

**Set `PERFORMX_JWT_SECRET` on CareerX.** Still outstanding, and it is
configuration rather than code. When it is unset, CareerX skips local
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

The first option is built. `client/app/(protected)/career/page.tsx` checks
access, reads the PerformX token, and calls `launchCareerX` in
`client/src/api/career.ts`, which POSTs the token to `/auth/exchange` with
`credentials: 'include'` so CareerX can set its own session cookies, then
navigates the browser to `${CAREER_APP_URL}/dashboard?returnTo=<url>`.

The two `NEXT_PUBLIC_CAREER_*` bases are inlined at build time, which is what
broke the tab in production while local and preview kept working: they were
marked Sensitive in the Vercel Production environment, `vercel pull` returned
`[SENSITIVE]` for both, and the shipped bundle called
`fetch("[SENSITIVE]/auth/exchange")`. A relative URL against
`app.ruchiperformx.in` is a 404 HTML page, so the exchange never reached
CareerX at all. `launchCareerX` now rejects a base that is not an `http(s)` URL
and names the variable. See [Setup](p1_setup.md#client-environment).

`returnTo` is the contract for the link back. It is a URL-encoded absolute
PerformX URL, `/dashboard` by default, and CareerX's shell is what renders it.
The exchange itself is unchanged; the token stays in the `Authorization` header
and is not logged or persisted on the way through.

The Career nav item shows only when `can_access_career_hr` is true or the user
is in the HR department. That check lives in `Sidebar.tsx` and is not repeated
anywhere else. The page keeps its own copy of the access check because it is
reachable by direct navigation, and it redirects to `/dashboard` rather than
letting CareerX answer with a 403.

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

Built. Reception used to check a visitor in and nothing reached the person being
visited. `Visit.hostEmployeeId` already pointed at a `users` row and the socket
gateway already had a `user:<id>` room, so the work was emitting.

`VisitService.checkIn` now calls `notifyHostOfArrival` after the check-in
transaction commits:

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

Two things this had to get right.

The host is a PerformX user but the check-in is performed under a VMS token, and
the VMS notification service (`modules/vms/notifications/`) is separate from the
main one. `VisitsModule` imports the main `NotificationsModule`, so the
notification lands in the employee's ordinary bell rather than a VMS-only
channel.

`VISITOR_ARRIVED` is in-app only. A visitor at reception is an immediate event
and email is the wrong medium for it. That is already what
`notification-channels.constants.ts` says, and the call does not override it.

The notification never fails the check-in. It reads the visitor's `fullName` and
`companyName` with one extra primary key read rather than widening the shared
visit select that four other endpoints return, and any error is logged and
swallowed, because by then the visitor is already inside the building.

Note `visitors."companyName"` is camelCase in the live schema. A `company_name`
column was dropped recently; do not reach for it.

## Visit history on employee dashboards

Built. The scope document asks for visit history searchable by employee,
department, or date, available to every employee rather than only reception.

`GET /vms/reports/employee/:employeeId` already existed but is restricted to MD,
EA, PA, HOD, and ADMIN. The addition returns the caller's own history and is
open to every internal role:

```
GET /vms/visits/mine
```

It takes the same query parameters as `GET /vms/visits` and overwrites
`hostEmployeeId` with the caller after the spread, so asking for somebody else's
returns your own. This is the safe version: an employee sees their own visitors
and nobody else's. Department-level visibility was deliberately not built.
Visitor records include personal contact details, so widening it is a decision
to be made explicitly rather than by default.

## What not to do

Do not extend the face recognition or Aadhaar verification columns. They are
schema-only leftovers from a descoped feature. See
[Visitor management](p1_vms.md#visitors-and-photos). Adding to them implies a
capability that does not exist.

The `/audit` route prefix is fixed. It is `/vms/audit`, and the VMS client
moved in the same commit, which is what the warning here used to ask for. The
prefix mattered for more than tidiness: it was the only VMS route outside the
namespace, and the token fallback that existed to serve it let a reception kiosk
authenticate against the whole API. See
[Auth and roles](p1_auth_and_roles.md#vms-access-codes).
