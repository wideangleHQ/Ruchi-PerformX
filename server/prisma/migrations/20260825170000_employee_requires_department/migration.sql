-- An employee whose department_id is null cannot file a self action and cannot
-- be seen by their own HOD, because DepartmentScopeService resolves an
-- EMPLOYEE's whole scope from this one column and every list query filters on
-- the result. Nothing in the product says so: the create form has no department
-- field for an employee, and the only symptom is "User must belong to a
-- department" on submit.
--
-- One live account reached that state. Its last self action was written against
-- Marketing on 2026-08-24 15:51, which requires the column to have been set at
-- that moment, and it was null the next morning. There is no record of how:
-- audit_logs holds no rows for the users entity, and users.updated_at is
-- @default(now()) with no @updatedAt, so it still reads the creation date.
--
-- UsersService now refuses the two edits that could produce it. This constraint
-- is what makes the rule hold for Studio and psql too.

-- Restore anyone already in that state from the department their own most
-- recent self action was filed against. That join row is the surviving evidence
-- of where they worked, and it is written from the same column at create time.
UPDATE "users" u
SET "department_id" = restored."department_id"
FROM (
    SELECT DISTINCT ON (s."created_by_id")
           s."created_by_id" AS "user_id",
           j."department_id"
    FROM "self_actions" s
    JOIN "self_action_departments" j ON j."self_action_id" = s."id"
    ORDER BY s."created_by_id", s."created_at" DESC
) restored
WHERE u."id" = restored."user_id"
  AND u."role" = 'EMPLOYEE'
  AND u."department_id" IS NULL;

-- EMPLOYEE only. HOD, EA, PA, DEPARTMENT_CONTROLLER and PURCHASE_HEAD carry
-- their departments in hod_departments and assistant_departments, and this
-- column is deliberately null for all of them.
ALTER TABLE "users"
ADD CONSTRAINT "users_employee_has_department"
CHECK ("role" <> 'EMPLOYEE' OR "department_id" IS NOT NULL);
