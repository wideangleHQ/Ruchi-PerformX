-- Add sort_order column
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 999;

-- Safely rename existing 'Purchase Agro and Non Agro' to 'Purchase Agro'
-- We ignore conflicts just in case 'Purchase Agro' already exists from a previous migration.
-- If 'Purchase Agro' already exists, we leave the old one as is (Admin will need to resolve, but data isn't lost)
UPDATE "departments" 
SET "name" = 'Purchase Agro', "updated_at" = now() 
WHERE "name" = 'Purchase Agro and Non Agro'
AND NOT EXISTS (SELECT 1 FROM "departments" WHERE "name" = 'Purchase Agro');

-- Create 'Purchase Non Agro' if it does not exist
INSERT INTO "departments" ("name", "is_active", "sort_order") 
VALUES ('Purchase Non Agro', true, 13) 
ON CONFLICT ("name") DO NOTHING;

-- Enforce exact ordering
UPDATE "departments" SET "sort_order" = 1 WHERE "name" = 'IT';
UPDATE "departments" SET "sort_order" = 2 WHERE "name" = 'Admin/HR/Maintenance';
UPDATE "departments" SET "sort_order" = 3 WHERE "name" = 'Civil';
UPDATE "departments" SET "sort_order" = 4 WHERE "name" = 'Marketing/Digital Marketing';
UPDATE "departments" SET "sort_order" = 5 WHERE "name" = 'F&A/GST';
UPDATE "departments" SET "sort_order" = 6 WHERE "name" = 'Accounting';
UPDATE "departments" SET "sort_order" = 7 WHERE "name" = 'Legal';
UPDATE "departments" SET "sort_order" = 8 WHERE "name" = 'Logistics';
UPDATE "departments" SET "sort_order" = 9 WHERE "name" = 'Sales';
UPDATE "departments" SET "sort_order" = 10 WHERE "name" = 'Operation';
UPDATE "departments" SET "sort_order" = 11 WHERE "name" = 'Production';
UPDATE "departments" SET "sort_order" = 12 WHERE "name" = 'Purchase Agro';
UPDATE "departments" SET "sort_order" = 13 WHERE "name" = 'Purchase Non Agro';
UPDATE "departments" SET "sort_order" = 14 WHERE "name" = 'Quality';
UPDATE "departments" SET "sort_order" = 15 WHERE "name" = 'Packing Material/Security';
UPDATE "departments" SET "sort_order" = 16 WHERE "name" = 'Others';
