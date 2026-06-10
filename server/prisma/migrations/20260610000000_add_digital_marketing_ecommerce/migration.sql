INSERT INTO "departments" ("name", "is_active", "sort_order")
VALUES ('Digital Marketing', true, 5)
ON CONFLICT ("name") DO UPDATE
SET "is_active" = true, "sort_order" = 5, "updated_at" = now();

INSERT INTO "departments" ("name", "is_active", "sort_order")
VALUES ('E-Commerce', true, 6)
ON CONFLICT ("name") DO UPDATE
SET "is_active" = true, "sort_order" = 6, "updated_at" = now();

UPDATE "departments" SET "name" = 'Marketing', "updated_at" = now()
WHERE "name" = 'Marketing/Digital Marketing'
AND NOT EXISTS (SELECT 1 FROM "departments" WHERE "name" = 'Marketing');

UPDATE "departments" SET "sort_order" = 1 WHERE "name" = 'IT';
UPDATE "departments" SET "sort_order" = 2 WHERE "name" = 'Admin/HR/Maintenance';
UPDATE "departments" SET "sort_order" = 3 WHERE "name" = 'Civil';
UPDATE "departments" SET "sort_order" = 4 WHERE "name" = 'Marketing';
UPDATE "departments" SET "sort_order" = 5 WHERE "name" = 'Digital Marketing';
UPDATE "departments" SET "sort_order" = 6 WHERE "name" = 'E-Commerce';
UPDATE "departments" SET "sort_order" = 7 WHERE "name" = 'F&A/GST';
UPDATE "departments" SET "sort_order" = 8 WHERE "name" = 'Accounting';
UPDATE "departments" SET "sort_order" = 9 WHERE "name" = 'Legal';
UPDATE "departments" SET "sort_order" = 10 WHERE "name" = 'Logistics';
UPDATE "departments" SET "sort_order" = 11 WHERE "name" = 'Sales';
UPDATE "departments" SET "sort_order" = 12 WHERE "name" = 'Operation';
UPDATE "departments" SET "sort_order" = 13 WHERE "name" = 'Production';
UPDATE "departments" SET "sort_order" = 14 WHERE "name" = 'Purchase Agro';
UPDATE "departments" SET "sort_order" = 15 WHERE "name" = 'Purchase Non Agro';
UPDATE "departments" SET "sort_order" = 16 WHERE "name" = 'Quality';
UPDATE "departments" SET "sort_order" = 17 WHERE "name" = 'Packing Material/Security';
UPDATE "departments" SET "sort_order" = 18 WHERE "name" = 'Others';
