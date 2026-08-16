-- Two dead columns and the constraint names that drifted from Prisma's.
--
-- self_actions.department_id was superseded by self_action_departments.
-- All 288 non-null values are already present in the join table, and no
-- self_action lacks a join row. Verified before writing this.
--
-- visitors.company_name is a leftover of the camelCase rename. The live
-- column is visitors."companyName"; every row of company_name still holds
-- the 'Unknown Company' default.

-- DropForeignKey
ALTER TABLE "self_actions" DROP CONSTRAINT "fk_self_action_dept";

-- DropIndex
DROP INDEX "idx_self_actions_dept";

-- DropIndex
DROP INDEX "idx_visitors_company_name";

-- AlterTable
ALTER TABLE "self_actions" DROP COLUMN "department_id";

-- AlterTable
ALTER TABLE "visitors" DROP COLUMN "company_name";

-- RenameForeignKey
ALTER TABLE "self_action_departments" RENAME CONSTRAINT "fk_self_action_departments_department" TO "self_action_departments_department_id_fkey";

-- RenameForeignKey
ALTER TABLE "self_action_departments" RENAME CONSTRAINT "fk_self_action_departments_self_action" TO "self_action_departments_self_action_id_fkey";

-- RenameIndex
ALTER INDEX "idx_self_action_departments_department" RENAME TO "self_action_departments_department_id_idx";

-- RenameIndex
ALTER INDEX "idx_self_action_departments_self_action" RENAME TO "self_action_departments_self_action_id_idx";

-- RenameIndex
ALTER INDEX "uq_self_action_department" RENAME TO "self_action_departments_self_action_id_department_id_key";

