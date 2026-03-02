-- =============================================================================
-- supabase-audit-immutability.sql
-- Postgres-level immutability guard for the audit_logs table.
--
-- PURPOSE
-- ────────────────────────────────────────────────────────────────────────────
-- This trigger is Layer 3 of NEXUS's audit forensic integrity architecture.
-- It makes audit_log rows physically immutable at the database level:
-- no application credential, no service role, no API key can DELETE or UPDATE
-- an existing audit log row. The only permitted operation is INSERT.
--
-- WHY THIS IS NECESSARY
-- ────────────────────────────────────────────────────────────────────────────
-- Supabase's service_role bypasses Row Level Security policies, which means
-- RLS alone cannot protect audit logs from a compromised service_role key.
-- BEFORE triggers fire for ALL database roles — including service_role —
-- creating a hard enforcement layer that RLS cannot provide.
--
-- The only actor who can disable this trigger is a Postgres SUPERUSER with
-- direct database access (not the service_role). That threat model is
-- outside the application tier and requires a separate security response
-- (DB credential rotation, audit of pg_hba.conf, server access logs).
--
-- COMPLEMENTARY LAYERS
-- ────────────────────────────────────────────────────────────────────────────
-- Layer 1 — lib/create-audit-log.ts   Prisma write to the org's shard
-- Layer 2 — lib/audit-sink.ts         Axiom append-only cloud ingest
-- Layer 3 — THIS FILE                 Postgres-level delete/update block
--
-- RUN THIS ONCE
-- ────────────────────────────────────────────────────────────────────────────
-- Paste into Supabase Dashboard → SQL Editor → Run.
-- Safe to re-run (uses CREATE OR REPLACE + IF NOT EXISTS).
--
-- TESTING THE GUARD
-- ────────────────────────────────────────────────────────────────────────────
-- After running this file, verify in the SQL Editor:
--
--   -- Should FAIL with: "NEXUS: audit_logs.DELETE is forbidden"
--   DELETE FROM audit_logs LIMIT 1;
--
--   -- Should FAIL with: "NEXUS: audit_logs.UPDATE is forbidden"
--   UPDATE audit_logs SET entity_title = 'tampered' WHERE id = (
--     SELECT id FROM audit_logs LIMIT 1
--   );
--
--   -- Inserts should still succeed (append-only is the requirement)
--   -- (tested implicitly by every server action that triggers an audit log)
-- =============================================================================


-- ── Trigger function ──────────────────────────────────────────────────────────
-- Single function handles both DELETE and UPDATE via TG_OP.
-- ERRCODE 'restrict_violation' (23001) maps to Prisma error P2003/P2004,
-- making the error identifiable in application logs without parsing the message.

CREATE OR REPLACE FUNCTION enforce_audit_log_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs as trigger owner, not the calling role; ensures the
                  -- block applies even if the caller has elevated privileges.
AS $$
BEGIN
  RAISE EXCEPTION
    'NEXUS: audit_logs.% is forbidden — rows are forensically immutable. '
    'Audit trail preservation is required for security forensics and compliance. '
    'Action: %, Entity ID: %, Org: %',
    TG_OP,
    OLD.action,
    OLD.entity_id,
    OLD.org_id
  USING ERRCODE = 'restrict_violation';  -- Prisma surfaces this as P2003/P2004

  -- Control never reaches here; RETURN OLD satisfies the trigger return type.
  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION enforce_audit_log_immutability IS
  'NEXUS audit forensic integrity: blocks DELETE and UPDATE on audit_logs. '
  'Ensures audit rows are append-only regardless of database role. '
  'Part of NEXUS dual-write audit architecture (lib/audit-sink.ts).';


-- ── Trigger: block DELETE ─────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS audit_logs_forbid_delete ON audit_logs;

CREATE TRIGGER audit_logs_forbid_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION enforce_audit_log_immutability();

COMMENT ON TRIGGER audit_logs_forbid_delete ON audit_logs IS
  'Blocks all DELETE operations on audit_logs. Rows are append-only.';


-- ── Trigger: block UPDATE ─────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS audit_logs_forbid_update ON audit_logs;

CREATE TRIGGER audit_logs_forbid_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION enforce_audit_log_immutability();

COMMENT ON TRIGGER audit_logs_forbid_update ON audit_logs IS
  'Blocks all UPDATE operations on audit_logs. Rows are append-only.';


-- ── Verification query ────────────────────────────────────────────────────────
-- Run this after applying the migration to confirm both triggers are installed.

SELECT
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'audit_logs'
  AND trigger_name IN ('audit_logs_forbid_delete', 'audit_logs_forbid_update')
ORDER BY trigger_name, event_manipulation;

-- Expected output:
-- trigger_name                  | event_manipulation | action_timing | action_statement
-- audit_logs_forbid_delete      | DELETE             | BEFORE        | EXECUTE FUNCTION ...
-- audit_logs_forbid_update      | UPDATE             | BEFORE        | EXECUTE FUNCTION ...
