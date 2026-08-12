# Visitor management

Files: `server/src/modules/vms/`. Client: `client/app/vms/`.

VMS is a front desk product that happens to share a process with PerformX. It
has its own authentication, its own JWT secret, its own storage bucket, its own
client shell, and a directory layout that follows none of the conventions used
elsewhere in this repo. Treat it as a separate application when you work on it.

## Layout

`VmsModule` imports nine feature modules:

```
vms/
  access/         numeric access code login
  appointments/   scheduled visits before the visitor arrives
  visitors/       the person record, photos, blacklist
  visits/         one occurrence of a visit, check in and out
  passes/         printable visitor passes
  requests/       an employee asking reception to expect someone
  dashboard/      live counts for the reception screen
  reports/        daily, monthly, per employee, per visitor, plus export
  audit/          admin-only trail
  common/         events, listeners, mappers, templates, validators
  notifications/  VMS-specific notification service
  storage/        Supabase wrapper for visitor photos
```

Each feature is split into `controllers/`, `services/`, `repositories/`,
`entities/`, and `dto/`, with interface tokens and `@Inject(...)` for the
repositories. The rest of PerformX puts Prisma calls directly in the service.
Both styles are in the codebase. Follow whichever one you are already inside.

## Authentication

Reception staff do not have PerformX accounts. They log in with a numeric code:

```
POST /api/v1/vms/access/verify   { code: "1957" }
```

`AccessService.verifyAccess()` looks up the code and, on success, signs a token
with `VMS_JWT_SECRET` carrying:

```json
{
  "sub": "<uuid of the access record>",
  "accessType": "RECEPTION",
  "role": "ADMIN",
  "scope": "vms"
}
```

`accessType` `RECEPTION` maps to `role: ADMIN`, anything else maps to
`role: EMPLOYEE`. The role is synthetic and exists only so `RolesGuard` has
something to compare against. Default expiry is 8 hours, matching a shift.

The endpoint is `@Public()`, so it is reachable without a token. It is the only
public VMS endpoint.

`JwtAuthGuard` routes verification by path: any URL containing `/vms/` is
verified against `VMS_JWT_SECRET` and must carry `scope: 'vms'`. It also rejects
tokens whose `sub` is not a UUID, which is a guard against an older token format
that put the access code itself in `sub`.

## The visit flow

```
Employee raises a request           POST /vms/requests
        |
        v
Reception approves                  POST /vms/requests/:id/approve
        |
        v
A visit is created                  POST /vms/requests/:id/create-visit
        |                           status SCHEDULED, visitCode generated
        v
Visitor arrives, reception checks in POST /vms/visits/:id/check-in
        |                           status CHECKED_IN, checkInTime set
        v
Pass is printed                     GET  /vms/passes/:visitId/print
        |
        v
Visitor leaves                      POST /vms/visits/:id/check-out
                                    status CHECKED_OUT, checkOutTime set
```

Appointments are the other entry point: reception can create a visit directly
through `/vms/appointments` without an employee request, which is what happens
for walk-ins that were phoned ahead.

`VisitStatus` has six values. `SCHEDULED`, `CHECKED_IN`, and `CHECKED_OUT` are
the happy path. `CANCELLED` is set by the cancel endpoint. `NO_SHOW` and
`EXPIRED` exist in the enum but nothing sets them; there is no sweep job that
ages out unattended scheduled visits.

Check-in is idempotent: calling it on an already `CHECKED_OUT` visit returns the
visit unchanged instead of erroring. Check-out is not: it throws
`VisitStateViolationException` unless the visit is currently `CHECKED_IN`.

`visitCode` is generated on visit creation and is unique. It is what the
receptionist reads off a pass to find the visit.

## Visitors and photos

A `Visitor` is a person, reused across visits. It carries contact details, a
company name, an address, a status, and a `faceRecognitionConsent` flag.
Blacklisting sets `status: BLACKLISTED` with a reason and a timestamp.

Photos are `VisitorImage` rows typed by `VisitorImageType`: `PROFILE`,
`FACE_REFERENCE`, `AADHAAR_FRONT`, `AADHAAR_BACK`, `VISIT_CAPTURE`, `OTHER`.
Files go to the bucket named in `SUPABASE_VMS_BUCKET`.

The face recognition columns on both `Visit` and `VisitorImage`
(`faceVerifiedAt`, `faceMatchScore`, `isFaceTemplate`, `faceEmbeddingVersion`)
are schema only. No code computes or writes them. The same applies to
`aadhaarVerifiedAt`. The tables were built for a feature that was descoped.

`Visit.branchId` is a UUID column with no foreign key and no branches table.
Multi-branch was planned and not built. Every row carries whatever value was
passed in.

## Endpoints

Access:

| Method | Path | Auth |
| --- | --- | --- |
| POST | `/vms/access/verify` | public |

Visitors, all roles from ADMIN down to EMPLOYEE:

| Method | Path |
| --- | --- |
| POST | `/vms/visitors` |
| GET | `/vms/visitors` |
| GET | `/vms/visitors/:id` |
| PATCH | `/vms/visitors/:id` |
| DELETE | `/vms/visitors/:id` |
| PATCH | `/vms/visitors/:id/restore` |
| GET | `/vms/visitors/:id/visits` |
| POST | `/vms/visitors/:id/photo` |
| PUT | `/vms/visitors/:id/photo` |
| GET | `/vms/visitors/:id/photo` |

Visits:

| Method | Path |
| --- | --- |
| POST | `/vms/visits` |
| GET | `/vms/visits` |
| GET | `/vms/visits/:id` |
| POST | `/vms/visits/:id/check-in` |
| POST | `/vms/visits/:id/check-out` |
| GET | `/vms/visits/employees` |

Appointments:

| Method | Path |
| --- | --- |
| POST | `/vms/appointments` |
| GET | `/vms/appointments` |
| GET | `/vms/appointments/today` |
| GET | `/vms/appointments/upcoming` |
| GET | `/vms/appointments/:id` |
| PATCH | `/vms/appointments/:id` |
| POST | `/vms/appointments/:id/cancel` |
| POST | `/vms/appointments/:id/reschedule` |
| POST | `/vms/appointments/:id/complete` |

Requests:

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/vms/requests` | any role including EMPLOYEE |
| GET | `/vms/requests` | approvers only |
| GET | `/vms/requests/pending` | approvers only |
| GET | `/vms/requests/my` | any role |
| GET | `/vms/requests/:id` | any role |
| PATCH | `/vms/requests/:id` | any role |
| DELETE | `/vms/requests/:id` | any role |
| POST | `/vms/requests/:id/approve` | approvers only |
| POST | `/vms/requests/:id/reject` | approvers only |
| POST | `/vms/requests/:id/create-visit` | approvers only |

Passes:

| Method | Path |
| --- | --- |
| POST | `/vms/passes/generate` |
| GET | `/vms/passes/:visitId` |
| GET | `/vms/passes/:visitId/print` |
| POST | `/vms/passes/:visitId/reprint` |

Dashboard and reports:

| Method | Path |
| --- | --- |
| GET | `/vms/dashboard` |
| GET | `/vms/dashboard/summary` |
| GET | `/vms/dashboard/today` |
| GET | `/vms/dashboard/inside` |
| GET | `/vms/dashboard/recent` |
| GET | `/vms/dashboard/statistics` |
| GET | `/vms/dashboard/today/export` |
| GET | `/vms/reports/daily` |
| GET | `/vms/reports/monthly` |
| GET | `/vms/reports/employee/:employeeId` |
| GET | `/vms/reports/visitor-history/:visitorId` |
| GET | `/vms/reports/export` |

Audit, ADMIN only, and note the path is `/audit` rather than `/vms/audit`:

| Method | Path |
| --- | --- |
| GET | `/audit` |
| GET | `/audit/:id` |
| GET | `/audit/visitor/:visitorId` |
| GET | `/audit/visit/:visitId` |
| GET | `/audit/employee/:employeeId` |

The missing `vms/` prefix on the audit controller is a bug in the sense that it
breaks the naming pattern, but changing it breaks the client. Fix both together
or leave it.

## Client

`client/app/vms/` has two shells. `vms/reception/` is the front desk screen:
dashboard, visitors, visits, appointments, requests, passes, check-out, reports,
audit, settings. `vms/employee/` is the short flow an employee uses to raise a
visitor request, with success, expired, and unauthorized outcome pages.

## Phase 2 relevance

The Phase 2 scope calls for pushing a realtime notification to the host employee
when their visitor checks in, and for making visit history searchable from every
employee's dashboard. Both are additive: the data already exists in `visits`
with `hostEmployeeId`, and the socket gateway already has a `user:<id>` room.
The work is emitting on check-in and building the employee-facing view. See
[CareerX and VMS integration](p2_integration.md).
