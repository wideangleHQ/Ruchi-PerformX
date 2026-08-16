-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."OtpType" AS ENUM ('REGISTRATION', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "public"."UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "public"."VisitStatus" AS ENUM ('SCHEDULED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."VisitorImageSource" AS ENUM ('UPLOADED', 'CAMERA', 'SCANNED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "public"."VisitorImageType" AS ENUM ('PROFILE', 'FACE_REFERENCE', 'AADHAAR_FRONT', 'AADHAAR_BACK', 'VISIT_CAPTURE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."VisitorStatus" AS ENUM ('ACTIVE', 'BLACKLISTED', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."action_status_enum" AS ENUM ('COMPLETED', 'PENDING');

-- CreateEnum
CREATE TYPE "public"."escalation_level_enum" AS ENUM ('EMPLOYEE_REMINDER', 'HOD_ALERT', 'MD_ALERT');

-- CreateEnum
CREATE TYPE "public"."incentive_type_enum" AS ENUM ('MONETARY', 'EMPLOYEE_OF_MONTH', 'GIFT', 'APPRECIATION_BADGE', 'PROMOTION_FLAG', 'CONSISTENCY_AWARD', 'DEPARTMENT_RANKING');

-- CreateEnum
CREATE TYPE "public"."notification_type_enum" AS ENUM ('TASK_ASSIGNED', 'TASK_ACCEPTED', 'TASK_REJECTED', 'TASK_COMPLETED', 'TASK_PENDING', 'TASK_OVERDUE', 'ESCALATION_HOD', 'ESCALATION_MD', 'REQUEST_ACCEPTED', 'REQUEST_REJECTED', 'REMARKS_ADDED', 'TASK_TAGGED', 'INCENTIVE_APPROVED', 'TRANSFER_REQUESTED', 'TRANSFER_ACCEPTED', 'TRANSFER_REJECTED', 'REVIEW_REQUESTED', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "public"."otp_purpose_enum" AS ENUM ('SIGNUP', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "public"."registration_status_enum" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."request_status_enum" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."request_type_enum" AS ENUM ('BUDGET_APPROVAL', 'TRANSPORT_SUPPORT', 'CROSS_DEPT_ASSISTANCE', 'RESOURCE_REQUEST', 'OTHER', 'TASK_REASSIGNMENT');

-- CreateEnum
CREATE TYPE "public"."role_enum" AS ENUM ('MD', 'HOD', 'EMPLOYEE', 'ADMIN', 'EA', 'PA', 'PURCHASE_HEAD', 'DEPARTMENT_CONTROLLER');

-- CreateEnum
CREATE TYPE "public"."score_status_enum" AS ENUM ('NEUTRAL', 'CALCULATED');

-- CreateEnum
CREATE TYPE "public"."self_action_priority_enum" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "public"."self_action_status_enum" AS ENUM ('OPEN', 'ONGOING', 'COMPLETED', 'ABORTED');

-- CreateEnum
CREATE TYPE "public"."task_category_enum" AS ENUM ('OPERATIONAL', 'SALES', 'MARKETING', 'PRODUCTION', 'HR', 'FINANCE', 'OTHER', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "public"."task_priority_enum" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "public"."task_status_enum" AS ENUM ('CREATED', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'PENDING', 'REVIEWED', 'CLOSED', 'HOD_VERIFIED_PENDING', 'HOD_VERIFIED');

-- CreateEnum
CREATE TYPE "public"."task_type_enum" AS ENUM ('OFFICIAL', 'EMPLOYEE_SHARED');

-- CreateEnum
CREATE TYPE "public"."transfer_status_enum" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "public"."assistant_departments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assistant_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "action" VARCHAR(255) NOT NULL,
    "entity" VARCHAR(100) NOT NULL,
    "entity_id" UUID NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "ip_address" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."departments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sort_order" INTEGER NOT NULL DEFAULT 999,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."hod_departments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hod_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hod_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."incentives" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "approved_by_id" UUID,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "type" "public"."incentive_type_enum" NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(12,2),
    "is_approved" BOOLEAN DEFAULT false,
    "approved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incentives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "task_id" UUID,
    "type" "public"."notification_type_enum" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN DEFAULT false,
    "metadata" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."otp_verifications" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "type" "public"."OtpType" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."password_reset_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "temp_password" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "password_reset_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."performance_scores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "self_productivity_score" DECIMAL(5,2) DEFAULT 0,
    "assigned_task_score" DECIMAL(5,2) DEFAULT 0,
    "final_score" DECIMAL(5,2) DEFAULT 0,
    "assigned_score_status" "public"."score_status_enum" DEFAULT 'NEUTRAL',
    "self_actions_completed" INTEGER DEFAULT 0,
    "self_actions_total" INTEGER DEFAULT 0,
    "consistency_days" INTEGER DEFAULT 0,
    "total_working_days" INTEGER DEFAULT 0,
    "self_pending_rate" DECIMAL(5,2) DEFAULT 0,
    "assigned_tasks_completed" INTEGER DEFAULT 0,
    "assigned_tasks_total" INTEGER DEFAULT 0,
    "overdue_tasks_count" INTEGER DEFAULT 0,
    "avg_completion_speed_score" DECIMAL(5,2) DEFAULT 0,
    "superior_remarks_score" DECIMAL(5,2) DEFAULT 0,
    "is_finalized" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."registration_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "full_name" VARCHAR(255) NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "department_id" UUID NOT NULL,
    "requested_role" "public"."role_enum" DEFAULT 'EMPLOYEE',
    "status" "public"."registration_status_enum" DEFAULT 'PENDING',
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."self_action_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "self_action_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "parent_comment_id" UUID,
    "content" TEXT NOT NULL,
    "is_tagged" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "self_action_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."self_action_departments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "self_action_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "self_action_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."self_action_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "self_action_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "self_action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."self_actions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(255) NOT NULL,
    "status" "public"."self_action_status_enum" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "priority" "public"."self_action_priority_enum" NOT NULL DEFAULT 'MEDIUM',
    "created_by_id" UUID NOT NULL,
    "department_id" UUID,
    "completed_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "self_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."task_attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_id" UUID,
    "comment_id" UUID,
    "self_action_id" UUID,
    "file_name" VARCHAR(255) NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_type" VARCHAR(100),
    "file_size_kb" INTEGER,
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storage_path" VARCHAR(500),
    "self_action_comment_id" UUID,
    "request_id" UUID,

    CONSTRAINT "task_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."task_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "is_tagged" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parent_comment_id" UUID,

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."task_departments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."task_escalations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_id" UUID NOT NULL,
    "escalation_level" "public"."escalation_level_enum" NOT NULL,
    "escalated_to_id" UUID NOT NULL,
    "is_resolved" BOOLEAN DEFAULT false,
    "resolved_at" TIMESTAMPTZ(6),
    "triggered_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."task_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "type" "public"."request_type_enum" NOT NULL,
    "status" "public"."request_status_enum" NOT NULL DEFAULT 'PENDING',
    "rejection_reason" TEXT,
    "requested_by_id" UUID NOT NULL,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "generated_task_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "task_id" UUID,
    "current_assignee_id" UUID,
    "requested_assignee_id" UUID,
    "task_title" VARCHAR(255),
    "task_description" TEXT,
    "request_reason" TEXT,
    "priority" "public"."task_priority_enum",
    "department_id" UUID,

    CONSTRAINT "task_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."task_status_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_id" UUID NOT NULL,
    "from_status" "public"."task_status_enum",
    "to_status" "public"."task_status_enum" NOT NULL,
    "changed_by_id" UUID NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."task_transfers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_id" UUID NOT NULL,
    "from_dept_id" UUID NOT NULL,
    "to_dept_id" UUID NOT NULL,
    "initiated_by_id" UUID NOT NULL,
    "received_by_id" UUID,
    "status" "public"."transfer_status_enum" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "public"."task_status_enum" DEFAULT 'CREATED',
    "priority" "public"."task_priority_enum" DEFAULT 'MEDIUM',
    "category" "public"."task_category_enum",
    "due_date" TIMESTAMPTZ(6) NOT NULL,
    "accepted_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "reviewed_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "assigned_to_id" UUID,
    "assigned_by_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "parent_task_id" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by_id" UUID,
    "delete_reason" TEXT,
    "task_type" "public"."task_type_enum" DEFAULT 'OFFICIAL',

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "role" "public"."role_enum" NOT NULL,
    "department_id" UUID,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "email_verified_at" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "must_change_password" BOOLEAN DEFAULT false,
    "is_email_verified" BOOLEAN DEFAULT false,
    "pending_approval" BOOLEAN DEFAULT false,
    "mobile_number" VARCHAR(20),
    "password_changed_at" TIMESTAMPTZ(6),
    "can_access_career_hr" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."visitor_images" (
    "id" UUID NOT NULL,
    "visitorId" UUID NOT NULL,
    "visitId" UUID,
    "imageType" "public"."VisitorImageType" NOT NULL DEFAULT 'PROFILE',
    "imageSource" "public"."VisitorImageSource" NOT NULL DEFAULT 'UPLOADED',
    "fileName" VARCHAR(255),
    "fileUrl" VARCHAR(500) NOT NULL,
    "storagePath" VARCHAR(500),
    "mimeType" VARCHAR(100),
    "fileSizeKb" INTEGER,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isFaceTemplate" BOOLEAN NOT NULL DEFAULT false,
    "faceEmbeddingVersion" VARCHAR(50),
    "faceMatchScore" DECIMAL(5,2),
    "createdById" UUID NOT NULL,
    "updatedById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "visitor_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."visitors" (
    "id" UUID NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100),
    "fullName" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "mobileNumber" VARCHAR(20),
    "status" "public"."VisitorStatus" NOT NULL DEFAULT 'ACTIVE',
    "blacklistReason" TEXT,
    "blacklistedAt" TIMESTAMPTZ(6),
    "faceRecognitionConsent" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdById" UUID NOT NULL,
    "updatedById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),
    "address" TEXT NOT NULL DEFAULT 'N/A',
    "companyName" VARCHAR(255) NOT NULL DEFAULT 'Unknown Company',
    "company_name" VARCHAR(255) NOT NULL DEFAULT 'Unknown Company',

    CONSTRAINT "visitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."visits" (
    "id" UUID NOT NULL,
    "visitorId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "hostEmployeeId" UUID NOT NULL,
    "status" "public"."VisitStatus" NOT NULL DEFAULT 'SCHEDULED',
    "visitCode" VARCHAR(50),
    "appointmentReference" VARCHAR(100),
    "purpose" VARCHAR(255) NOT NULL,
    "meetingDetails" TEXT,
    "scheduledAt" TIMESTAMPTZ(6),
    "checkInTime" TIMESTAMPTZ(6),
    "checkOutTime" TIMESTAMPTZ(6),
    "qrPassIssuedAt" TIMESTAMPTZ(6),
    "qrPassExpiresAt" TIMESTAMPTZ(6),
    "faceVerifiedAt" TIMESTAMPTZ(6),
    "faceMatchScore" DECIMAL(5,2),
    "aadhaarVerifiedAt" TIMESTAMPTZ(6),
    "createdById" UUID NOT NULL,
    "updatedById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),
    "peopleCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assistant_departments_assistant_id_department_id_key" ON "public"."assistant_departments"("assistant_id" ASC, "department_id" ASC);

-- CreateIndex
CREATE INDEX "assistant_departments_assistant_id_idx" ON "public"."assistant_departments"("assistant_id" ASC);

-- CreateIndex
CREATE INDEX "assistant_departments_department_id_idx" ON "public"."assistant_departments"("department_id" ASC);

-- CreateIndex
CREATE INDEX "idx_audit_entity" ON "public"."audit_logs"("entity" ASC, "entity_id" ASC);

-- CreateIndex
CREATE INDEX "idx_audit_user" ON "public"."audit_logs"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "public"."departments"("name" ASC);

-- CreateIndex
CREATE INDEX "hod_departments_department_id_idx" ON "public"."hod_departments"("department_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "hod_departments_hod_id_department_id_key" ON "public"."hod_departments"("hod_id" ASC, "department_id" ASC);

-- CreateIndex
CREATE INDEX "hod_departments_hod_id_idx" ON "public"."hod_departments"("hod_id" ASC);

-- CreateIndex
CREATE INDEX "idx_incentives_employee" ON "public"."incentives"("employee_id" ASC);

-- CreateIndex
CREATE INDEX "idx_incentives_period" ON "public"."incentives"("month" ASC, "year" ASC);

-- CreateIndex
CREATE INDEX "idx_notifications_read" ON "public"."notifications"("is_read" ASC);

-- CreateIndex
CREATE INDEX "idx_notifications_user" ON "public"."notifications"("user_id" ASC);

-- CreateIndex
CREATE INDEX "otp_verifications_email_idx" ON "public"."otp_verifications"("email" ASC);

-- CreateIndex
CREATE INDEX "otp_verifications_email_type_idx" ON "public"."otp_verifications"("email" ASC, "type" ASC);

-- CreateIndex
CREATE INDEX "otp_verifications_expiresAt_idx" ON "public"."otp_verifications"("expiresAt" ASC);

-- CreateIndex
CREATE INDEX "password_reset_requests_user_id_idx" ON "public"."password_reset_requests"("user_id" ASC);

-- CreateIndex
CREATE INDEX "idx_scores_period" ON "public"."performance_scores"("year" ASC, "month" ASC);

-- CreateIndex
CREATE INDEX "idx_scores_user" ON "public"."performance_scores"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_month_year" ON "public"."performance_scores"("user_id" ASC, "month" ASC, "year" ASC);

-- CreateIndex
CREATE INDEX "idx_self_action_comments_action" ON "public"."self_action_comments"("self_action_id" ASC);

-- CreateIndex
CREATE INDEX "idx_self_action_comments_parent" ON "public"."self_action_comments"("parent_comment_id" ASC);

-- CreateIndex
CREATE INDEX "idx_self_action_comments_user" ON "public"."self_action_comments"("user_id" ASC);

-- CreateIndex
CREATE INDEX "idx_self_action_departments_department" ON "public"."self_action_departments"("department_id" ASC);

-- CreateIndex
CREATE INDEX "idx_self_action_departments_self_action" ON "public"."self_action_departments"("self_action_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_self_action_department" ON "public"."self_action_departments"("self_action_id" ASC, "department_id" ASC);

-- CreateIndex
CREATE INDEX "idx_self_action_logs_action" ON "public"."self_action_logs"("self_action_id" ASC);

-- CreateIndex
CREATE INDEX "idx_self_action_logs_actor" ON "public"."self_action_logs"("actor_id" ASC);

-- CreateIndex
CREATE INDEX "idx_self_action_logs_event" ON "public"."self_action_logs"("event_type" ASC);

-- CreateIndex
CREATE INDEX "idx_self_actions_created" ON "public"."self_actions"("created_at" ASC);

-- CreateIndex
CREATE INDEX "idx_self_actions_creator" ON "public"."self_actions"("created_by_id" ASC);

-- CreateIndex
CREATE INDEX "idx_self_actions_deleted" ON "public"."self_actions"("deleted_at" ASC);

-- CreateIndex
CREATE INDEX "idx_self_actions_dept" ON "public"."self_actions"("department_id" ASC);

-- CreateIndex
CREATE INDEX "idx_self_actions_status" ON "public"."self_actions"("status" ASC);

-- CreateIndex
CREATE INDEX "idx_task_attachments_request" ON "public"."task_attachments"("request_id" ASC);

-- CreateIndex
CREATE INDEX "idx_task_comments_parent" ON "public"."task_comments"("parent_comment_id" ASC);

-- CreateIndex
CREATE INDEX "idx_task_comments_task" ON "public"."task_comments"("task_id" ASC);

-- CreateIndex
CREATE INDEX "idx_task_comments_user" ON "public"."task_comments"("user_id" ASC);

-- CreateIndex
CREATE INDEX "task_departments_department_id_idx" ON "public"."task_departments"("department_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "task_departments_task_id_department_id_key" ON "public"."task_departments"("task_id" ASC, "department_id" ASC);

-- CreateIndex
CREATE INDEX "task_departments_task_id_idx" ON "public"."task_departments"("task_id" ASC);

-- CreateIndex
CREATE INDEX "idx_task_escalations_resolved" ON "public"."task_escalations"("is_resolved" ASC);

-- CreateIndex
CREATE INDEX "idx_task_escalations_task" ON "public"."task_escalations"("task_id" ASC);

-- CreateIndex
CREATE INDEX "idx_task_requests_department" ON "public"."task_requests"("department_id" ASC);

-- CreateIndex
CREATE INDEX "idx_task_requests_status" ON "public"."task_requests"("status" ASC);

-- CreateIndex
CREATE INDEX "idx_task_requests_task" ON "public"."task_requests"("task_id" ASC);

-- CreateIndex
CREATE INDEX "idx_task_requests_user" ON "public"."task_requests"("requested_by_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "task_requests_generated_task_id_key" ON "public"."task_requests"("generated_task_id" ASC);

-- CreateIndex
CREATE INDEX "idx_task_status_logs_task" ON "public"."task_status_logs"("task_id" ASC);

-- CreateIndex
CREATE INDEX "idx_task_transfers_status" ON "public"."task_transfers"("status" ASC);

-- CreateIndex
CREATE INDEX "idx_task_transfers_task" ON "public"."task_transfers"("task_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username" ASC);

-- CreateIndex
CREATE INDEX "idx_visitor_images_deleted_at" ON "public"."visitor_images"("deletedAt" ASC);

-- CreateIndex
CREATE INDEX "idx_visitor_images_image_type" ON "public"."visitor_images"("imageType" ASC);

-- CreateIndex
CREATE INDEX "idx_visitor_images_visit_id" ON "public"."visitor_images"("visitId" ASC);

-- CreateIndex
CREATE INDEX "idx_visitor_images_visitor_id" ON "public"."visitor_images"("visitorId" ASC);

-- CreateIndex
CREATE INDEX "idx_visitors_company_name" ON "public"."visitors"("company_name" ASC);

-- CreateIndex
CREATE INDEX "idx_visitors_deleted_at" ON "public"."visitors"("deletedAt" ASC);

-- CreateIndex
CREATE INDEX "idx_visitors_email" ON "public"."visitors"("email" ASC);

-- CreateIndex
CREATE INDEX "idx_visitors_mobile_number" ON "public"."visitors"("mobileNumber" ASC);

-- CreateIndex
CREATE INDEX "idx_visitors_status" ON "public"."visitors"("status" ASC);

-- CreateIndex
CREATE INDEX "idx_visits_branch_id" ON "public"."visits"("branchId" ASC);

-- CreateIndex
CREATE INDEX "idx_visits_check_in_time" ON "public"."visits"("checkInTime" ASC);

-- CreateIndex
CREATE INDEX "idx_visits_deleted_at" ON "public"."visits"("deletedAt" ASC);

-- CreateIndex
CREATE INDEX "idx_visits_status" ON "public"."visits"("status" ASC);

-- CreateIndex
CREATE INDEX "idx_visits_visitor_id" ON "public"."visits"("visitorId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "visits_visitCode_key" ON "public"."visits"("visitCode" ASC);

-- AddForeignKey
ALTER TABLE "public"."assistant_departments" ADD CONSTRAINT "assistant_departments_assistant_id_fkey" FOREIGN KEY ("assistant_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."assistant_departments" ADD CONSTRAINT "assistant_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "fk_audit_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."hod_departments" ADD CONSTRAINT "hod_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."hod_departments" ADD CONSTRAINT "hod_departments_hod_id_fkey" FOREIGN KEY ("hod_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."incentives" ADD CONSTRAINT "fk_incentive_approver" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."incentives" ADD CONSTRAINT "fk_incentive_employee" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "fk_notification_task" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "fk_notification_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."password_reset_requests" ADD CONSTRAINT "password_reset_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."performance_scores" ADD CONSTRAINT "fk_score_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."registration_requests" ADD CONSTRAINT "fk_registration_department" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."registration_requests" ADD CONSTRAINT "fk_registration_reviewer" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."self_action_comments" ADD CONSTRAINT "fk_self_action_comment_action" FOREIGN KEY ("self_action_id") REFERENCES "public"."self_actions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."self_action_comments" ADD CONSTRAINT "fk_self_action_comment_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."self_action_comments" ADD CONSTRAINT "self_action_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."self_action_comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."self_action_departments" ADD CONSTRAINT "fk_self_action_departments_department" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."self_action_departments" ADD CONSTRAINT "fk_self_action_departments_self_action" FOREIGN KEY ("self_action_id") REFERENCES "public"."self_actions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."self_action_logs" ADD CONSTRAINT "fk_log_action" FOREIGN KEY ("self_action_id") REFERENCES "public"."self_actions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."self_action_logs" ADD CONSTRAINT "fk_log_actor" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."self_actions" ADD CONSTRAINT "fk_self_action_creator" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."self_actions" ADD CONSTRAINT "fk_self_action_dept" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."task_attachments" ADD CONSTRAINT "fk_attachment_comment" FOREIGN KEY ("comment_id") REFERENCES "public"."task_comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."task_attachments" ADD CONSTRAINT "fk_attachment_request" FOREIGN KEY ("request_id") REFERENCES "public"."task_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."task_attachments" ADD CONSTRAINT "fk_attachment_self_action" FOREIGN KEY ("self_action_id") REFERENCES "public"."self_actions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."task_attachments" ADD CONSTRAINT "fk_attachment_self_action_comment" FOREIGN KEY ("self_action_comment_id") REFERENCES "public"."self_action_comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."task_attachments" ADD CONSTRAINT "fk_attachment_task" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."task_attachments" ADD CONSTRAINT "fk_attachment_user" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."task_comments" ADD CONSTRAINT "fk_comment_task" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."task_comments" ADD CONSTRAINT "fk_comment_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."task_comments" ADD CONSTRAINT "task_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."task_comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."task_departments" ADD CONSTRAINT "task_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."task_departments" ADD CONSTRAINT "task_departments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."task_escalations" ADD CONSTRAINT "fk_escalation_task" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."task_escalations" ADD CONSTRAINT "fk_escalation_user" FOREIGN KEY ("escalated_to_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."task_requests" ADD CONSTRAINT "fk_generated_task" FOREIGN KEY ("generated_task_id") REFERENCES "public"."tasks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."task_requests" ADD CONSTRAINT "fk_request_department" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."task_requests" ADD CONSTRAINT "fk_request_reviewer" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."task_requests" ADD CONSTRAINT "fk_request_user" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."task_requests" ADD CONSTRAINT "task_requests_current_assignee_id_fkey" FOREIGN KEY ("current_assignee_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."task_requests" ADD CONSTRAINT "task_requests_requested_assignee_id_fkey" FOREIGN KEY ("requested_assignee_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."task_requests" ADD CONSTRAINT "task_requests_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."task_status_logs" ADD CONSTRAINT "fk_status_log_task" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."task_status_logs" ADD CONSTRAINT "fk_status_log_user" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."task_transfers" ADD CONSTRAINT "fk_transfer_from_dept" FOREIGN KEY ("from_dept_id") REFERENCES "public"."departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."task_transfers" ADD CONSTRAINT "fk_transfer_initiator" FOREIGN KEY ("initiated_by_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."task_transfers" ADD CONSTRAINT "fk_transfer_receiver" FOREIGN KEY ("received_by_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."task_transfers" ADD CONSTRAINT "fk_transfer_task" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."task_transfers" ADD CONSTRAINT "fk_transfer_to_dept" FOREIGN KEY ("to_dept_id") REFERENCES "public"."departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "public"."tasks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "fk_user_department" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."visitor_images" ADD CONSTRAINT "visitor_images_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."visitor_images" ADD CONSTRAINT "visitor_images_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."visitor_images" ADD CONSTRAINT "visitor_images_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "public"."visits"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."visitor_images" ADD CONSTRAINT "visitor_images_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "public"."visitors"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."visitors" ADD CONSTRAINT "visitors_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."visitors" ADD CONSTRAINT "visitors_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."visits" ADD CONSTRAINT "visits_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."visits" ADD CONSTRAINT "visits_hostEmployeeId_fkey" FOREIGN KEY ("hostEmployeeId") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."visits" ADD CONSTRAINT "visits_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."visits" ADD CONSTRAINT "visits_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "public"."visitors"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

