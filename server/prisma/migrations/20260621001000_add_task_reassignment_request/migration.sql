ALTER TYPE "request_type_enum" ADD VALUE IF NOT EXISTS 'TASK_REASSIGNMENT';

ALTER TABLE "task_requests"
ADD COLUMN IF NOT EXISTS "task_id" UUID,
ADD COLUMN IF NOT EXISTS "task_title" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "task_description" TEXT,
ADD COLUMN IF NOT EXISTS "current_assignee_id" UUID,
ADD COLUMN IF NOT EXISTS "requested_assignee_id" UUID,
ADD COLUMN IF NOT EXISTS "request_reason" TEXT;

CREATE INDEX IF NOT EXISTS "idx_task_requests_task" ON "task_requests" ("task_id");

ALTER TABLE "task_requests"
ADD CONSTRAINT "fk_task_requests_task"
FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "task_requests"
ADD CONSTRAINT "fk_task_requests_current_assignee"
FOREIGN KEY ("current_assignee_id") REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "task_requests"
ADD CONSTRAINT "fk_task_requests_requested_assignee"
FOREIGN KEY ("requested_assignee_id") REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
