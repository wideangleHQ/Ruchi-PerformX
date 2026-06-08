INSERT INTO "departments" ("name", "is_active")
VALUES
  ('Purchase Agro', true),
  ('Purchase Non Agro', true),
  ('Quality', true),
  ('Logistics', true),
  ('Legal', true)
ON CONFLICT ("name") DO UPDATE
SET "is_active" = true,
    "updated_at" = now();
