# Phase 2 schema changes

Every table Phase 2 needs, in one place, so the migration can be planned as a
whole rather than discovered module by module.

Read [Known gaps](p1_known_gaps.md#no-database-migrations) first. There is no
migration history in this repository. Establishing one is the prerequisite for
everything below.

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
vendor_company  String?    @db.VarChar(255)   // null for internal users
reporting_to_id String?    @db.Uuid     // leave approval routing
```

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

`notification_type_enum` gains roughly twenty values. Add them all in one
migration rather than one per module.

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
  id               String              @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id          String              @db.Uuid
  leave_type_id    String              @db.Uuid
  start_date       DateTime            @db.Date
  end_date         DateTime            @db.Date
  days_count       Decimal             @db.Decimal(5, 1)   // half days
  reason           String
  status           leave_status_enum   @default(PENDING_MANAGER)
  manager_id       String?             @db.Uuid
  manager_acted_at DateTime?           @db.Timestamptz(6)
  manager_remark   String?
  hr_id            String?             @db.Uuid
  hr_acted_at      DateTime?           @db.Timestamptz(6)
  hr_remark        String?
  cancelled_at     DateTime?           @db.Timestamptz(6)
  created_at       DateTime            @default(now()) @db.Timestamptz(6)
  updated_at       DateTime            @default(now()) @db.Timestamptz(6)

  @@index([user_id, status, created_at])
  @@index([manager_id, status])
  @@index([hr_id, status])
  @@index([start_date, end_date])
}

model holidays {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name        String   @db.VarChar(255)
  holiday_date DateTime @db.Date
  is_optional Boolean  @default(false)
  year        Int
  created_by_id String @db.Uuid
  created_at  DateTime @default(now()) @db.Timestamptz(6)

  @@unique([holiday_date, name])
  @@index([year])
}

enum leave_status_enum {
  PENDING_MANAGER
  PENDING_HR
  APPROVED
  REJECTED
  CANCELLED
}
```

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
  title         String              @db.VarChar(255)
  description   String
  status        project_status_enum @default(ACTIVE)
  lead_id       String              @db.Uuid
  created_by_id String              @db.Uuid
  deadline      DateTime?           @db.Timestamptz(6)
  closed_at     DateTime?           @db.Timestamptz(6)
  created_at    DateTime            @default(now()) @db.Timestamptz(6)
  updated_at    DateTime            @default(now()) @db.Timestamptz(6)
  deleted_at    DateTime?           @db.Timestamptz(6)

  @@index([status, deleted_at, created_at])
  @@index([lead_id, status])
  @@index([deadline])
}

model project_members {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  project_id String   @db.Uuid
  user_id    String   @db.Uuid
  role       String   @default("MEMBER") @db.VarChar(20)   // LEAD, MEMBER
  joined_at  DateTime @default(now()) @db.Timestamptz(6)

  @@unique([project_id, user_id])
  @@index([user_id])
}

model project_checklist_items {
  id             String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  project_id     String    @db.Uuid
  title          String    @db.VarChar(255)
  is_done        Boolean   @default(false)
  assigned_to_id String?   @db.Uuid
  due_date       DateTime? @db.Timestamptz(6)
  sort_order     Int       @default(0)
  completed_at   DateTime? @db.Timestamptz(6)
  created_at     DateTime  @default(now()) @db.Timestamptz(6)

  @@index([project_id, is_done])
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
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  project_id   String   @unique @db.Uuid
  summary      String
  outcome      String
  learnings    String?
  submitted_by_id String @db.Uuid
  submitted_at DateTime @default(now()) @db.Timestamptz(6)
  md_viewed_at DateTime? @db.Timestamptz(6)
}

enum project_status_enum {
  ACTIVE
  COMPLETED
  ARCHIVED
}

enum outcome_type_enum {
  TRY
  FAILURE
  OUTCOME
}
```

`project_closure_reports.project_id` is unique, which enforces one report per
project at the database level.

Details in [Projects](p2_projects.md).

### R&D

R&D reuses `projects` with a flag rather than duplicating the structure:

```prisma
// added to projects
is_rnd        Boolean @default(false)
rnd_category  String? @db.VarChar(100)
```

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

### Vendors

Vendors are users with `role = VENDOR`. What they need beyond that:

```prisma
model vendor_assignments {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  vendor_id   String   @db.Uuid
  entity_type String   @db.VarChar(20)   // 'task', 'project'
  entity_id   String   @db.Uuid
  assigned_by_id String @db.Uuid
  created_at  DateTime @default(now()) @db.Timestamptz(6)

  @@unique([vendor_id, entity_type, entity_id])
  @@index([vendor_id])
  @@index([entity_type, entity_id])
}
```

This is the vendor allowlist. Nothing a vendor requests is visible unless a row
here says so. Details in [Vendor management](p2_vendors.md).

### CSR

```prisma
model csr_initiatives {
  id            String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  title         String    @db.VarChar(255)
  description   String
  goal          String?
  beneficiaries String?
  outcome       String?
  start_date    DateTime? @db.Date
  end_date      DateTime? @db.Date
  amount_spent  Decimal?  @db.Decimal(12, 2)
  created_by_id String    @db.Uuid
  created_at    DateTime  @default(now()) @db.Timestamptz(6)
  deleted_at    DateTime? @db.Timestamptz(6)

  @@index([start_date])
}

model csr_media {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  initiative_id String  @db.Uuid
  file_url     String   @db.VarChar(500)
  storage_path String   @db.VarChar(500)
  caption      String?  @db.VarChar(255)
  uploaded_by_id String @db.Uuid
  created_at   DateTime @default(now()) @db.Timestamptz(6)

  @@index([initiative_id])
}
```

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

Twenty new tables and one reused with a flag, if events are included. Seventeen
if events are cut. Every one of them adds a relation field to `users`, which
already has forty.

That is a lot for one month against a schema with no tests. Batch the migration
by module and deploy each one with its feature rather than shipping a single
twenty-table migration in Week 4.

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
