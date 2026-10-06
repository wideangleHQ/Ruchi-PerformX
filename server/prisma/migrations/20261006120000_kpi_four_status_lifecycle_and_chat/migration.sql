-- The KPI lifecycle goes from ten statuses to the four the approved
-- specification names: DRAFT, PENDING_APPROVAL, PUBLISHED, DELETED.
--
-- Backfill plan, row for row, nothing deleted:
--   DRAFT, PENDING_APPROVAL                     unchanged
--   APPROVED, ACTIVE, IN_PROGRESS,
--   PENDING_REVIEW, EVALUATED, FINALIZED, LOCKED  -> PUBLISHED
--   CANCELLED                                     -> DELETED
-- Every row that moves keeps its old status in `legacy_status`, and
-- approved_at, cancelled_at, cancel_reason and locked_at are left as they are,
-- so the old position stays recoverable.

-- AlterTable
ALTER TABLE "kpis" ADD COLUMN "legacy_status" VARCHAR(20);

UPDATE "kpis"
SET "legacy_status" = "status"::text
WHERE "status"::text NOT IN ('DRAFT', 'PENDING_APPROVAL');

-- AlterEnum
ALTER TYPE "kpi_status_enum" RENAME TO "kpi_status_enum_old";
CREATE TYPE "kpi_status_enum" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'DELETED');
ALTER TABLE "kpis" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "kpis" ALTER COLUMN "status" TYPE "kpi_status_enum" USING (
  CASE "status"::text
    WHEN 'DRAFT' THEN 'DRAFT'
    WHEN 'PENDING_APPROVAL' THEN 'PENDING_APPROVAL'
    WHEN 'CANCELLED' THEN 'DELETED'
    ELSE 'PUBLISHED'
  END
)::"kpi_status_enum";
ALTER TABLE "kpis" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
DROP TYPE "kpi_status_enum_old";

-- AlterEnum
ALTER TYPE "notification_type_enum" ADD VALUE 'KPI_MESSAGE';

-- CreateTable
CREATE TABLE "kpi_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kpi_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kpi_messages_kpi_id_created_at_idx" ON "kpi_messages"("kpi_id", "created_at");
