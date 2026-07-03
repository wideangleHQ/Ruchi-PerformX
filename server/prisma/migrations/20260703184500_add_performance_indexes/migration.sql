CREATE INDEX IF NOT EXISTS "idx_notifications_user_created" ON "notifications"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_notifications_user_read" ON "notifications"("user_id", "is_read");

CREATE INDEX IF NOT EXISTS "idx_self_actions_creator_deleted_created" ON "self_actions"("created_by_id", "deleted_at", "created_at");
CREATE INDEX IF NOT EXISTS "idx_self_actions_status_deleted_created" ON "self_actions"("status", "deleted_at", "created_at");

CREATE INDEX IF NOT EXISTS "idx_task_requests_user_status_created" ON "task_requests"("requested_by_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "idx_task_requests_dept_status_created" ON "task_requests"("department_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "idx_task_requests_type_status_task" ON "task_requests"("type", "status", "task_id");

CREATE INDEX IF NOT EXISTS "idx_task_status_logs_task_created" ON "task_status_logs"("task_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_task_transfers_status_from_dept" ON "task_transfers"("status", "from_dept_id");
CREATE INDEX IF NOT EXISTS "idx_task_transfers_status_to_dept" ON "task_transfers"("status", "to_dept_id");

CREATE INDEX IF NOT EXISTS "idx_tasks_deleted_due" ON "tasks"("deleted_at", "due_date");
CREATE INDEX IF NOT EXISTS "idx_tasks_department_deleted_status" ON "tasks"("department_id", "deleted_at", "status");
CREATE INDEX IF NOT EXISTS "idx_tasks_assigned_to_deleted_status" ON "tasks"("assigned_to_id", "deleted_at", "status");
CREATE INDEX IF NOT EXISTS "idx_tasks_assigned_by_deleted_status" ON "tasks"("assigned_by_id", "deleted_at", "status");
CREATE INDEX IF NOT EXISTS "idx_tasks_status_deleted_due" ON "tasks"("status", "deleted_at", "due_date");
CREATE INDEX IF NOT EXISTS "idx_tasks_type_deleted_status" ON "tasks"("task_type", "deleted_at", "status");
CREATE INDEX IF NOT EXISTS "idx_tasks_completed_at" ON "tasks"("completed_at");
CREATE INDEX IF NOT EXISTS "idx_tasks_reviewed_at" ON "tasks"("reviewed_at");

CREATE INDEX IF NOT EXISTS "idx_users_role_active_deleted_pending" ON "users"("role", "is_active", "deleted_at", "pending_approval");
CREATE INDEX IF NOT EXISTS "idx_users_department_role_active" ON "users"("department_id", "role", "is_active", "deleted_at", "pending_approval");

CREATE INDEX IF NOT EXISTS "idx_visits_deleted_status" ON "visits"("deletedAt", "status");
CREATE INDEX IF NOT EXISTS "idx_visits_deleted_check_in" ON "visits"("deletedAt", "checkInTime");
CREATE INDEX IF NOT EXISTS "idx_visits_deleted_created" ON "visits"("deletedAt", "createdAt");
CREATE INDEX IF NOT EXISTS "idx_visits_host_deleted_created" ON "visits"("hostEmployeeId", "deletedAt", "createdAt");
