# Phase 2 schema changes

Every table Phase 2 needs, in one place, so the migration can be planned as a
whole rather than discovered module by module.

Read [Known gaps](p1_known_gaps.md#no-database-migrations) first. There is no
migration history in this repository. Establishing one is the prerequisite for
everything below.

One thing to keep in view while these tables are designed: if
[The PerformX Assistant](p2_assistant.md) is built, every table here needs a
row-level security policy before the assistant can read it. Policies are far
cheaper to write alongside a new table than to retrofit across thirty of them.

## Setting up migrations

Before writing any new table:

```bash
cd server
mkdir -p prisma/migrations/0_init
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql
npx prisma migrate resolve --applied 0_init
```

That records the current schema as an already-applied baseline. From then on,
`prisma migrate dev` locally and `prisma migrate deploy` in the pipeline. Verify
the whole sequence against a restored copy of production before touching the
real database.

Existing hand-applied SQL lives in `prisma/sql/`. Fold
`add_can_access_career_hr.sql` into the baseline; it is already applied in
production.

## Changes to existing tables

### `role_enum`

Add two values:

```prisma
enum role_enum {
  MD
  EA
  PA
  DEPARTMENT_CONTROLLER
  PURCHASE_HEAD
  HOD
  EMPLOYEE
  ADMIN
  HR        // new
  VENDOR    // new
}
```

`HR` is pending the decision in [Plan and sequencing](p2_plan.md#open-questions-to-settle-before-week-1).
If the client decides an existing role covers HR, skip it.

Adding an enum value in Postgres is safe and non-blocking. Removing one is not,
so do not add speculative values.

Every `@Roles(...)` list in the codebase now needs auditing. A new role is
denied everywhere by default, which is the safe direction, but it means the
vendor and HR dashboards will 403 until each endpoint is explicitly opened.

### `users`

```prisma
date_of_birth   DateTime?  @db.Date     // birthday cards
joined_on       DateTime?  @db.Date     // leave accrual base
vendor_id       String?    @db.Uuid     // FK to vendors, null for internal users
reporting_to_id String?    @db.Uuid     // leave approval routing
```

`vendor_id` replaces the earlier flat `vendor_company` text field now that
vendor identity lives in its own `vendors` table, see [Vendors](#vendors-1).
A `users` row with `role: VENDOR` is a portal login for a `vendors` row; not
every vendor needs one.

**This is the only destructive migration in Phase 2**, because
`users.vendor_company` already exists in production with rows in it. Three
steps, three separate deploys, not one:

1. Add `vendors` and `users.vendor_id`. Backfill: one `vendors` row per
   distinct non-null `vendor_company`, then set `vendor_id` on each user from
   it. Leave `vendor_company` in place and still written to.
2. Switch every read to `vendor_id`. Verify no code path reads
   `vendor_company`: `grep -rn "vendor_company" server/src`.
3. Drop `vendor_company`.

Doing steps 1 and 3 in the same migration means any missed reader breaks at
deploy with no way back except a restore. The column is small and one extra
release is cheaper than that.

`reporting_to_id` deserves thought. The scope document routes leave to "the
immediate Reporting Manager/HOD." Today there is no reporting line in the
schema, only department membership. Two options:

Use `hod_departments` and route to the HOD of the applicant's department. Zero
new columns, works immediately, wrong for anyone whose manager is not their
department head.

Add `reporting_to_id` as an explicit self-reference on `users`. Correct, but
somebody has to populate it for a hundred people before leave can go live.

Recommendation: add the column, fall back to the department HOD when it is null.
That ships in Week 1 without a data entry blocker and gets more accurate as the
column is filled in.

### `notifications`

The rebuild in [Notification engine](p2_notifications.md) needs:

```prisma
entity_type  String?   @db.VarChar(50)   // 'leave', 'project', 'poll', 'visit'
entity_id    String?   @db.Uuid
channel      notification_channel_enum @default(IN_APP)
delivered_at DateTime? @db.Timestamptz(6)
```

`task_id` stays for backward compatibility but new code should use
`entity_type` and `entity_id`. The existing `metadata` string column can absorb
anything else.

Also add an index for the read-all endpoint:

```prisma
@@index([user_id, is_read, created_at])
```

`notification_type_enum` gains roughly twenty-five values. Add them all in one
migration rather than one per module. The list lives in
[Notification engine](p2_notifications.md#new-notification-types), not here.

## New tables

### Leave

```prisma
model leave_types {
  id                 String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name               String   @unique @db.VarChar(50)   // Casual, Sick, Earned, Unpaid, Comp-off
  annual_entitlement Int      @default(0)
  is_paid            Boolean  @default(true)
  carry_forward      Boolean  @default(false)
  max_carry_forward  Int      @default(0)
  requires_proof     Boolean  @default(false)
  is_active          Boolean  @default(true)
  created_at         DateTime @default(now()) @db.Timestamptz(6)
}

model leave_balances {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id       String   @db.Uuid
  leave_type_id String   @db.Uuid
  year          Int
  entitled      Decimal  @default(0) @db.Decimal(5, 1)
  used          Decimal  @default(0) @db.Decimal(5, 1)
  carried_over  Decimal  @default(0) @db.Decimal(5, 1)
  updated_at    DateTime @default(now()) @db.Timestamptz(6)

  @@unique([user_id, leave_type_id, year])
  @@index([user_id, year])
}

model leave_applications {
  id                 String              @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id            String              @db.Uuid
  leave_type_id      String              @db.Uuid
  start_date         DateTime            @db.Date
  end_date           DateTime            @db.Date
  days_count         Decimal             @db.Decimal(5, 1)   // half days
  reason             String
  status             leave_status_enum   @default(PENDING)
  manager_id         String?             @db.Uuid            // routing target, HOD
  approved_by_id     String?             @db.Uuid            // whoever acted, HOD or HR
  approved_by_role   String?             @db.VarChar(10)     // 'HOD' | 'HR'
  approved_at        DateTime?           @db.Timestamptz(6)
  approval_remark    String?
  cancelled_by_id    String?             @db.Uuid            // HR only, on an APPROVED leave
  cancelled_at       DateTime?           @db.Timestamptz(6)
  cancellation_reason String?                                // required by the service when cancelling an APPROVED leave
  created_at         DateTime            @default(now()) @db.Timestamptz(6)
  updated_at         DateTime            @default(now()) @db.Timestamptz(6)

  @@index([user_id, status, created_at])
  @@index([manager_id, status])
  @@index([approved_by_id, status])
  @@index([start_date, end_date])
}

model holidays {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name           String   @db.VarChar(255)
  holiday_date   DateTime @db.Date
  is_optional    Boolean  @default(false)
  department_id  String?  @db.Uuid   // null = common/company-wide, set = department-wise
  year           Int
  created_by_id  String   @db.Uuid
  created_at     DateTime @default(now()) @db.Timestamptz(6)

  @@unique([holiday_date, name, department_id])   // see the NULL caveat below
  @@index([year, department_id])
}

enum leave_status_enum {
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}
```

Single-stage approval: `status` moves straight from `PENDING` to `APPROVED`
or `REJECTED`, acted on by either an HOD or HR. `approved_by_role` records
which. HR-only cancellation of an `APPROVED` row is a second transition to
`CANCELLED` with `cancellation_reason` required by the service layer (not a
DB constraint, since Postgres can't conditionally require a column by
status without a trigger).

`holidays.department_id` is what makes a holiday common or department-wise,
and the unique constraint includes it so the same date and name can exist once
as common and once per department.

**That constraint does not stop duplicate common holidays.** Postgres treats
NULLs as distinct in a unique index, so two rows with the same date, the same
name, and `department_id: null` both insert cleanly. Common is the tier HR
maintains by hand for the whole company, so it is the tier most likely to get
double-entered, and a duplicate there silently double-excludes a day from every
leave calculation. Two ways to close it:

```sql
-- PG 15 and later
ALTER TABLE holidays
  ADD CONSTRAINT holidays_date_name_dept_uniq
  UNIQUE NULLS NOT DISTINCT (holiday_date, name, department_id);

-- any version
CREATE UNIQUE INDEX holidays_common_uniq
  ON holidays (holiday_date, name)
  WHERE department_id IS NULL;
```

Check the server version before choosing. Prisma cannot express either one in
the schema, so it goes in the migration by hand with a comment saying why.

`days_count` is `Decimal(5,1)` rather than `Int` so half days work. Deciding
against half days later is easy; adding them later is a migration on a table
that already has balance arithmetic depending on it.

`leave_balances` is per user, per type, per year. The unique key is what makes
the deduction safe under concurrency.

Details in [Leave management](p2_leave.md).

### Projects

```prisma
model projects {
  id            String              @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  project_code  String              @unique @db.VarChar(30)   // auto-generated
  title         String              @db.VarChar(255)
  project_type  String?             @db.VarChar(100)
  category      String?             @db.VarChar(100)
  priority      String              @default("MEDIUM") @db.VarChar(20)
  objective     String
  description   String
  tags          String[]
  status        project_status_enum @default(DRAFT)
  health        project_health_enum @default(ON_TRACK)   // recomputed, not hand-set
  lead_id       String              @db.Uuid
  co_lead_id    String?             @db.Uuid
  created_by_id String              @db.Uuid
  start_date    DateTime?           @db.Date
  deadline      DateTime?           @db.Timestamptz(6)
  closed_at     DateTime?           @db.Timestamptz(6)
  is_rnd        Boolean             @default(false)
  rnd_category  String?             @db.VarChar(100)
  created_at    DateTime            @default(now()) @db.Timestamptz(6)
  updated_at    DateTime            @default(now()) @db.Timestamptz(6)
  deleted_at    DateTime?           @db.Timestamptz(6)

  @@index([status, deleted_at, created_at])
  @@index([lead_id, status])
  @@index([health])
  @@index([deadline])
}

model project_members {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  project_id String   @db.Uuid
  user_id    String   @db.Uuid
  role       String   @default("MEMBER") @db.VarChar(20)   // PROJECT_LEAD, CO_LEAD, MEMBER, OBSERVER
  joined_at  DateTime @default(now()) @db.Timestamptz(6)

  @@unique([project_id, user_id])
  @@index([user_id])
}

model project_checklist_items {
  id             String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  project_id     String    @db.Uuid
  title          String    @db.VarChar(255)
  description    String?
  priority       String?   @db.VarChar(20)
  is_done        Boolean   @default(false)
  assigned_to_id String?   @db.Uuid
  due_date       DateTime? @db.Timestamptz(6)
  sort_order     Int       @default(0)
  completed_at   DateTime? @db.Timestamptz(6)
  created_at     DateTime  @default(now()) @db.Timestamptz(6)

  @@index([project_id, is_done])
}

model project_milestones {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  project_id  String    @db.Uuid
  name        String    @db.VarChar(255)
  description String?
  owner_id    String?   @db.Uuid
  start_date  DateTime? @db.Date
  due_date    DateTime? @db.Date
  status      String    @default("PLANNED") @db.VarChar(20)
  created_at  DateTime  @default(now()) @db.Timestamptz(6)

  @@index([project_id, due_date])
}

model project_success_criteria {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  project_id String   @db.Uuid
  criterion  String
  is_met     Boolean  @default(false)
  sort_order Int      @default(0)
  created_at DateTime @default(now()) @db.Timestamptz(6)

  @@index([project_id])
}

model project_kpis {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  project_id String   @db.Uuid
  metric     String   @db.VarChar(255)
  target     String?  @db.VarChar(100)
  actual     String?  @db.VarChar(100)
  status     String?  @db.VarChar(20)
  created_at DateTime @default(now()) @db.Timestamptz(6)

  @@index([project_id])
}

model project_activity_logs {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  project_id  String   @db.Uuid
  actor_id    String   @db.Uuid
  action_type String   @db.VarChar(30)   // MEMBER, STATUS, CHECKLIST, DEADLINE, MILESTONE, OUTCOME
  description String
  created_at  DateTime @default(now()) @db.Timestamptz(6)

  @@index([project_id, created_at])
}

model project_messages {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  project_id String   @db.Uuid
  user_id    String   @db.Uuid
  content    String
  created_at DateTime @default(now()) @db.Timestamptz(6)

  @@index([project_id, created_at])
}

model project_outcomes {
  id           String              @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  project_id   String              @db.Uuid
  entry_type   outcome_type_enum
  content      String
  logged_by_id String              @db.Uuid
  created_at   DateTime            @default(now()) @db.Timestamptz(6)

  @@index([project_id, entry_type])
}

model project_closure_reports {
  id                String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  project_id        String   @unique @db.Uuid
  executive_summary String
  objective         String
  final_outcome     String
  achievements      String?
  failures          String?
  learnings         String?
  kpi_results       String?
  recommendations   String?
  attachments       String[]
  submitted_by_id   String   @db.Uuid
  submitted_at      DateTime @default(now()) @db.Timestamptz(6)
}

enum project_status_enum {
  DRAFT
  PLANNED
  ACTIVE
  ON_HOLD
  AT_RISK
  COMPLETED
  CANCELLED
  ARCHIVED
}

enum project_health_enum {
  ON_TRACK
  AT_RISK
  DELAYED
}

enum outcome_type_enum {
  TRY
  FAILURE
  OUTCOME
}
```

`project_closure_reports.project_id` is unique, which enforces one report per
project at the database level. No MD review: no `md_viewed_at`, no approval
state — submitting this row is what unblocks the `COMPLETED` transition.

Details in [Projects](p2_projects.md).

### R&D

R&D reuses `projects` — `is_rnd` and `rnd_category` now live directly on the
`projects` model above rather than as a bolt-on, since Projects itself grew
enough fields that keeping them inline is simpler than tracking two field
sets.

Plus a team roster that is independent of any single project:

```prisma
model rnd_team_members {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id    String   @unique @db.Uuid
  added_by_id String  @db.Uuid
  added_at   DateTime @default(now()) @db.Timestamptz(6)
}

model rnd_reports {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  project_id    String?  @db.Uuid
  category      String   @db.VarChar(100)
  product_area  String   @db.VarChar(255)
  findings      String
  recommendation String
  supporting_data String?
  submitted_by_id String @db.Uuid
  created_at    DateTime @default(now()) @db.Timestamptz(6)

  @@index([category, created_at])
  @@index([submitted_by_id])
}
```

Details in [R&D and company assets](p2_rnd_and_assets.md).

### Company assets

```prisma
model company_assets {
  id            String           @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  owner_id      String           @db.Uuid
  asset_type    asset_type_enum
  label         String           @db.VarChar(255)
  username      String?          @db.VarChar(255)
  secret_cipher String?          // encrypted, never plaintext
  secret_iv     String?          @db.VarChar(64)
  url           String?          @db.VarChar(500)
  file_url      String?          @db.VarChar(500)
  storage_path  String?          @db.VarChar(500)
  notes         String?
  created_at    DateTime         @default(now()) @db.Timestamptz(6)
  updated_at    DateTime         @default(now()) @db.Timestamptz(6)
  deleted_at    DateTime?        @db.Timestamptz(6)

  @@index([owner_id, deleted_at])
  @@index([asset_type])
}

model asset_handovers {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  asset_id      String   @db.Uuid
  from_user_id  String   @db.Uuid
  to_user_id    String   @db.Uuid
  initiated_by_id String @db.Uuid
  completed_at  DateTime? @db.Timestamptz(6)
  created_at    DateTime @default(now()) @db.Timestamptz(6)

  @@index([from_user_id])
  @@index([to_user_id])
}

enum asset_type_enum {
  PASSWORD
  DOCUMENT
  HARDWARE
  LICENSE
  OTHER
}
```

`secret_cipher` and `secret_iv` exist because passwords must not be stored in
plaintext. This is the one place in Phase 2 where getting it wrong has
consequences outside the app. See
[R&D and company assets](p2_rnd_and_assets.md#company-assets).

### Dashboard social layer

```prisma
model polls {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  question      String   @db.VarChar(500)
  created_by_id String   @db.Uuid
  closes_at     DateTime @db.Timestamptz(6)
  is_closed     Boolean  @default(false)
  created_at    DateTime @default(now()) @db.Timestamptz(6)

  @@index([is_closed, closes_at])
}

model poll_options {
  id         String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  poll_id    String @db.Uuid
  label      String @db.VarChar(255)
  sort_order Int    @default(0)
}

model poll_votes {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  poll_id   String   @db.Uuid
  option_id String   @db.Uuid
  user_id   String   @db.Uuid
  voted_at  DateTime @default(now()) @db.Timestamptz(6)

  @@unique([poll_id, user_id])
  @@index([option_id])
}
```

The unique key on `(poll_id, user_id)` is what makes one vote per person a
database guarantee rather than an application check.

Details in [Home dashboard](p2_dashboard_social.md).

### Vendors {#vendors-1}

Vendor identity now lives in its own `vendors` table. A vendor *portal
login* is a `users` row with `role = VENDOR` and `vendor_id` set — optional,
not every vendor needs one.

```prisma
model vendors {
  id                  String            @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  vendor_code         String            @unique @db.VarChar(30)   // auto-generated
  name                String            @db.VarChar(255)
  vendor_type         String?           @db.VarChar(100)
  category_id         String?           @db.Uuid
  description         String?
  contact_person      String?           @db.VarChar(255)
  contact_email       String?           @db.VarChar(255)
  contact_phone       String?           @db.VarChar(30)
  alternate_contact   String?           @db.VarChar(255)
  company_address     String?
  website             String?           @db.VarChar(255)
  start_date          DateTime?         @db.Date   // relationship start, not a contract date
  status              vendor_status_enum @default(PROSPECT)
  owner_id            String            @db.Uuid   // internal RUCHI owner
  department_id       String?           @db.Uuid
  secondary_owner_id  String?           @db.Uuid
  notes               String?
  tags                String[]
  created_by_id       String            @db.Uuid
  created_at          DateTime          @default(now()) @db.Timestamptz(6)
  updated_at          DateTime          @default(now()) @db.Timestamptz(6)

  @@index([status, category_id])
  @@index([owner_id])
  @@index([department_id])
}

model vendor_categories {
  id         String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name       String  @unique @db.VarChar(100)
  is_active  Boolean @default(true)
}

model vendor_dashboard_access {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id      String   @unique @db.Uuid
  access_level String   @db.VarChar(20)   // VENDOR_ADMIN, VENDOR_MANAGER, VENDOR_VIEWER
  granted_by_id String  @db.Uuid
  granted_at   DateTime @default(now()) @db.Timestamptz(6)
}

model vendor_assignments {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  vendor_id      String   @db.Uuid
  entity_type    String   @db.VarChar(20)   // 'task', 'project', 'service', 'contract'
  entity_id      String?  @db.Uuid          // null for 'service', which has no row behind it
  assigned_by_id String   @db.Uuid
  start_date     DateTime? @db.Date
  deadline       DateTime? @db.Date
  status         String   @default("ACTIVE") @db.VarChar(20)
  description    String?
  priority       String?  @db.VarChar(20)
  created_at     DateTime @default(now()) @db.Timestamptz(6)

  @@unique([vendor_id, entity_type, entity_id])
  @@index([vendor_id, status])
  @@index([entity_type, entity_id])
}

model vendor_contracts {
  id             String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  vendor_id      String    @db.Uuid
  contract_number String   @db.VarChar(100)
  contract_type  String?   @db.VarChar(100)
  start_date     DateTime  @db.Date
  end_date       DateTime? @db.Date
  renewal_date   DateTime? @db.Date
  status         String    @default("ACTIVE") @db.VarChar(20)
  description    String?
  created_at     DateTime  @default(now()) @db.Timestamptz(6)

  @@unique([vendor_id, contract_number])
  @@index([vendor_id, status])
  @@index([end_date])
}

model vendor_documents {
  id            String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  vendor_id     String    @db.Uuid
  contract_id   String?   @db.Uuid
  category      String    @db.VarChar(20)   // LEGAL, OPERATIONAL
  document_type String    @db.VarChar(100)
  document_name String    @db.VarChar(255)
  issue_date    DateTime? @db.Date
  expiry_date   DateTime? @db.Date
  // no status column. ACTIVE / EXPIRING_SOON / EXPIRED is computed from
  // expiry_date at read time, see the note below
  file_url      String    @db.VarChar(500)
  storage_path  String    @db.VarChar(500)
  uploaded_by_id String   @db.Uuid
  created_at    DateTime  @default(now()) @db.Timestamptz(6)

  @@index([vendor_id, category])
  @@index([expiry_date])
}

model vendor_deliverables {
  id             String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  vendor_id      String    @db.Uuid
  name           String    @db.VarChar(255)
  description    String?
  project_id     String?   @db.Uuid
  owner_id       String    @db.Uuid
  due_date       DateTime? @db.Date
  submitted_date DateTime? @db.Date
  status         deliverable_status_enum @default(PENDING)
  attachments    String[]
  remarks        String?
  created_at     DateTime  @default(now()) @db.Timestamptz(6)

  @@index([vendor_id, status])
  @@index([due_date])
}

model vendor_notes {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  vendor_id   String   @db.Uuid
  author_id   String   @db.Uuid
  content     String
  is_internal Boolean  @default(true)   // false = shared vendor communication thread
  created_at  DateTime @default(now()) @db.Timestamptz(6)

  @@index([vendor_id, is_internal, created_at])
}

model vendor_reviews {
  id               String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  vendor_id        String   @db.Uuid
  reviewer_id      String   @db.Uuid
  review_date      DateTime @db.Date
  rating           Int      @db.SmallInt   // 1-5
  quality          Int?     @db.SmallInt
  timeliness       Int?     @db.SmallInt
  communication    Int?     @db.SmallInt
  reliability      Int?     @db.SmallInt
  remarks          String?
  action_required  String?
  created_at       DateTime @default(now()) @db.Timestamptz(6)

  @@index([vendor_id, review_date])
}

enum vendor_status_enum {
  PROSPECT
  ACTIVE
  ON_HOLD
  EXPIRED
  TERMINATED
}

enum deliverable_status_enum {
  PENDING
  IN_PROGRESS
  SUBMITTED
  UNDER_REVIEW
  ACCEPTED
  REJECTED
  OVERDUE
}
```

`vendor_assignments` keeps its role as the vendor allowlist. Nothing a
logged-in vendor requests is visible unless a row here says so, and it now also
carries the fields the module needs for internal tracking.

`entity_type` is the single type column. An earlier draft had both an
`assignment_type` and an `entity_type` with overlapping vocabularies, which
left no answer for what `entity_id` holds on a 'service' assignment that has no
row behind it. One column, and `entity_id` nullable for exactly that case.
Note that nullable `entity_id` hits the same Postgres NULL rule as the holidays
constraint above: `@@unique([vendor_id, entity_type, entity_id])` will not stop
two identical 'service' rows. That is tolerable here, since a duplicate service
assignment is visible in the UI and grants no access a single row would not,
but do not rely on the constraint to dedupe them.

`vendor_dashboard_access` is the separate, MD/EA-granted permission that
controls who inside RUCHI can open Vendor Management at all. It does not
touch what a vendor portal login can see. Never hard-delete `vendors`;
`status` carries the lifecycle.

**`vendor_documents` has no stored status.** `ACTIVE`, `EXPIRING_SOON` and
`EXPIRED` are a function of `expiry_date` and today's date, so storing them
means every row is wrong the morning after it is written unless a job keeps
them fresh. Compute at read time in the same helper the deadline view uses. If
a query ever needs to filter on it, filter on `expiry_date` ranges instead,
which is what the `@@index([expiry_date])` is for. Same rule applies to
`projects.health`, with the opposite answer, and the reason for the difference
is that health has no single column you can express it as. See
[Projects](p2_projects.md#project-health).

Details in [Vendor management](p2_vendors.md).

### Events, low priority

```prisma
model events {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name          String   @db.VarChar(255)
  event_date    DateTime @db.Timestamptz(6)
  venue         String?  @db.VarChar(255)
  budget_estimated Decimal? @db.Decimal(12, 2)
  status        String   @default("PLANNED") @db.VarChar(20)
  created_by_id String   @db.Uuid
  created_at    DateTime @default(now()) @db.Timestamptz(6)
}

model event_coordinators {
  id       String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  event_id String @db.Uuid
  user_id  String @db.Uuid

  @@unique([event_id, user_id])
}

model event_expenses {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  event_id    String   @db.Uuid
  item        String   @db.VarChar(255)
  amount      Decimal  @db.Decimal(12, 2)
  receipt_url String?  @db.VarChar(500)
  logged_by_id String  @db.Uuid
  created_at  DateTime @default(now()) @db.Timestamptz(6)

  @@index([event_id])
}
```

Event checklists reuse `project_checklist_items` with a nullable `event_id`, or
skip checklists entirely for events. Do not build a second checklist table.

## Table count

CSR is out. Projects and Vendors both grew substantially in this revision —
Projects from 6 tables to 10, Vendors from 1 table to 9. Roughly thirty new
tables in total if events are included, high-twenties if events are cut.
Every one of them adds a relation field to `users`, which already has forty.

That is a lot for one month against a schema with no tests. Batch the
migration by module and deploy each one with its feature rather than
shipping a single giant migration in Week 4. Vendors and Projects each
deserve their own migration, not a shared one, given how much each grew.

## Unifying comments

Phase 2 adds `project_messages`, which is a third message thread alongside
`task_comments` and `self_action_comments`. Consider replacing all three with:

```prisma
model comments {
  id                String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  entity_type       String   @db.VarChar(20)   // 'task', 'self_action', 'project'
  entity_id         String   @db.Uuid
  user_id           String   @db.Uuid
  parent_comment_id String?  @db.Uuid
  content           String
  is_tagged         Boolean  @default(false)
  created_at        DateTime @default(now()) @db.Timestamptz(6)
  updated_at        DateTime @default(now()) @db.Timestamptz(6)

  @@index([entity_type, entity_id, created_at])
  @@index([parent_comment_id])
}
```

The cost is a data migration and touching the task and self action comment code.
The benefit is that threading, tagging, attachments, and notifications get
implemented once instead of three times, and every module after this one gets
comments for free.

If the schedule cannot absorb the migration, build `project_messages` as its own
table and leave the unification for later. Do not build the third copy and also
promise the unification in the same month.
