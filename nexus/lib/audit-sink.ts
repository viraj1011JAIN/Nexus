/**
 * lib/audit-sink.ts — Immutable Append-Only Audit Log Sink
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * THE FORENSIC INTEGRITY PROBLEM
 * ──────────────────────────────────────────────────────────────────────────────
 * Storing audit logs exclusively in the same Postgres database they are
 * monitoring creates a single point of failure for forensic evidence. An
 * attacker who compromises a database credential can:
 *
 *   DELETE FROM audit_logs WHERE user_id = 'attacker_id';
 *   -- Evidence of the breach is now gone.
 *
 * Defence-in-depth requires a SECOND, independently-controlled store where:
 *   ✓ Rows CAN be inserted    — audit events arrive in real time
 *   ✗ Rows CANNOT be updated  — no retroactive tampering with change history
 *   ✗ Rows CANNOT be deleted  — immutable by design; evidence persists
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ARCHITECTURE: DUAL-WRITE
 * ──────────────────────────────────────────────────────────────────────────────
 * Layer 1 — Prisma (existing)
 *   Writes to the org's shard via `create-audit-log.ts`. Used for the in-app
 *   audit trail UI (board activity feed, org admin history). Queryable via
 *   the actions in `actions/get-audit-logs.ts`.
 *
 * Layer 2 — Axiom (this module)
 *   Streams the same event to Axiom over HTTPS. Axiom is an append-only cloud
 *   log store: ingested events can be queried but never mutated or deleted via
 *   the ingest API. Deleting a dataset requires a separate management API key
 *   with elevated scope — which the application never holds.
 *
 *   Axiom is the forensic source of truth. If the Postgres copy is tampered
 *   with, the Axiom copy survives intact for incident response.
 *
 * Layer 3 — Postgres trigger (supabase-audit-immutability.sql)
 *   A BEFORE DELETE OR UPDATE trigger on `audit_logs` raises an exception at
 *   the database level, refusing all mutation attempts regardless of which
 *   credential is used. This is the application-tier hard stop.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * FAILURE HANDLING
 * ──────────────────────────────────────────────────────────────────────────────
 * The Axiom write is non-blocking — it runs via Next.js `after()` after the
 * response is already sent. A transient Axiom outage:
 *   - NEVER blocks or rolls back the parent server action
 *   - NEVER causes the user to see an error
 *   - IS logged as `warning` in structured logs (Vercel function log)
 *   - IS captured in Sentry at `warning` level (not `error` — the Prisma
 *     copy still exists; the gap is narrow and time-bounded)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * SETUP (one-time)
 * ──────────────────────────────────────────────────────────────────────────────
 *   1. Create a free Axiom account at https://axiom.co
 *   2. Create a dataset named "nexus-audit-logs" (or any name you prefer)
 *   3. Under Settings → API Tokens, create an Ingest-Only token scoped to
 *      that dataset. Use the minimum-privilege Ingest scope — do NOT grant
 *      Query or Management scope to this token.
 *   4. Add to your environment:
 *        AXIOM_DATASET=nexus-audit-logs
 *        AXIOM_API_KEY=xaat_your_ingest_token_here
 *   5. Run  supabase-audit-immutability.sql  in your Supabase SQL editor to
 *      install the Postgres-level immutability triggers.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * TESTING THE GUARD
 * ──────────────────────────────────────────────────────────────────────────────
 * From the Supabase SQL editor:
 *
 *   -- Should throw: "NEXUS: audit_logs.DELETE is forbidden"
 *   DELETE FROM audit_logs WHERE id = 'any-id';
 *
 *   -- Should throw: "NEXUS: audit_logs.UPDATE is forbidden"
 *   UPDATE audit_logs SET entity_title = 'tampered' WHERE id = 'any-id';
 *
 *   -- Should succeed (append only)
 *   -- (Insert tested implicitly by every server action that creates audit logs)
 *
 * Unit tests: __tests__/unit/audit/audit-forensic-integrity.test.ts
 */

import "server-only";

import { ACTION, ENTITY_TYPE } from "@prisma/client";
import { logger } from "@/lib/logger";
import { captureSentryException } from "@/lib/sentry-helpers";

// ── Event schema (matches AuditLog Prisma model fields) ──────────────────────

export interface AuditSinkEvent {
  /** UUID of the AuditLog row that was just written to Prisma. */
  id: string;
  orgId: string;
  boardId?: string | null;
  action: ACTION;
  entityId: string;
  entityType: ENTITY_TYPE;
  entityTitle: string;
  userId: string;
  userName: string;
  userImage?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  previousValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  /** ISO string or Date — the timestamp of the original event. */
  createdAt: Date | string;
}

// ── Axiom ingest endpoint ─────────────────────────────────────────────────────

function buildAxiomIngestUrl(dataset: string): string {
  return `https://api.axiom.co/v1/datasets/${encodeURIComponent(dataset)}/ingest`;
}

/**
 * Checks whether the Axiom sink is configured in the current environment.
 * Used by the audit health endpoint and in tests.
 */
export function isAuditSinkConfigured(): boolean {
  return Boolean(process.env.AXIOM_DATASET && process.env.AXIOM_API_KEY);
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Streams a single audit event to the Axiom append-only log store.
 *
 * **This function never throws.** All errors are captured and logged so the
 * caller (a Next.js Server Action) is never disrupted by a transient sink
 * failure.
 *
 * Call this inside Next.js `after()` to ensure it runs after the response
 * has already been sent to the client:
 *
 * ```typescript
 * import { after } from "next/server";
 * import { streamToAuditSink } from "@/lib/audit-sink";
 *
 * after(() => streamToAuditSink(event));
 * ```
 */
export async function streamToAuditSink(event: AuditSinkEvent): Promise<void> {
  const dataset = process.env.AXIOM_DATASET;
  const apiKey  = process.env.AXIOM_API_KEY;

  // ── Guard: skip gracefully when Axiom is not configured ──────────────────
  if (!dataset || !apiKey) {
    // Development: no-op silently — local envs rarely have Axiom credentials.
    // Production: warn loudly because every action is silently missing a
    //             forensic copy. This surfaces in Vercel function logs and
    //             Sentry so it doesn't go unnoticed.
    if (process.env.NODE_ENV === "production") {
      logger.warn(
        "[AUDIT_SINK] Axiom not configured — audit events are persisted in " +
        "Postgres only. Set AXIOM_DATASET and AXIOM_API_KEY to enable " +
        "immutable forensic audit logging.",
        { orgId: event.orgId, action: event.action },
      );
    }
    return;
  }

  // ── Build the Axiom payload ───────────────────────────────────────────────
  // `_time` is Axiom's canonical timestamp field. Supplying it explicitly
  // ensures events are indexed at the original event time, not the HTTP
  // request arrival time (which may differ after a retry or queue delay).
  const axiomEvent = {
    _time: event.createdAt instanceof Date
      ? event.createdAt.toISOString()
      : event.createdAt,

    // ── Identification ─────────────────────────────────────────────────────
    id:          event.id,
    orgId:       event.orgId,
    boardId:     event.boardId  ?? null,

    // ── What happened ──────────────────────────────────────────────────────
    action:      event.action,
    entityId:    event.entityId,
    entityType:  event.entityType,
    entityTitle: event.entityTitle,

    // ── Who did it ─────────────────────────────────────────────────────────
    userId:      event.userId,
    userName:    event.userName,

    // ── Where from (IP forensics) ──────────────────────────────────────────
    ipAddress:   event.ipAddress  ?? null,
    userAgent:   event.userAgent  ?? null,

    // ── Change delta (for UPDATE actions) ──────────────────────────────────
    previousValues: event.previousValues ?? null,
    newValues:      event.newValues      ?? null,

    // ── Source attribution (useful for multi-env Axiom datasets) ───────────
    source:      "nexus-app",
    environment: process.env.NODE_ENV ?? "production",
  };

  // ── Send to Axiom ─────────────────────────────────────────────────────────
  try {
    const response = await fetch(buildAxiomIngestUrl(dataset), {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      // Axiom expects an array — batch size 1 for real-time streaming.
      // For high-throughput (>100 events/s), consider batching via a queue.
      body: JSON.stringify([axiomEvent]),
      // 5-second hard timeout. Axiom ingest p99 ≈ 80 ms; this guards against
      // a hung TCP connection exhausting the serverless function's wall-clock
      // budget in pathological conditions.
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "(unreadable body)");
      throw new Error(`Axiom ingest HTTP ${response.status}: ${body.slice(0, 300)}`);
    }

  } catch (err) {
    // Sink failure is WARNING, not ERROR — the Prisma copy still exists.
    // We don't re-throw: the caller must never surface a sink failure to users.
    logger.warn(
      "[AUDIT_SINK] Failed to stream event to Axiom. " +
      "Prisma copy is intact; forensic gap until next successful ingest.",
      {
        orgId:    event.orgId,
        action:   event.action,
        entityId: event.entityId,
        error:    err instanceof Error ? err.message : String(err),
      },
    );

    captureSentryException(err, {
      level: "warning" as const,
      tags:  { source: "audit-sink", orgId: event.orgId },
    });
  }
}
