# Auth and roles

Three separate authentication systems live in this API. Knowing which one you
are in saves a lot of confusion.

1. **PerformX auth.** Username and password, signed with `JWT_SECRET`. Covers
   everything except VMS.
2. **VMS auth.** A numeric access code, signed with `VMS_JWT_SECRET`, carrying
   `scope: 'vms'`. Covers `/api/v1/vms/*`.
3. **Internal API auth.** A shared static key in the `x-internal-api-key`
   header. Covers `/api/v1/internal/*`, used only by CareerX.

## PerformX login

`POST /api/v1/auth/login` takes a username or email and a password, compares
against `password_hash` with bcrypt, and returns a signed JWT plus the user
record.

The token payload includes `sub` (user id), `username`, `role`, `departmentId`,
and `departmentIds` for multi-department users. The Socket.IO gateway reads all
of these to decide which rooms to join, so if you add a claim, check the gateway
too.

Default expiry is 24 hours (`JWT_EXPIRES_IN`). There are no refresh tokens. When
the token expires the user logs in again.

Login is rejected if the account is inactive, soft-deleted, or still
`pending_approval`.

## Signup and approval

Self-signup does not create a user. `POST /api/v1/auth/register` writes a row to
`registration_requests` with the password already hashed, a requested role, and
a department.

Before the form is submitted the client checks whether a given slot is already
taken, using a set of public endpoints:

- `GET /auth/check-md`, `check-ea`, `check-pa` for the singleton roles
- `GET /auth/check-hod/:departmentId` and `check-hod-name/:departmentName`
- `GET /auth/departments` to populate the department dropdown

These are all `@Public()`. They leak a small amount of organisational structure
to anyone who can reach the API, which is a known and accepted tradeoff for an
internal tool behind a corporate network.

Approval happens through the users module, not the auth module:

- `GET /users/pending` lists requests, visible to MD, HOD, EA, PA
- `PATCH /users/:id/approve` creates the real user row
- `PATCH /users/:id/reject` records a rejection reason

Role-specific validation runs at approval time in `auth.service.ts`: an employee
must be assigned exactly one department, a HOD must have at least one, and a
department controller must have at least one.

## Password reset

Two different flows exist, and the client uses both.

**Self-service, OTP by email.** Three calls:

1. `POST /auth/forgot-password` generates a six-digit OTP, bcrypt-hashes it into
   `otp_verifications`, invalidates any earlier unused OTP for that address, and
   emails the plaintext code through Resend.
2. `POST /auth/verify-reset-otp` compares the submitted code against the hash.
   On success it signs a 15 minute reset token, stores a bcrypt hash of that
   token as another `otp_verifications` row, and returns the token.
3. `POST /auth/reset-password` verifies the reset token both cryptographically
   and against its stored hash, then writes the new `password_hash`.

Storing a hash of the reset token as well as verifying its signature is belt and
braces, and it is what makes the token single use.

**Approver-driven.** An employee asks a superior to reset for them. The request
lands in `password_reset_requests`. `GET /users/password-reset-requests` lists
them for MD, HOD, EA, and PA. `PATCH /users/:id/reset-password` generates a
temporary password and sets `must_change_password`. Admins have a separate
`PATCH /users/:id/admin-reset-password`.

`POST /auth/change-password` is the authenticated self-service change, and it is
what clears `must_change_password`.

## Token verification for CareerX

`POST /api/v1/auth/verify` is marked `@Public()` and takes `{ token }` in the
body. It verifies the PerformX JWT and returns:

```json
{
  "userId": "...",
  "email": "...",
  "role": "HOD",
  "departmentId": "...",
  "departmentName": "...",
  "careerAccess": true
}
```

`careerAccess` is the `users.can_access_career_hr` column. CareerX calls this
endpoint during its SSO exchange and refuses to issue a session if the user is
not found or not active. Details on the CareerX side are in
[CareerX and VMS integration](p2_integration.md).

## Roles

Ten values in `role_enum`. Five of them are business roles rather than
permission tiers, which is why the `@Roles(...)` lists on controllers are long.

| Role | What it is | Rough scope |
| --- | --- | --- |
| `MD` | Managing Director | Everything, company wide |
| `EA` | Executive Assistant to the MD | Near-MD visibility, scoped to assigned departments |
| `PA` | Personal Assistant to the MD | Same as EA |
| `DEPARTMENT_CONTROLLER` | Controller over one or more departments | Those departments |
| `PURCHASE_HEAD` | Head of purchasing | Can assign and review tasks like a HOD |
| `HOD` | Head of Department | Departments listed in `hod_departments` |
| `EMPLOYEE` | Ordinary staff | Own work, own department |
| `ADMIN` | System administrator | User and department CRUD, no task involvement |
| `HR` | Human resources | Leave, holidays, and the vendor category list |
| `VENDOR` | An external vendor's portal login | Only rows in `vendor_assignments` |

`ADMIN` is a technical role. It creates users and departments and does not
appear anywhere in the task lifecycle.

`VENDOR` is the only role held by someone who does not work here, and it is the
one that does not behave like the others. See
[Vendor roles are not employee roles](#vendor-roles-are-not-employee-roles).

The codebase groups EA, PA, and department controller into a constant:

```ts
const ASSISTANT_ROLES: role_enum[] = [
  role_enum.EA,
  role_enum.PA,
  role_enum.DEPARTMENT_CONTROLLER,
];
```

You will see `...ASSISTANT_ROLES` spread into `@Roles()` decorators throughout
the tasks module. Use the constant rather than listing the three roles by hand.

## How authorization is enforced

`RolesGuard` is coarse. It only checks that `user.role` appears in the
`@Roles(...)` list on the handler or class. It knows nothing about departments,
ownership, or record state.

Everything finer than that lives in the services. A HOD is allowed to review
tasks by role, but whether they may review *this* task is decided in
`tasks.service.ts` against the department scope. When you add an endpoint,
assume `@Roles` is the outer fence and write the ownership check yourself.

Two consequences worth internalising:

An endpoint with no `@Roles` decorator is reachable by every authenticated user.
`RolesGuard` returns `true` when there is no metadata. Several read endpoints
rely on this deliberately, but it is easy to do by accident.

Role is read from the JWT, not from the database, on every request. A role
change does not take effect until the user's token expires or they log in
again. There is no token revocation.

## Vendor roles are not employee roles

Three permissions share the word vendor. They are granted by different people
for different purposes and must never collapse into one check:

| Question | Controlled by | Granted by |
| --- | --- | --- |
| Who inside RUCHI can manage vendors? | a `vendor_dashboard_access` row | MD or EA |
| Which vendor is working on what? | a `vendor_assignments` row | any authorised employee |
| Can the external vendor log in? | `users.vendor_id` plus `role: VENDOR` | ADMIN |

The first is a grant, not a role. It has three levels, weakest first:
`VENDOR_VIEWER` reads, `VENDOR_MANAGER` writes, `VENDOR_ADMIN` adds reviews.
MD and EA hold `VENDOR_ADMIN` implicitly and have no row; every other employee,
HOD and ADMIN included, has no vendor access at all until MD or EA grants it.
A fifth global role in `role_enum` was rejected for this, because it would leak
the same way `VENDOR` does when it is mishandled.

`VendorScopeService` is the only place that ranks the levels. Endpoints call
`assertAccess(userId, role, minimum)`; nothing re-implements the comparison,
and `vendor-access.spec.ts` is the test that fails if the order moves.

The third is the dangerous one. `RolesGuard` knows nothing about assignments,
so `role_enum.VENDOR` on an internal controller opens that route to every
vendor for every record it can return, which on `/vendors` is the vendor master
including each vendor's competitors. Every vendor-reachable route therefore
lives in `modules/vendor-portal/` and is scoped through `vendor_assignments`,
and `just vendor-roles` fails the build if `VENDOR` appears on a controller
anywhere else. It runs in CI, so this is a build failure rather than a review
promise.

`GET /vendor-access/me` is the one route in the vendor namespace with no
`@Roles`. It answers only about the caller and returns
`{ accessLevel: null }` to anyone without a grant, which is what the sidebar
reads to decide whether the Vendors entry renders.

## VMS access codes

Reception staff do not have PerformX accounts. `POST /api/v1/vms/access/verify`
takes a numeric code, looks it up, and on success signs a VMS token whose `sub`
is the access record id and whose `accessType` is `RECEPTION` or the employee
variant. The payload maps `RECEPTION` to `role: ADMIN` and everything else to
`role: EMPLOYEE`, purely so that `RolesGuard` has something to check.

`JwtAuthGuard` contains a defensive check on this path: it rejects VMS tokens
whose `sub` is not a UUID. That guards against a batch of older tokens that put
the numeric access code in `sub`. If you see
`Session expired. Please sign in again.` on a VMS route with a token that looks
valid, this is why.

VMS tokens default to an 8 hour expiry, which matches a shift.
