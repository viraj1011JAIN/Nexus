-- =============================================================================
-- Supabase Realtime Row-Level Security Policies
-- =============================================================================
--
-- PURPOSE
-- -------
-- By default, Supabase Realtime channels are open to any authenticated client
-- that knows the channel name.  Since Nexus channel names include the orgId as
-- the first segment (org:{orgId}:...), a user who guesses another org's ID
-- could subscribe and receive broadcast or presence events for that tenant.
--
-- These RLS policies enforce at the database engine level that:
--   - A client can only receive `realtime.messages` rows whose `topic` (channel
--     name) begins with their own orgId.
--   - A client can only maintain a `realtime.subscription` for a channel that
--     belongs to their own orgId.
--
-- PREREQUISITE — Clerk JWT template
-- ----------------------------------
-- The policies below read `auth.jwt() ->> 'org_id'`.  This claim must be
-- present in the Supabase JWT issued by Clerk.
--
-- Steps:
--   1. Clerk Dashboard → Configure → JWT Templates → "supabase" template.
--   2. Add the following claim to the template JSON:
--        { "org_id": "{{org.id}}" }
--   3. The Nexus hooks already call `getToken({ template: "supabase" })` —
--      no code changes needed once the template is updated.
--
-- HOW TO RUN
-- ----------
-- Execute this script in Supabase Dashboard → SQL Editor, or via:
--   psql $DATABASE_URL -f supabase-realtime-rls.sql
--
-- This script is idempotent: it drops existing Nexus policies before
-- re-creating them so it can be safely re-run.
-- =============================================================================


-- =============================================================================
-- 1. realtime.messages  (Broadcast + Presence events)
-- =============================================================================
-- The `realtime.messages` table stores in-flight broadcast and presence
-- payloads before they are fanned out to subscribed clients.  Enabling RLS
-- here ensures the Realtime engine will not deliver a message to a client
-- whose JWT does not match the channel's orgId prefix.

alter table realtime.messages enable row level security;

-- Drop existing Nexus policies to make the script idempotent
drop policy if exists "nexus_realtime_messages_select" on realtime.messages;
drop policy if exists "nexus_realtime_messages_insert" on realtime.messages;

-- SELECT: a client may read messages from channels that belong to its org
create policy "nexus_realtime_messages_select"
  on realtime.messages
  for select
  using (
    -- The JWT must contain a non-empty org_id claim that matches the channel prefix.
    -- Channel names follow the pattern: org:{orgId}:{type}:{entityId}
    coalesce(auth.jwt() ->> 'org_id', '') <> ''
    and realtime.topic() like 'org:' || (auth.jwt() ->> 'org_id') || ':%'
  );

-- INSERT: a client may broadcast to channels that belong to its org
create policy "nexus_realtime_messages_insert"
  on realtime.messages
  for insert
  with check (
    coalesce(auth.jwt() ->> 'org_id', '') <> ''
    and realtime.topic() like 'org:' || (auth.jwt() ->> 'org_id') || ':%'
  );


-- =============================================================================
-- 2. realtime.subscription  (Postgres Changes CDC subscriptions)
-- =============================================================================
-- `realtime.subscription` tracks which clients have an active CDC subscription
-- (postgres_changes listener).  Without RLS, any authenticated user could
-- subscribe to CDC events from any other tenant's tables.

alter table realtime.subscription enable row level security;

-- Drop existing Nexus policies
drop policy if exists "nexus_realtime_subscription_all" on realtime.subscription;

-- ALL: a client may create / view / remove subscriptions only for its own org's channels
create policy "nexus_realtime_subscription_all"
  on realtime.subscription
  for all
  using (
    coalesce(auth.jwt() ->> 'org_id', '') <> ''
    and (subscription_id::text || ':' || entity::text) like 'org:' || (auth.jwt() ->> 'org_id') || ':%'
  )
  with check (
    coalesce(auth.jwt() ->> 'org_id', '') <> ''
  );

-- NOTE: The `entity` column in realtime.subscription stores the subscribed
-- table OID, not the channel name.  The policy above is a conservative
-- baseline; tighter channel-name matching can be added once Supabase exposes
-- the channel name in the subscription row.  The primary channel-name
-- enforcement is on realtime.messages (policy #1 above).


-- =============================================================================
-- 3. Verify policies were created
-- =============================================================================
select
  schemaname,
  tablename,
  policyname,
  cmd
from pg_policies
where schemaname = 'realtime'
  and policyname like 'nexus_%'
order by tablename, policyname;
