CREATE TABLE IF NOT EXISTS "task_departments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "task_id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "task_departments_task_id_department_id_key" UNIQUE ("task_id", "department_id"),
  CONSTRAINT "task_departments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "task_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "task_departments_task_id_idx" ON "task_departments"("task_id");
CREATE INDEX IF NOT EXISTS "task_departments_department_id_idx" ON "task_departments"("department_id");

INSERT INTO "task_departments" ("task_id", "department_id")
SELECT "id", "department_id"
FROM "tasks"
ON CONFLICT ("task_id", "department_id") DO NOTHING;
