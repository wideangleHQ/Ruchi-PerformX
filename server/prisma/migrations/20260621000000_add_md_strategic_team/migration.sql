INSERT INTO "departments" ("name", "is_active", "sort_order")
VALUES ('MD''s Strategic Team', true, 19)
ON CONFLICT ("name") DO UPDATE
SET "is_active" = true,
    "sort_order" = 19,
    "updated_at" = now();
