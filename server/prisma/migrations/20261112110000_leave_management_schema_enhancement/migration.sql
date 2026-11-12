-- Migration: 20261112110000_leave_management_schema_enhancement
-- Safe, backward-compatible, non-destructive migration for Ruchi Foodline leave management

-- 1. Create leave adjustment type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leave_adjustment_type_enum') THEN
        CREATE TYPE "leave_adjustment_type_enum" AS ENUM (
            'OPENING_BALANCE',
            'ANNUAL_ALLOCATION',
            'MANUAL_CORRECTION',
            'ENCASHMENT',
            'LAPSE'
        );
    END IF;
END $$;

-- 2. Add personnel_number to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "personnel_number" VARCHAR(50);
CREATE UNIQUE INDEX IF NOT EXISTS "users_personnel_number_key" ON "users"("personnel_number");

-- 3. Enhance leave_types table
ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "leave_types" ALTER COLUMN "annual_entitlement" TYPE DECIMAL(5, 2) USING "annual_entitlement"::DECIMAL(5, 2);
ALTER TABLE "leave_types" ALTER COLUMN "max_carry_forward" TYPE DECIMAL(5, 2) USING "max_carry_forward"::DECIMAL(5, 2);

-- 4. Enhance leave_balances table (support fractional values up to 2 decimal places and client fields)
ALTER TABLE "leave_balances" ADD COLUMN IF NOT EXISTS "compensated_to_key_date" DECIMAL(6, 2) NOT NULL DEFAULT 0;
ALTER TABLE "leave_balances" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "leave_balances" ALTER COLUMN "entitled" TYPE DECIMAL(6, 2) USING "entitled"::DECIMAL(6, 2);
ALTER TABLE "leave_balances" ALTER COLUMN "used" TYPE DECIMAL(6, 2) USING "used"::DECIMAL(6, 2);
ALTER TABLE "leave_balances" ALTER COLUMN "carried_over" TYPE DECIMAL(6, 2) USING "carried_over"::DECIMAL(6, 2);

-- 5. Enhance leave_applications table
ALTER TABLE "leave_applications" ALTER COLUMN "days_count" TYPE DECIMAL(6, 2) USING "days_count"::DECIMAL(6, 2);

-- 6. Create leave_balance_adjustments table for opening balances, allocations, and manual audits
CREATE TABLE IF NOT EXISTS "leave_balance_adjustments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "adjustment_type" "leave_adjustment_type_enum" NOT NULL,
    "amount" DECIMAL(6, 2) NOT NULL,
    "effective_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "reference" VARCHAR(100),
    "remarks" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_balance_adjustments_pkey" PRIMARY KEY ("id")
);

-- Indexes for efficient lookup and audit trail
CREATE INDEX IF NOT EXISTS "leave_balance_adjustments_user_id_leave_type_id_year_idx" 
ON "leave_balance_adjustments"("user_id", "leave_type_id", "year");

CREATE INDEX IF NOT EXISTS "leave_balance_adjustments_created_by_id_idx" 
ON "leave_balance_adjustments"("created_by_id");

