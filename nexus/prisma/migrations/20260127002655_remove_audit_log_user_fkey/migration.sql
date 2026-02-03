-- Remove foreign key constraint from audit_logs.user_id
-- Clerk users are not stored in the database, so we don't need this FK
ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_user_id_fkey";

-- Remove the user_id index since it's no longer a foreign key
DROP INDEX IF EXISTS "audit_logs_user_id_idx";