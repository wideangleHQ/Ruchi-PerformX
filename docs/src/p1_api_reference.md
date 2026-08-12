# API reference

Base URL: `http://localhost:4000/api/v1` in development,
`https://api.ruchiperformx.in/api/v1` in production.

Every endpoint requires `Authorization: Bearer <jwt>` unless it is marked
public. Roles listed are what `@Roles(...)` allows; the service layer applies
further department and ownership checks on top. An endpoint with no role list
is reachable by any authenticated user.

Abbreviations: `ASSISTANTS` means EA, PA, and DEPARTMENT_CONTROLLER.

## Auth

| Method | Path | Roles |
| --- | --- | --- |
| POST | `/auth/register` | public |
| POST | `/auth/login` | public |
| POST | `/auth/forgot-password` | public |
| POST | `/auth/verify-reset-otp` | public |
| POST | `/auth/reset-password` | public |
| POST | `/auth/verify` | public, used by CareerX |
| GET | `/auth/check-md` | public |
| GET | `/auth/check-ea` | public |
| GET | `/auth/check-pa` | public |
| GET | `/auth/check-hod/:departmentId` | public |
| GET | `/auth/check-hod-name/:departmentName` | public |
| GET | `/auth/departments` | public |
| POST | `/auth/change-password` | authenticated |
| POST | `/auth/logout` | authenticated |
| GET | `/auth/me` | authenticated |

## Users

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/users` | MD, ADMIN, HOD, EA, PA, PURCHASE_HEAD, EMPLOYEE |
| GET | `/users/assignable` | MD, HOD, EA, PA, DEPT_CONTROLLER, PURCHASE_HEAD |
| GET | `/users/department/:departmentId` | MD, HOD, ADMIN, EA, PA, PURCHASE_HEAD |
| GET | `/users/:id` | MD, HOD, ADMIN, EA, PA, PURCHASE_HEAD |
| GET | `/users/check-md` | MD, HOD, ADMIN |
| GET | `/users/check-hod/:departmentId` | MD, HOD, ADMIN |
| POST | `/users` | ADMIN |
| PATCH | `/users/:id` | ADMIN |
| DELETE | `/users/:id` | ADMIN |
| GET | `/users/pending` | MD, HOD, EA, PA |
| PATCH | `/users/:id/approve` | MD, HOD, EA, PA |
| PATCH | `/users/:id/reject` | MD, HOD, EA, PA |
| GET | `/users/password-reset-requests` | MD, HOD, EA, PA |
| PATCH | `/users/:id/reset-password` | MD, HOD, EA, PA, ADMIN |
| PATCH | `/users/:id/admin-reset-password` | ADMIN |

Route ordering caution: `/users/pending` and `/users/password-reset-requests`
are declared after `/users/:id` in the controller file. Nest matches in
declaration order, so those literal paths are shadowed unless the parameterised
route rejects a non-UUID id. It works today because the service throws on a
malformed UUID, but the ordering is fragile. If you add another literal route
under `/users`, put it above `/users/:id`.

## Departments

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/departments` | MD, EA, PA, DEPT_CONTROLLER, HOD, ADMIN |
| GET | `/departments/:id` | same |
| POST | `/departments` | ADMIN |
| PATCH | `/departments/:id` | ADMIN |
| GET | `/internal/departments` | `x-internal-api-key` header, not a JWT |

## Tasks

| Method | Path | Roles |
| --- | --- | --- |
| POST | `/tasks` | MD, HOD, ASSISTANTS, PURCHASE_HEAD |
| GET | `/tasks` | MD, HOD, EMPLOYEE, ASSISTANTS, PURCHASE_HEAD |
| GET | `/tasks/pending` | same |
| GET | `/tasks/overdue` | MD, HOD, ASSISTANTS, PURCHASE_HEAD |
| GET | `/tasks/delegated-out` | HOD |
| GET | `/tasks/meta/departments` | MD, HOD, ASSISTANTS, PURCHASE_HEAD |
| GET | `/tasks/meta/assignees` | MD, HOD, ASSISTANTS, PURCHASE_HEAD |
| GET | `/tasks/meta/delegation-departments` | HOD |
| GET | `/tasks/:id` | MD, HOD, EMPLOYEE, ASSISTANTS, PURCHASE_HEAD |
| PATCH | `/tasks/:id` | MD, HOD, ASSISTANTS, PURCHASE_HEAD |
| DELETE | `/tasks/:id` | MD, HOD, ASSISTANTS, PURCHASE_HEAD |
| PATCH | `/tasks/:id/accept` | MD, EMPLOYEE, ASSISTANTS |
| PATCH | `/tasks/:id/reject` | MD, EMPLOYEE, ASSISTANTS |
| PATCH | `/tasks/:id/progress` | MD, EMPLOYEE, ASSISTANTS |
| PATCH | `/tasks/:id/complete` | MD, EMPLOYEE, ASSISTANTS |
| PATCH | `/tasks/:id/review` | MD, HOD, ASSISTANTS, PURCHASE_HEAD |
| PATCH | `/tasks/:id/close` | MD, HOD, ASSISTANTS |
| PATCH | `/tasks/:id/return` | MD, HOD, ASSISTANTS |
| PATCH | `/tasks/:id/status` | MD, HOD, ASSISTANTS, PURCHASE_HEAD, EMPLOYEE |

Employee shared tasks:

| Method | Path | Roles |
| --- | --- | --- |
| POST | `/tasks/employee-sharing` | EMPLOYEE |
| GET | `/tasks/employee-sharing` | MD, HOD, EMPLOYEE, ASSISTANTS, PURCHASE_HEAD |
| GET | `/tasks/employee-sharing/assignees` | same |
| GET | `/tasks/employee-sharing/departments` | EMPLOYEE |
| PATCH | `/tasks/employee-sharing/:id/status` | MD, HOD, EMPLOYEE, ASSISTANTS, PURCHASE_HEAD |
| DELETE | `/tasks/employee-sharing/:id` | HOD, MD, DEPT_CONTROLLER |

## Self actions

All open to EMPLOYEE, HOD, MD, EA, PA, DEPT_CONTROLLER. Reads and updates also
allow ADMIN.

| Method | Path |
| --- | --- |
| POST | `/self-actions` |
| GET | `/self-actions` |
| GET | `/self-actions/:id` |
| PATCH | `/self-actions/:id` |
| PATCH | `/self-actions/:id/status` |
| DELETE | `/self-actions/:id` |
| GET | `/self-actions/:id/comments` |
| POST | `/self-actions/:id/comments` |

## Comments

| Method | Path |
| --- | --- |
| POST | `/comments` |
| GET | `/comments/task/:taskId` |
| PATCH | `/comments/:id` |
| DELETE | `/comments/:id` |
| POST | `/tasks/:taskId/comments` |
| GET | `/tasks/:taskId/comments` |

## Attachments

| Method | Path |
| --- | --- |
| POST | `/attachments/upload/:taskId` |
| POST | `/attachments/upload/:taskId/comments/:commentId` |
| POST | `/attachments/upload/self-actions/:actionId` |
| POST | `/attachments/upload/self-actions/:actionId/comments/:commentId` |
| GET | `/attachments/task/:taskId` |
| GET | `/attachments/task/:taskId/comments/:commentId` |
| GET | `/attachments/self-actions/:actionId` |
| GET | `/attachments/self-actions/:actionId/comments/:commentId` |
| DELETE | `/attachments/:id` |

## Requests

| Method | Path | Roles |
| --- | --- | --- |
| POST | `/requests` | EMPLOYEE, HOD, EA, PA, DEPT_CONTROLLER, PURCHASE_HEAD |
| GET | `/requests` | above plus MD |
| GET | `/requests/:id` | above plus MD |
| PATCH | `/requests/:id/approve` | HOD, MD, EA, PA, DEPT_CONTROLLER, PURCHASE_HEAD |
| PATCH | `/requests/:id/reject` | same |

## Transfers

| Method | Path | Roles |
| --- | --- | --- |
| POST | `/transfers` | HOD, MD |
| GET | `/transfers` | HOD, MD |
| GET | `/transfers/:id` | HOD, MD |
| PATCH | `/transfers/:id/approve` | HOD, MD |
| PATCH | `/transfers/:id/reject` | HOD, MD |

## Notifications

| Method | Path |
| --- | --- |
| GET | `/notifications` |
| GET | `/notifications/unread-count` |
| PATCH | `/notifications/:id/read` |
| DELETE | `/notifications/:id` |

## Scoring

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/hod-score/me` | MD, EA, PA, HOD and related |
| GET | `/hod-score/company` | same |
| GET | `/hod-score/trends` | same |
| GET | `/hod-score/department/:departmentId` | same |
| GET | `/hod-score/:hodId` | same, plus `HodScoreAccessGuard` |

`ScoringService` has no controller. Employee scores are read through the
dashboard endpoint.

## Dashboard and profile

| Method | Path |
| --- | --- |
| GET | `/dashboard` |
| GET | `/profile` |
| PATCH | `/profile` |

`GET /dashboard` returns a different payload per role. It is the aggregation
layer over tasks, self actions, requests, scores, and incentives.

## VMS

See [Visitor management](p1_vms.md) for the full list. VMS endpoints require a
VMS token, not a PerformX token.

## Error shape

There is no global exception filter in PerformX, so errors come out in the
default Nest shape:

```json
{ "statusCode": 403, "message": "Insufficient permissions", "error": "Forbidden" }
```

Validation errors from the global pipe return a `message` array:

```json
{ "statusCode": 400, "message": ["title must be a string"], "error": "Bad Request" }
```

The client's axios interceptor in `src/api/client.ts` normalises both into a
single string for display. CareerX does have a global filter and a response
interceptor; PerformX does not. Adding one is a Phase 2 candidate but it changes
every response shape, so it needs the client updated in the same release.
