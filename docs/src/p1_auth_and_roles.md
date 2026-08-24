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

`POST /api/v1/auth/register` creates the user row directly, as
`is_active: false` and `pending_approval: true`, so the account exists but
cannot log in until somebody approves it.

This chapter used to say signup wrote to `registration_requests` and created no
user. That was the intent and never the code: `register` created a live user
with `is_active: true` and never set `pending_approval`, and the role came
straight off the request body with `@IsEnum(role_enum)` behind it. So anybody
who could reach the signup page could create an active MD account and log in,
while `/register-success` told them they were awaiting approval. The description
being wrong is most of why it lasted. `registration_requests` is still
referenced by no server code.

Two gates now. `RegisterDto` accepts only the roles the signup form offers,
`SELF_REGISTERABLE_ROLES`, which excludes ADMIN and VENDOR: ADMIN administers
the system and VENDOR belongs to the external portal that `just vendor-roles`
keeps out of the main API. And the request lands pending regardless, so a role
that passes the whitelist still needs a human.

Approval is `PATCH /users/:id/approve`, which sets `is_active: true` and clears
the flag; `/reject` leaves it inactive. `GET /users/pending` lists the queue,
scoped to a HOD's own departments. All three were unreachable until recently:
`@Get('pending')` was declared below `@Get(':id')`, so Nest read "pending" as a
user id and 404'd. `self-registration.spec.ts` covers both gates.

The queue is at `/approvals`, in the sidebar for MD, HOD, EA and PA. It shows
the requested role, because that is what the applicant asked for rather than
anything they proved.

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

Three flows exist.

**Changing your own password.** `POST /auth/change-password`, from Settings. It
takes `currentPassword` and `newPassword` and verifies the first with bcrypt
before writing. That check is the point: the route used to take only
`newPassword`, so a live session was enough to take an account over without
knowing the old password, and there was no length rule either, which made this
the way round the only password requirement the product has.

It is also the only password path that does not touch email, so while
`RESEND_FROM_EMAIL` points at an unverifiable domain it is the one that works.

The two reset flows:

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

The client holds the token in `sessionStorage` between step 2 and step 3 and
clears it on success. It is a credential, so it does not travel in the query
string, where it would reach browser history, referrer headers and any proxy log
on the way.

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
| `HR` | Human resources | Leave and holidays, no task involvement |
| `VENDOR` | An external vendor's portal login | Only what `vendor_assignments` grants it |

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
### VENDOR is the exception, and it is the reason this section matters

`VENDOR` is the only role in `role_enum` held by someone who does not work
here. Every other part of this API was written assuming the holder of a valid
JWT is an employee, and `RolesGuard` knows nothing about assignments — so
adding `role_enum.VENDOR` to a decorator opens that endpoint to **every** vendor
for **every** record it can return.

Three rules make that safe, and all three are load bearing:

1. Every vendor-reachable route lives under `modules/vendor-portal/` on the
   `/vendor` and `/vendor-deliverables` prefixes. No internal controller carries
   `role_enum.VENDOR`, and none gets an `if (role === VENDOR)` branch.
   `just vendor-roles` fails the build if VENDOR appears on a controller outside
   that directory.
2. Every detail endpoint calls `VendorScopeService.assertVendorAccess` before it
   reads a record. Every list endpoint merges `VendorScopeService.vendorFilter`
   into its `where`. `vendorFilter` returns `{ id: { in: [] } }` when the vendor
   has no assignments, which matches nothing — an empty filter object would
   match everything, and that failure mode is the whole task table.
3. The vendor is resolved with `VendorScopeService.vendorIdForUser`, which
   throws when a VENDOR account has no `vendor_id`. Such an account can be
   scoped to nothing and must never fall through to an unfiltered query.

A vendor portal login is created by an admin through `POST /users` with
`role: VENDOR`, `vendor_id` set, `department_id` null, and
`must_change_password: true`. Credentials are handed over out of band. Vendors
do not self-register: `POST /auth/register` writes a `registration_requests`
row and the approval flow assumes an internal employee with a department.

The four task transitions a vendor may perform are in
[Tasks](p1_tasks.md#the-state-machine). Everything else about the boundary is in
[Vendor management](p2_vendors.md#external-vendor-portal--kept-separate).
### HR and VENDOR

Phase 2 added `HR` and `VENDOR` to `role_enum`. Company assets is the first
module to give either of them a rule.

`HR` reads one employee's assets at a time, through
`GET /assets/employee/:userId`, and never a company wide list. On `GET /assets`
an HR caller falls through to the ordinary employee rule and sees only their
own. `HR` was also added to `GET /users`, because the offboarding screen needs
the directory to pick a leaver and a new owner; every other internal role
already had that route.

`VENDOR` is refused twice: it is absent from every `@Roles` list in
`assets.controller.ts`, and `AssetsService.assetScope` throws for it as well. A
vendor is external, and `RolesGuard` knows nothing about vendor assignments, so
one role list edit would otherwise open the company's credentials to everyone
with a portal login. `just vendor-roles` fails the build if `VENDOR` appears on
a controller outside `modules/vendor-portal/`.

## VMS access codes

Reception staff do not have PerformX accounts. `POST /api/v1/vms/access/verify`
takes a numeric code, looks it up, and on success signs a VMS token whose `sub`
is the access record id and whose `accessType` is `RECEPTION` or the employee
variant. The payload maps `RECEPTION` to `role: ADMIN` and everything else to
`role: EMPLOYEE`, purely so that `RolesGuard` has something to check.

A VMS token is accepted **only** under `/vms/`, and only when it carries
`scope: 'vms'`. The guard used to fall back to the VMS secret on every other
path, which meant a reception kiosk reached the whole API as `role: ADMIN`. That
fallback existed for one route, the audit controller, which was registered as
`/audit` rather than `/vms/audit`. Both were fixed together;
`jwt-auth.guard.spec.ts` fails if the fallback returns.

`JwtAuthGuard` contains a defensive check on this path: it rejects VMS tokens
whose `sub` is not a UUID. That guards against a batch of older tokens that put
the numeric access code in `sub`. If you see
`Session expired. Please sign in again.` on a VMS route with a token that looks
valid, this is why.

VMS tokens default to an 8 hour expiry, which matches a shift.
