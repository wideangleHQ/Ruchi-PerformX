-- CreateEnum
CREATE TYPE "notification_channel_enum" AS ENUM ('IN_APP', 'EMAIL');

-- CreateEnum
CREATE TYPE "leave_status_enum" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "project_status_enum" AS ENUM ('DRAFT', 'PLANNED', 'ACTIVE', 'ON_HOLD', 'AT_RISK', 'COMPLETED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "project_health_enum" AS ENUM ('ON_TRACK', 'AT_RISK', 'DELAYED');

-- CreateEnum
CREATE TYPE "outcome_type_enum" AS ENUM ('TRY', 'FAILURE', 'OUTCOME');

-- CreateEnum
CREATE TYPE "asset_type_enum" AS ENUM ('PASSWORD', 'DOCUMENT', 'HARDWARE', 'LICENSE', 'OTHER');

-- CreateEnum
CREATE TYPE "vendor_status_enum" AS ENUM ('PROSPECT', 'ACTIVE', 'ON_HOLD', 'EXPIRED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "deliverable_status_enum" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'OVERDUE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "notification_type_enum" ADD VALUE 'LEAVE_SUBMITTED';
ALTER TYPE "notification_type_enum" ADD VALUE 'LEAVE_APPROVED';
ALTER TYPE "notification_type_enum" ADD VALUE 'LEAVE_REJECTED';
ALTER TYPE "notification_type_enum" ADD VALUE 'LEAVE_CANCELLED';
ALTER TYPE "notification_type_enum" ADD VALUE 'LEAVE_HR_CANCELLED';
ALTER TYPE "notification_type_enum" ADD VALUE 'PROJECT_INVITED';
ALTER TYPE "notification_type_enum" ADD VALUE 'PROJECT_CHECKLIST_UPDATED';
ALTER TYPE "notification_type_enum" ADD VALUE 'PROJECT_MESSAGE';
ALTER TYPE "notification_type_enum" ADD VALUE 'PROJECT_DEADLINE_NEAR';
ALTER TYPE "notification_type_enum" ADD VALUE 'PROJECT_OVERDUE_NO_CLOSURE';
ALTER TYPE "notification_type_enum" ADD VALUE 'PROJECT_CLOSED';
ALTER TYPE "notification_type_enum" ADD VALUE 'PROJECT_CLOSURE_SUBMITTED';
ALTER TYPE "notification_type_enum" ADD VALUE 'POLL_CREATED';
ALTER TYPE "notification_type_enum" ADD VALUE 'RND_REPORT_SUBMITTED';
ALTER TYPE "notification_type_enum" ADD VALUE 'RND_TEAM_ADDED';
ALTER TYPE "notification_type_enum" ADD VALUE 'ASSET_HANDOVER_INITIATED';
ALTER TYPE "notification_type_enum" ADD VALUE 'ASSET_HANDOVER_CONFIRMED';
ALTER TYPE "notification_type_enum" ADD VALUE 'VENDOR_TASK_ASSIGNED';
ALTER TYPE "notification_type_enum" ADD VALUE 'VENDOR_TASK_UPDATED';
ALTER TYPE "notification_type_enum" ADD VALUE 'VENDOR_MESSAGE';
ALTER TYPE "notification_type_enum" ADD VALUE 'VENDOR_CONTRACT_EXPIRING';
ALTER TYPE "notification_type_enum" ADD VALUE 'VENDOR_DOCUMENT_EXPIRING';
ALTER TYPE "notification_type_enum" ADD VALUE 'VENDOR_DELIVERABLE_DUE';
ALTER TYPE "notification_type_enum" ADD VALUE 'VISITOR_ARRIVED';
ALTER TYPE "notification_type_enum" ADD VALUE 'VISITOR_REQUEST_APPROVED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "role_enum" ADD VALUE 'HR';
ALTER TYPE "role_enum" ADD VALUE 'VENDOR';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "channel" "notification_channel_enum" NOT NULL DEFAULT 'IN_APP',
ADD COLUMN     "delivered_at" TIMESTAMPTZ(6),
ADD COLUMN     "entity_id" UUID,
ADD COLUMN     "entity_type" VARCHAR(50);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "date_of_birth" DATE,
ADD COLUMN     "joined_on" DATE,
ADD COLUMN     "reporting_to_id" UUID,
ADD COLUMN     "vendor_id" UUID;

-- CreateTable
CREATE TABLE "leave_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(50) NOT NULL,
    "annual_entitlement" INTEGER NOT NULL DEFAULT 0,
    "is_paid" BOOLEAN NOT NULL DEFAULT true,
    "carry_forward" BOOLEAN NOT NULL DEFAULT false,
    "max_carry_forward" INTEGER NOT NULL DEFAULT 0,
    "requires_proof" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "entitled" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "used" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "carried_over" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_applications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "days_count" DECIMAL(5,1) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "leave_status_enum" NOT NULL DEFAULT 'PENDING',
    "manager_id" UUID,
    "approved_by_id" UUID,
    "approved_by_role" VARCHAR(10),
    "approved_at" TIMESTAMPTZ(6),
    "approval_remark" TEXT,
    "cancelled_by_id" UUID,
    "cancelled_at" TIMESTAMPTZ(6),
    "cancellation_reason" TEXT,
    "attachment_url" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "holiday_date" DATE NOT NULL,
    "is_optional" BOOLEAN NOT NULL DEFAULT false,
    "department_id" UUID,
    "year" INTEGER NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_code" VARCHAR(30) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "project_type" VARCHAR(100),
    "category" VARCHAR(100),
    "priority" VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    "objective" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tags" TEXT[],
    "status" "project_status_enum" NOT NULL DEFAULT 'DRAFT',
    "health" "project_health_enum" NOT NULL DEFAULT 'ON_TRACK',
    "lead_id" UUID NOT NULL,
    "co_lead_id" UUID,
    "created_by_id" UUID NOT NULL,
    "department_id" UUID,
    "start_date" DATE,
    "deadline" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "is_rnd" BOOLEAN NOT NULL DEFAULT false,
    "rnd_category" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_checklist_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID,
    "event_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "priority" VARCHAR(20),
    "is_done" BOOLEAN NOT NULL DEFAULT false,
    "assigned_to_id" UUID,
    "due_date" TIMESTAMPTZ(6),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_milestones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "owner_id" UUID,
    "start_date" DATE,
    "due_date" DATE,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PLANNED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_success_criteria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "criterion" TEXT NOT NULL,
    "is_met" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_success_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_kpis" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "metric" VARCHAR(255) NOT NULL,
    "target" VARCHAR(100),
    "actual" VARCHAR(100),
    "status" VARCHAR(20),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_kpis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_activity_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action_type" VARCHAR(30) NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_outcomes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "entry_type" "outcome_type_enum" NOT NULL,
    "content" TEXT NOT NULL,
    "logged_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_closure_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "executive_summary" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "final_outcome" TEXT NOT NULL,
    "achievements" TEXT,
    "failures" TEXT,
    "learnings" TEXT,
    "kpi_results" TEXT,
    "recommendations" TEXT,
    "attachments" TEXT[],
    "submitted_by_id" UUID NOT NULL,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_closure_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rnd_team_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "added_by_id" UUID NOT NULL,
    "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rnd_team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rnd_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID,
    "category" VARCHAR(100) NOT NULL,
    "product_area" VARCHAR(255) NOT NULL,
    "findings" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "supporting_data" TEXT,
    "submitted_by_id" UUID NOT NULL,
    "md_viewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rnd_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID NOT NULL,
    "asset_type" "asset_type_enum" NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "username" VARCHAR(255),
    "secret_cipher" TEXT,
    "secret_iv" VARCHAR(64),
    "url" VARCHAR(500),
    "file_url" VARCHAR(500),
    "storage_path" VARCHAR(500),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "company_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_handovers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "asset_id" UUID NOT NULL,
    "from_user_id" UUID NOT NULL,
    "to_user_id" UUID NOT NULL,
    "initiated_by_id" UUID NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_handovers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "polls" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "question" VARCHAR(500) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "closes_at" TIMESTAMPTZ(6) NOT NULL,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "polls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_options" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "poll_id" UUID NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "poll_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_votes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "poll_id" UUID NOT NULL,
    "option_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "voted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vendor_code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "vendor_type" VARCHAR(100),
    "category_id" UUID,
    "description" TEXT,
    "contact_person" VARCHAR(255),
    "contact_email" VARCHAR(255),
    "contact_phone" VARCHAR(30),
    "alternate_contact" VARCHAR(255),
    "company_address" TEXT,
    "website" VARCHAR(255),
    "start_date" DATE,
    "status" "vendor_status_enum" NOT NULL DEFAULT 'PROSPECT',
    "owner_id" UUID NOT NULL,
    "department_id" UUID,
    "secondary_owner_id" UUID,
    "notes" TEXT,
    "tags" TEXT[],
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "vendor_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_dashboard_access" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "access_level" VARCHAR(20) NOT NULL,
    "granted_by_id" UUID NOT NULL,
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_dashboard_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vendor_id" UUID NOT NULL,
    "entity_type" VARCHAR(20) NOT NULL,
    "entity_id" UUID,
    "assigned_by_id" UUID NOT NULL,
    "start_date" DATE,
    "deadline" DATE,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "priority" VARCHAR(20),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_contracts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vendor_id" UUID NOT NULL,
    "contract_number" VARCHAR(100) NOT NULL,
    "contract_type" VARCHAR(100),
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "renewal_date" DATE,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vendor_id" UUID NOT NULL,
    "contract_id" UUID,
    "category" VARCHAR(20) NOT NULL,
    "document_type" VARCHAR(100) NOT NULL,
    "document_name" VARCHAR(255) NOT NULL,
    "issue_date" DATE,
    "expiry_date" DATE,
    "file_url" VARCHAR(500) NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_deliverables" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vendor_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "project_id" UUID,
    "owner_id" UUID NOT NULL,
    "due_date" DATE,
    "submitted_date" DATE,
    "status" "deliverable_status_enum" NOT NULL DEFAULT 'PENDING',
    "attachments" TEXT[],
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_deliverables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vendor_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vendor_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "review_date" DATE NOT NULL,
    "rating" SMALLINT NOT NULL,
    "quality" SMALLINT,
    "timeliness" SMALLINT,
    "communication" SMALLINT,
    "reliability" SMALLINT,
    "remarks" TEXT,
    "action_required" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "event_date" TIMESTAMPTZ(6) NOT NULL,
    "venue" VARCHAR(255),
    "budget_estimated" DECIMAL(12,2),
    "status" VARCHAR(20) NOT NULL DEFAULT 'PLANNED',
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_coordinators" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "event_coordinators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_expenses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id" UUID NOT NULL,
    "item" VARCHAR(255) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "receipt_url" VARCHAR(500),
    "logged_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leave_types_name_key" ON "leave_types"("name");

-- CreateIndex
CREATE INDEX "leave_balances_user_id_year_idx" ON "leave_balances"("user_id", "year");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balances_user_id_leave_type_id_year_key" ON "leave_balances"("user_id", "leave_type_id", "year");

-- CreateIndex
CREATE INDEX "leave_applications_user_id_status_created_at_idx" ON "leave_applications"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "leave_applications_manager_id_status_idx" ON "leave_applications"("manager_id", "status");

-- CreateIndex
CREATE INDEX "leave_applications_approved_by_id_status_idx" ON "leave_applications"("approved_by_id", "status");

-- CreateIndex
CREATE INDEX "leave_applications_start_date_end_date_idx" ON "leave_applications"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "holidays_year_department_id_idx" ON "holidays"("year", "department_id");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_holiday_date_name_department_id_key" ON "holidays"("holiday_date", "name", "department_id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_project_code_key" ON "projects"("project_code");

-- CreateIndex
CREATE INDEX "projects_status_deleted_at_created_at_idx" ON "projects"("status", "deleted_at", "created_at");

-- CreateIndex
CREATE INDEX "projects_lead_id_status_idx" ON "projects"("lead_id", "status");

-- CreateIndex
CREATE INDEX "projects_health_idx" ON "projects"("health");

-- CreateIndex
CREATE INDEX "projects_deadline_idx" ON "projects"("deadline");

-- CreateIndex
CREATE INDEX "projects_is_rnd_deleted_at_idx" ON "projects"("is_rnd", "deleted_at");

-- CreateIndex
CREATE INDEX "project_members_user_id_idx" ON "project_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_project_id_user_id_key" ON "project_members"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "project_checklist_items_project_id_is_done_idx" ON "project_checklist_items"("project_id", "is_done");

-- CreateIndex
CREATE INDEX "project_checklist_items_event_id_idx" ON "project_checklist_items"("event_id");

-- CreateIndex
CREATE INDEX "project_milestones_project_id_due_date_idx" ON "project_milestones"("project_id", "due_date");

-- CreateIndex
CREATE INDEX "project_success_criteria_project_id_idx" ON "project_success_criteria"("project_id");

-- CreateIndex
CREATE INDEX "project_kpis_project_id_idx" ON "project_kpis"("project_id");

-- CreateIndex
CREATE INDEX "project_activity_logs_project_id_created_at_idx" ON "project_activity_logs"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "project_messages_project_id_created_at_idx" ON "project_messages"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "project_outcomes_project_id_entry_type_idx" ON "project_outcomes"("project_id", "entry_type");

-- CreateIndex
CREATE UNIQUE INDEX "project_closure_reports_project_id_key" ON "project_closure_reports"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "rnd_team_members_user_id_key" ON "rnd_team_members"("user_id");

-- CreateIndex
CREATE INDEX "rnd_reports_category_created_at_idx" ON "rnd_reports"("category", "created_at");

-- CreateIndex
CREATE INDEX "rnd_reports_submitted_by_id_idx" ON "rnd_reports"("submitted_by_id");

-- CreateIndex
CREATE INDEX "company_assets_owner_id_deleted_at_idx" ON "company_assets"("owner_id", "deleted_at");

-- CreateIndex
CREATE INDEX "company_assets_asset_type_idx" ON "company_assets"("asset_type");

-- CreateIndex
CREATE INDEX "asset_handovers_from_user_id_idx" ON "asset_handovers"("from_user_id");

-- CreateIndex
CREATE INDEX "asset_handovers_to_user_id_idx" ON "asset_handovers"("to_user_id");

-- CreateIndex
CREATE INDEX "polls_is_closed_closes_at_idx" ON "polls"("is_closed", "closes_at");

-- CreateIndex
CREATE INDEX "poll_options_poll_id_idx" ON "poll_options"("poll_id");

-- CreateIndex
CREATE INDEX "poll_votes_option_id_idx" ON "poll_votes"("option_id");

-- CreateIndex
CREATE UNIQUE INDEX "poll_votes_poll_id_user_id_key" ON "poll_votes"("poll_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_vendor_code_key" ON "vendors"("vendor_code");

-- CreateIndex
CREATE INDEX "vendors_status_category_id_idx" ON "vendors"("status", "category_id");

-- CreateIndex
CREATE INDEX "vendors_owner_id_idx" ON "vendors"("owner_id");

-- CreateIndex
CREATE INDEX "vendors_department_id_idx" ON "vendors"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_categories_name_key" ON "vendor_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_dashboard_access_user_id_key" ON "vendor_dashboard_access"("user_id");

-- CreateIndex
CREATE INDEX "vendor_assignments_vendor_id_status_idx" ON "vendor_assignments"("vendor_id", "status");

-- CreateIndex
CREATE INDEX "vendor_assignments_entity_type_entity_id_idx" ON "vendor_assignments"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_assignments_vendor_id_entity_type_entity_id_key" ON "vendor_assignments"("vendor_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "vendor_contracts_vendor_id_status_idx" ON "vendor_contracts"("vendor_id", "status");

-- CreateIndex
CREATE INDEX "vendor_contracts_end_date_idx" ON "vendor_contracts"("end_date");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_contracts_vendor_id_contract_number_key" ON "vendor_contracts"("vendor_id", "contract_number");

-- CreateIndex
CREATE INDEX "vendor_documents_vendor_id_category_idx" ON "vendor_documents"("vendor_id", "category");

-- CreateIndex
CREATE INDEX "vendor_documents_expiry_date_idx" ON "vendor_documents"("expiry_date");

-- CreateIndex
CREATE INDEX "vendor_deliverables_vendor_id_status_idx" ON "vendor_deliverables"("vendor_id", "status");

-- CreateIndex
CREATE INDEX "vendor_deliverables_due_date_idx" ON "vendor_deliverables"("due_date");

-- CreateIndex
CREATE INDEX "vendor_notes_vendor_id_is_internal_created_at_idx" ON "vendor_notes"("vendor_id", "is_internal", "created_at");

-- CreateIndex
CREATE INDEX "vendor_reviews_vendor_id_review_date_idx" ON "vendor_reviews"("vendor_id", "review_date");

-- CreateIndex
CREATE INDEX "events_event_date_idx" ON "events"("event_date");

-- CreateIndex
CREATE UNIQUE INDEX "event_coordinators_event_id_user_id_key" ON "event_coordinators"("event_id", "user_id");

-- CreateIndex
CREATE INDEX "event_expenses_event_id_idx" ON "event_expenses"("event_id");

-- CreateIndex
CREATE INDEX "idx_notifications_user_read_created" ON "notifications"("user_id", "is_read", "created_at");

-- CreateIndex
CREATE INDEX "idx_notifications_entity" ON "notifications"("entity_type", "entity_id");

-- Prisma cannot express this, so it is written by hand and re-added after any
-- regeneration of this file.
--
-- @@unique([holiday_date, name, department_id]) does not stop two identical
-- common holidays. department_id is NULL for the company-wide tier and
-- Postgres treats NULLs as distinct in a unique index, so both rows insert
-- cleanly. Common is the tier HR maintains by hand for the whole company, so
-- it is the one most likely to get double-entered, and a duplicate there
-- silently double-excludes a day from every leave day count.
--
-- Production is Postgres 17.6, so UNIQUE NULLS NOT DISTINCT is available, but
-- replacing Prisma's index with it reads as permanent drift on every migrate
-- diff. A partial unique index sits alongside instead and closes the same gap.
CREATE UNIQUE INDEX "holidays_common_uniq"
  ON "holidays" ("holiday_date", "name")
  WHERE "department_id" IS NULL;
