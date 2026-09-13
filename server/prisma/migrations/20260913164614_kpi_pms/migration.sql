-- CreateEnum
CREATE TYPE "kpi_scope_enum" AS ENUM ('INDIVIDUAL', 'DEPARTMENT', 'PROJECT');

-- CreateEnum
CREATE TYPE "kpi_mode_enum" AS ENUM ('QUANTITATIVE', 'BINARY', 'MILESTONE', 'RATING');

-- CreateEnum
CREATE TYPE "kpi_direction_enum" AS ENUM ('HIGHER_IS_BETTER', 'LOWER_IS_BETTER', 'EXACT_TARGET');

-- CreateEnum
CREATE TYPE "kpi_scoring_method_enum" AS ENUM ('DIRECT', 'THRESHOLD', 'RATING', 'MILESTONE');

-- CreateEnum
CREATE TYPE "kpi_period_enum" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "kpi_status_enum" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'IN_PROGRESS', 'PENDING_REVIEW', 'EVALUATED', 'FINALIZED', 'LOCKED', 'CANCELLED');

-- CreateTable
CREATE TABLE "kpis" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "scope" "kpi_scope_enum" NOT NULL,
    "owner_user_id" UUID,
    "department_id" UUID,
    "project_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "mode" "kpi_mode_enum" NOT NULL,
    "unit_label" VARCHAR(60),
    "unit_symbol" VARCHAR(12),
    "target_value" DECIMAL(18,4),
    "baseline_value" DECIMAL(18,4),
    "direction" "kpi_direction_enum",
    "scoring_method" "kpi_scoring_method_enum" NOT NULL,
    "scoring_config" JSONB,
    "weight" DECIMAL(5,2) NOT NULL,
    "period" "kpi_period_enum" NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "evidence_required" BOOLEAN NOT NULL DEFAULT false,
    "review_required" BOOLEAN NOT NULL DEFAULT false,
    "status" "kpi_status_enum" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" UUID NOT NULL,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "cancel_reason" TEXT,
    "locked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_milestones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kpi_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "weight" DECIMAL(5,2) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "completed_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_contributions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kpi_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "share" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_updates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kpi_id" UUID NOT NULL,
    "actual_value" DECIMAL(18,4),
    "binary_done" BOOLEAN,
    "rating" SMALLINT,
    "remarks" TEXT,
    "evidence_url" VARCHAR(500),
    "entered_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_revisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kpi_id" UUID NOT NULL,
    "old_target" DECIMAL(18,4),
    "new_target" DECIMAL(18,4),
    "old_weight" DECIMAL(5,2),
    "new_weight" DECIMAL(5,2),
    "effective_from" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "changed_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kpis_owner_user_id_period_start_idx" ON "kpis"("owner_user_id", "period_start");

-- CreateIndex
CREATE INDEX "kpis_department_id_period_start_idx" ON "kpis"("department_id", "period_start");

-- CreateIndex
CREATE INDEX "kpis_project_id_idx" ON "kpis"("project_id");

-- CreateIndex
CREATE INDEX "kpis_status_idx" ON "kpis"("status");

-- CreateIndex
CREATE INDEX "kpi_milestones_kpi_id_sequence_idx" ON "kpi_milestones"("kpi_id", "sequence");

-- CreateIndex
CREATE INDEX "kpi_contributions_kpi_id_idx" ON "kpi_contributions"("kpi_id");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_contributions_kpi_id_user_id_key" ON "kpi_contributions"("kpi_id", "user_id");

-- CreateIndex
CREATE INDEX "kpi_updates_kpi_id_created_at_idx" ON "kpi_updates"("kpi_id", "created_at");

-- CreateIndex
CREATE INDEX "kpi_revisions_kpi_id_created_at_idx" ON "kpi_revisions"("kpi_id", "created_at");
