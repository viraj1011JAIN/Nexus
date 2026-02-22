# Nexus — Multi-Tenant Architecture & Security Reference

**Last updated:** February 22, 2026  
**Stack:** Next.js 16 App Router · Clerk · Prisma 5 · PostgreSQL (Supabase) · Supabase Realtime  
**Workspace:** `c:\Nexus\nexus`

---

## Table of Contents

1. [What Is Multi-Tenancy in Nexus?](#1-what-is-multi-tenancy-in-nexus)
2. [Data Model — How Tenants Are Structured](#2-data-model--how-tenants-are-structured)
3. [The Four Security Layers](#3-the-four-security-layers)
   - [Layer 1 — Edge Middleware (proxy.ts)](#layer-1--edge-middleware-proxyts)
   - [Layer 2 — Tenant Context (lib/tenant-context.ts)](#layer-2--tenant-context-libtenant-contextts)
   - [Layer 3 — Data Access Layer (lib/dal.ts)](#layer-3--data-access-layer-libdalts)
   - [Layer 4 — Database RLS (prisma/migrations/rls_policies.sql)](#layer-4--database-rls)
4. [How a Request Flows Through All Layers](#4-how-a-request-flows-through-all-layers)
5. [Role-Based Access Control (RBAC)](#5-role-based-access-control-rbac)
6. [Realtime Channel Isolation](#6-realtime-channel-isolation)
7. [Dual Database Clients — App vs System](#7-dual-database-clients--app-vs-system)
8. [Audit Logging](#8-audit-logging)
9. [Billing Isolation (Stripe)](#9-billing-isolation-stripe)
10. [Attack Scenarios & Defences](#10-attack-scenarios--defences)
11. [File Inventory](#11-file-inventory)
12. [Environment Variables Required](#12-environment-variables-required)

---

## 1. What Is Multi-Tenancy in Nexus?

Nexus is a project-management tool (boards → lists → cards) where each **organisation** is a completely isolated tenant. Multiple organisations live in the same PostgreSQL database, but:

- **Organisation A can never see, read, or modify data belonging to Organisation B** — even if a bug exists in the application layer.
- Every piece of user data — boards, lists, cards, labels, comments, audit logs, analytics — is stamped with an `org_id` column and/or reachable through a foreign-key chain that terminates at `boards.org_id`.
- The system uses **four independent, overlapping security layers** so that a bypass of any single layer is not enough to cause a breach. An attacker must defeat all four layers simultaneously.

**Tenancy identity source:** Clerk acts as the identity provider. The `orgId` inside Clerk's signed JWT is the canonical tenant identifier. It is never trusted from URL parameters, form inputs, or HTTP headers sent by the client.

---

## 2. Data Model — How Tenants Are Structured

```
Organization (= Clerk org, id = Clerk orgId)
│
├── OrganizationUser[]  (who belongs to this org + their role)
│     ├── role: OWNER | ADMIN | MEMBER | GUEST
│     ├── isActive: boolean        ← explicit deactivation lock
│     ├── invitedById, invitedAt, joinedAt
│     └── → User (clerkUserId, email, name)
│
├── Board[]  (org_id FK)
│     └── List[]
│           └── Card[]
│                 ├── Comment[]
│                 │     └── CommentReaction[]
│                 └── CardLabelAssignment[]
│                       └── Label (org_id FK)
│
├── AuditLog[]  (org_id FK)
│
└── Subscription (subscriptionPlan, stripeCustomerId, etc.)
```

### Key schema rules

| Model | How it is tenant-scoped |
|-------|------------------------|
| `Organization` | `id` IS the Clerk `orgId` (set explicitly on creation) |
| `OrganizationUser` | `organization_id` FK + unique `(userId, organizationId)` |
| `Board` | `org_id` FK → `organizations.id` + DB index |
| `List` | No `org_id`; scoped via `board_id` → `boards.org_id` |
| `Card` | No `org_id`; scoped via `list_id` → `lists.board_id` → `boards.org_id` |
| `Label` | `org_id` FK + unique `(orgId, name)` |
| `CardLabelAssignment` | Scoped via `card_id` → card → list → board → org |
| `Comment` | Scoped via `card_id` chain |
| `AuditLog` | `org_id` FK + indexed |
| `BoardAnalytics` | Scoped via `board_id` |
| `UserAnalytics` | `org_id` + `user_id` fields |

> **Design principle:** Models that have no direct `org_id` (List, Card, Comment, etc.) are scoped through FK traversal. The DAL verifies this chain before every read and write.

---

## 3. The Four Security Layers

### Layer 1 — Edge Middleware (`proxy.ts`)

**Location:** `c:\Nexus\nexus\proxy.ts`  
**Runs at:** Vercel Edge Network / Next.js middleware, before any server component or API route handler executes.

**What it does:**

```
Incoming request
      │
      ▼
Is this a public route? (/, /sign-in, /sign-up, /api/webhook/stripe)
 YES → pass through
  NO ↓
      │
      ▼
Does the request have a valid Clerk session (userId)?
 NO  → redirect to /sign-in?redirect_url=<original_path>
 YES ↓
      │
      ▼
Does the session have an active orgId (organisation selected)?
 NO  → redirect to /select-org
 YES ↓
      │
      ▼
Inject verified identity headers into the request:
  x-tenant-id = orgId         (set SERVER-SIDE, never by client)
  x-user-id   = userId
  x-org-role  = orgRole
      │
      ▼
  Pass to route handler
```

**Security properties:**
- No unauthenticated request ever reaches a page or API handler.
- No authenticated-but-org-less request ever reaches data routes.
- Headers `x-tenant-id`, `x-user-id`, `x-org-role` are written by the middleware from a cryptographically verified Clerk JWT. A browser cannot forge them because any header sent by the client is overwritten here.
- The `/select-org` page itself is excluded from the redirect loop guard via an explicit path check.

---

### Layer 2 — Tenant Context (`lib/tenant-context.ts`)

**Location:** `c:\Nexus\nexus\lib\tenant-context.ts`  
**Runs at:** Inside every Server Action and API route handler.

This is the **single source of truth** for "who is the current user and what org are they acting for." It is built on two design pillars:

#### Pillar A — React `cache()` deduplication

```typescript
export const getTenantContext = cache(async (): Promise<TenantContext> => { ... });
```

`cache()` coalesces all calls within a single request into **one** Clerk auth check and **one** DB membership check, regardless of how many actions call `getTenantContext()`. This means no N+1 auth calls across a complex server component tree.

#### Pillar B — Immutable typed result, never null

The function either:
- Returns a fully populated `TenantContext` object, or
- Throws a typed `TenantError` (`UNAUTHENTICATED` | `FORBIDDEN` | `NOT_FOUND`)

It never returns `null` or `undefined`. This forces callers to handle failure explicitly; they cannot accidentally proceed with an undefined context.

#### How membership is verified

```typescript
// Step 1: Get verified identity from Clerk's signed JWT
const { userId, orgId, orgRole } = await auth();

// Step 2: Check local OrganizationUser record
// NOTE: OrganizationUser.userId is a UUID FK to User.id, not to Clerk's string.
// We query via the User relation: user.clerkUserId = userId
const membership = await db.organizationUser.findFirst({
  where: {
    user: { clerkUserId: userId },
    organizationId: orgId,
  },
  select: { role: true, isActive: true },
});

// Step 3: Explicit deactivation check
// A local isActive=false overrides anything Clerk says
if (membership?.isActive === false) {
  throw new TenantError("FORBIDDEN", "Not an active member of this organization");
}

// Step 4: Lazy trust fallback
// No local record? Trust Clerk's JWT role (new user, not yet in our DB).
// The row will be created on first action.
const tenantRole = membership 
  ? membership.role 
  : normalizeClerkRole(orgRole);
```

**Why two sources (Clerk + local DB)?**

| Concern | Authority |
|---------|-----------|
| "Is this a real user?" | Clerk (cryptographic JWT verification) |
| "Has this user been deactivated by an admin?" | Local `OrganizationUser.isActive` |
| "What role does this user have?" | Local DB (if row exists), else Clerk JWT |

This dual-source design means an org admin can hard-block a user even if that user still has a valid Clerk session (e.g. their session hasn't expired yet).

#### Role enforcement

```typescript
// Every mutation action starts with:
const ctx = await getTenantContext();
await requireRole("MEMBER", ctx);  // blocks GUESTs

// Admin-only operations:
await requireRole("ADMIN", ctx);   // blocks MEMBERs and GUESTs
```

`requireRole` uses a numeric hierarchy:

```
OWNER = 4  >  ADMIN = 3  >  MEMBER = 2  >  GUEST = 1
```

Any role with a number lower than the required minimum throws `TenantError("FORBIDDEN")`.

---

### Layer 3 — Data Access Layer (`lib/dal.ts`)

**Location:** `c:\Nexus\nexus\lib\dal.ts`  
**Instantiated:** `createDAL(ctx)` at the top of every server action.

The DAL is a class (`TenantDAL`) that is **constructed with `orgId` and `userId` locked in at instantiation time**. All database queries issued through it automatically include the tenant scope — there is no way to accidentally omit it.

#### Architecture

```typescript
class TenantDAL {
  constructor(
    private readonly orgId: string,   // from Clerk JWT, immutable
    private readonly userId: string   // from Clerk JWT, immutable
  ) {}
}
```

The `orgId` is set in the constructor from the verified `TenantContext`. No method accepts an `orgId` parameter. You cannot call `dal.boards.findMany({ orgId: "some-other-org" })` — the field is entirely absent from the API surface.

#### Namespace pattern

The DAL exposes seven namespaces, each a getter that closes over `this.orgId` / `this.userId`:

```
dal.boards         — CRUD on boards (orgId injected into every query)
dal.lists          — CRUD on lists (ownership verified via board→org chain)
dal.cards          — CRUD on cards (ownership verified via card→list→board→org chain)
dal.labels         — CRUD on labels (org-scoped)
dal.assignees      — Assign/unassign users to cards (card ownership verified)
dal.comments       — CRUD on comments (org ownership + user ownership for edits)
dal.commentReactions — Add/remove reactions (comment ownership verified)
dal.auditLogs      — Create/query audit logs (orgId injected from constructor)
```

#### Ownership verification — defence against ID injection

Every write (create, update, delete) and every cross-entity read goes through a private ownership guard:

```typescript
// Board-level guard — used by all mutations
private async verifyBoardOwnership(boardId: string): Promise<void> {
  const board = await db.board.findUnique({
    where: { id: boardId },
    select: { orgId: true },
  });
  if (!board || board.orgId !== this.orgId) {
    throw new TenantError("NOT_FOUND", "Board not found");
  }
}

// Card-level guard — traverses Card → List → Board → orgId
private async verifyCardOwnership(cardId: string): Promise<void> {
  const card = await db.card.findUnique({
    where: { id: cardId },
    select: { list: { select: { board: { select: { orgId: true } } } } },
  });
  if (!card?.list?.board || card.list.board.orgId !== this.orgId) {
    throw new TenantError("NOT_FOUND", "Card not found");
  }
}
```

**Cross-tenant mismatch always returns `NOT_FOUND`, never `FORBIDDEN`.** This is intentional — `FORBIDDEN` would confirm to an attacker that the resource exists. `NOT_FOUND` reveals nothing.

#### Reorder injection protection

The reorder endpoints are a common attack vector (attacker injects card IDs from another org into the reorder payload). The DAL defends this explicitly:

```typescript
reorder: async (items: Array<{ id: string; order: string }>, boardId: string) => {
  await self.verifyBoardOwnership(boardId);

  // Ground truth: fetch ONLY the IDs that actually belong to this board
  const listsInBoard = await db.list.findMany({
    where: { boardId },
    select: { id: true },
  });
  const validIds = new Set(listsInBoard.map((l) => l.id));

  // Reject if ANY client-supplied ID is not in this board
  for (const item of items) {
    if (!validIds.has(item.id)) {
      throw new TenantError("NOT_FOUND", "List not found");
    }
  }

  // Now safe to run the batch update
  return db.$transaction(items.map((list) =>
    db.list.update({ where: { id: list.id }, data: { order: list.order } })
  ));
};
```

---

### Layer 4 — Database RLS

**Location:** `c:\Nexus\nexus\prisma\migrations\rls_policies.sql`  
**Runs at:** PostgreSQL query execution time — inside the database engine itself.

Row-Level Security is the **last line of defence**. Even if all three application layers are bypassed (compromised server, supply-chain attack, SQL injection), RLS ensures the database engine itself refuses to return or modify data from the wrong tenant.

#### How it is implemented

A helper function reads a session variable that the application sets at the start of each transaction:

```sql
CREATE OR REPLACE FUNCTION current_org_id()
RETURNS TEXT
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(current_setting('app.current_org_id', TRUE), '');
$$;
```

Each table has a `tenant_isolation` policy:

```sql
-- Direct org_id tables (simple check)
CREATE POLICY tenant_isolation ON boards
  FOR ALL USING (org_id = current_org_id());

-- Derived tables (FK chain check)
CREATE POLICY tenant_isolation ON cards
  FOR ALL USING (
    list_id IN (
      SELECT l.id FROM lists l
      JOIN boards b ON b.id = l.board_id
      WHERE b.org_id = current_org_id()
    )
  );
```

#### Tables protected by RLS

All 14 tenant-scoped tables have RLS enabled:

```
organizations · organization_users · boards · lists · cards
labels · card_label_assignments · comments · comment_reactions
audit_logs · board_analytics · user_analytics · activity_snapshots · users
```

#### Two database roles

| Role | Connection String | RLS Applied | Used By |
|------|------------------|-------------|---------|
| Application role | `DATABASE_URL` | ✅ Yes — always subject to RLS | Server actions, API routes, DAL |
| Service role | `SYSTEM_DATABASE_URL` | ❌ No — bypasses RLS (superuser) | Stripe webhooks, cron jobs only |

The `systemDb` client (`lib/db.ts`) uses `SYSTEM_DATABASE_URL` and is only imported in two files. It is never accessible in server actions or user-triggered API routes.

---

## 4. How a Request Flows Through All Layers

The following traces a `deleteCard` server action from browser click to database:

```
Browser: user clicks "Delete Card" on card ID = "card-abc-123"
         ↓
         Server Action: deleteCard({ id: "card-abc-123" })
         ↓
─────────────────────────────────────────────────────────────────
LAYER 1 — proxy.ts (already ran when page was served)
  ✓ userId verified from Clerk JWT
  ✓ orgId verified from Clerk JWT
  ✓ Request headers x-tenant-id, x-user-id set
─────────────────────────────────────────────────────────────────
         ↓
LAYER 2 — getTenantContext()  [inside delete-card.ts]
  ✓ auth() returns (userId, orgId) from signed JWT
  ✓ DB query: OrganizationUser where user.clerkUserId = userId AND org = orgId
  ✓ membership.isActive !== false
  ✓ requireRole("MEMBER") passes (user is MEMBER or above)
  → Returns TenantContext { userId, orgId, membership }
─────────────────────────────────────────────────────────────────
         ↓
LAYER 3 — DAL  [inside delete-card.ts]
  ✓ createDAL(ctx)  →  TenantDAL { orgId = ctx.orgId, userId = ctx.userId }
  ✓ dal.cards.delete("card-abc-123") called
  ✓ verifyCardOwnership("card-abc-123"):
      SELECT list.board.orgId FROM cards WHERE id = "card-abc-123"
      orgId from DB must === ctx.orgId
      → If mismatch: throws TenantError NOT_FOUND  ← cross-tenant blocked
  ✓ Ownership confirmed → db.card.delete({ where: { id: "card-abc-123" } })
─────────────────────────────────────────────────────────────────
         ↓
LAYER 4 — PostgreSQL RLS  [inside Supabase]
  ✓ Policy: cards.list_id must be in (lists ∩ boards where org_id = current_org_id())
  ✓ Even if layers 1-3 were bypassed, the engine rejects wrong-org reads
─────────────────────────────────────────────────────────────────
         ↓
  Card deleted. Audit log written. Path revalidated.
  Response: { data: deletedCard }
```

If the card belongs to a **different org**, the flow short-circuits at Layer 3 and returns `{ error: "The requested resource was not found." }` — a generic message that reveals nothing.

---

## 5. Role-Based Access Control (RBAC)

### Roles and hierarchy

```
OWNER (4)  — Full control: can delete org, transfer ownership, manage billing
  │
ADMIN (3)  — Can manage members, all board/card operations
  │
MEMBER (2) — Can create/edit/delete boards, lists, cards (default role)
  │
GUEST (1)  — Read-only access (cannot create or modify anything)
```

### How roles are assigned

1. **Primary source:** Clerk org membership (stored in JWT as `org:admin`, `org:member`, etc.)
2. **Local override:** `OrganizationUser.role` in the database (set when the membership row is created)
3. **Fallback:** `normalizeClerkRole(orgRole)` maps Clerk strings to internal `TenantRole` if no local row exists yet

### Enforcement in action files

Every mutating server action follows this pattern:

```typescript
// delete-card.ts
const ctx = await getTenantContext();
await requireRole("MEMBER", ctx);    // minimum: any real member
const dal = await createDAL(ctx);
```

For admin-level operations (e.g. managing members):

```typescript
// hypothetical member-management action
const ctx = await getTenantContext();
await requireRole("ADMIN", ctx);     // blocks MEMBERs and GUESTs
```

### Error handling — no information leakage

`createSafeAction` wraps all actions and maps `TenantError` to generic client-facing messages:

```typescript
const TENANT_ERROR_MESSAGES = {
  UNAUTHENTICATED: "You must be signed in to perform this action.",
  FORBIDDEN:       "You do not have permission to perform this action.",
  NOT_FOUND:       "The requested resource was not found.",
};
```

The actual error code, org ID, entity ID, and internal details are **never sent to the browser**.

---

## 6. Realtime Channel Isolation

**Location:** `c:\Nexus\nexus\lib\realtime-channels.ts`

Supabase Realtime channel subscriptions are client-controlled by default. Without isolation, a user from Org A could subscribe to `board:board-id-from-org-B` and receive live events for another tenant's board.

### Channel naming scheme

Every channel name is namespaced with the authenticated org's ID:

```
Pattern:  org:{orgId}:{type}:{entityId}

Examples:
  org:org_abc123:board:board-xyz        ← board mutations
  org:org_abc123:presence:board-xyz     ← who is online on that board
  org:org_abc123:analytics:board-xyz    ← live metrics
  org:org_abc123:boards                 ← org-wide board list changes
  org:org_abc123:activity               ← org-wide audit log feed
```

### Enforcement functions

```typescript
// Extract and validate the org from a channel name
export function extractOrgIdFromChannel(channelName: string): string | null {
  const match = channelName.match(/^org:([^:]+):/);
  return match ? match[1] : null;
}

// Hard assertion — throws if channelName belongs to a different org
export function assertChannelBelongsToOrg(channelName: string, orgId: string): void {
  const channelOrgId = extractOrgIdFromChannel(channelName);
  if (channelOrgId !== orgId) {
    throw new Error(`Channel isolation violation: "${channelName}" ≠ org "${orgId}"`);
  }
}
```

### Two defence layers for realtime

| Layer | Mechanism | When it fires |
|-------|-----------|---------------|
| Application | Channel naming prefix `org:{orgId}:` | At subscription time — client subscribes to the wrong channel name |
| Database | Supabase Realtime respects RLS on `postgres_changes` publications | At event delivery — DB row change only delivered if RLS allows it |

---

## 7. Dual Database Clients — App vs System

**Location:** `c:\Nexus\nexus\lib\db.ts`

```typescript
// Standard client — ALWAYS subject to RLS
export const db = new PrismaClient();
// Uses DATABASE_URL (app role, restricted privileges)

// System client — bypasses RLS (superuser)
export const systemDb = new PrismaClient({
  datasources: { db: { url: process.env.SYSTEM_DATABASE_URL } }
});
// Uses SYSTEM_DATABASE_URL (service role)
```

### Where each is used

| Client | Imported by | Why |
|--------|-------------|-----|
| `db` | All server actions, DAL, API routes | Normal tenant-scoped operations |
| `systemDb` | `app/api/webhook/stripe/route.ts` | Must update org billing cross-tenant (Stripe doesn't know about sessions) |
| `systemDb` | `app/api/cron/daily-reports/route.ts` | Scheduled job that reads all orgs |

**Rule:** `systemDb` must never be imported in any file reachable from user-triggered actions. CI linting should enforce this (grep for `systemDb` outside of allowed files).

---

## 8. Audit Logging

Every mutating action (create/update/delete on boards, lists, cards) writes a tamper-evidence log entry via `dal.auditLogs.create(...)`.

### Schema

```
AuditLog {
  id, orgId (FK), action (CREATE|UPDATE|DELETE),
  entityId, entityType (BOARD|LIST|CARD|ORGANIZATION), entityTitle,
  userId, userName, userImage,
  ipAddress, userAgent,   ← request context for forensics
  createdAt, updatedAt
}
```

### Security properties

- `orgId` and `userId` come from the DAL constructor (from the verified `TenantContext`), never from input.
- `ipAddress` and `userAgent` fields support security forensics (who did what from where).
- Audit logs are **read-only from the application layer** — no delete or update methods are exposed in the DAL.
- Each org can only read its own audit logs (`dal.auditLogs.findMany()` always filters by `orgId`).

---

## 9. Billing Isolation (Stripe)

Each `Organization` row holds its own Stripe fields:

```
subscriptionPlan       FREE | PRO
stripeCustomerId       unique (per org)
stripeSubscriptionId   unique (per org)
stripeSubscriptionStatus
stripePriceId
stripeCurrentPeriodEnd
```

### Limits enforcement (per plan, per org)

In `create-board.ts`:

```typescript
const boardLimit = STRIPE_CONFIG.limits[organization.subscriptionPlan].boards;
if (currentBoardCount >= boardLimit) {
  return { error: "LIMIT_REACHED" };
}
```

The `subscriptionPlan` is read from the **database** (always the org's own row), not from user input. An org on a FREE plan cannot claim PRO limits.

### Stripe webhook security

The webhook handler uses `systemDb` (bypasses RLS) with Stripe signature verification:

```typescript
// app/api/webhook/stripe/route.ts
const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
// Only after signature verification does the handler update the org's billing fields
await systemDb.organization.update({ ... });
```

---

## 10. Attack Scenarios & Defences

### Scenario A — Horizontal privilege escalation (accessing another org's board)

**Attack:** User in Org A sends a server action request with a board ID that belongs to Org B.

**Defences:**
1. **Layer 2** — `getTenantContext()` sets `ctx.orgId` = Clerk JWT orgId. No user input can change this.
2. **Layer 3** — `dal.boards.findUnique(boardId)` calls `verifyBoardOwnership` → `boards.orgId !== ctx.orgId` → throws `NOT_FOUND`.
3. **Layer 4** — RLS policy on `boards` table: `org_id = current_org_id()` blocks the query at DB level.

---

### Scenario B — ID injection in reorder endpoints

**Attack:** User intercepts the card reorder request and injects card IDs from another org into the `items` array.

**Defence (Layer 3 — DAL reorder method):**
```
1. verifyBoardOwnership(boardId) — confirms board is in this org
2. Fetches ACTUAL card IDs from DB for this board
3. Compares each submitted ID against the whitelist
4. Rejects entire request if any ID is foreign
```

---

### Scenario C — Direct database access (bypassing application layer entirely)

**Attack:** SQL injection, compromised server process, or leaked `DATABASE_URL`.

**Defence (Layer 4 — RLS):**
- Even with direct `psql` access using the app role, every query is subject to RLS.
- Without `SET app.current_org_id = 'xxx'`, `current_org_id()` returns `''`, meaning ALL tenant-scoped queries return zero rows.

---

### Scenario D — Explicitly deactivated user continues acting

**Attack:** An admin deactivates a member (`isActive = false`), but the user's Clerk session is still valid (hasn't expired).

**Defence (Layer 2 — tenant-context.ts):**
```typescript
if (membership?.isActive === false) {
  throw new TenantError("FORBIDDEN", "Not an active member");
}
```
The local DB check overrides Clerk. Session expiry is not required to lock someone out instantly.

---

### Scenario E — Realtime cross-tenant channel subscription

**Attack:** A user from Org A tries to subscribe to `org:org_B_id:board:xyz` to receive live card updates for Org B.

**Defences:**
1. **Application layer** — Channel name is constructed server-side as `boardChannel(ctx.orgId, boardId)`. The user cannot inject a different `orgId`.
2. **Database layer** — Supabase Realtime `postgres_changes` events respect RLS. Even if the subscription is made, no change events will be delivered because the DB row's `org_id` won't match the authenticated user's allowed org.

---

### Scenario F — IDOR on labels (cross-tenant label assignment)

**Attack:** User assigns a label from Org B to a card in Org A.

**Defence (DAL labels.assign):**
```typescript
assign: async (cardId: string, labelId: string) => {
  await self.verifyCardOwnership(cardId);    // card must be in this org
  await self.verifyLabelOwnership(labelId);  // label must ALSO be in this org
  ...
}
```
Both IDs are independently verified against `this.orgId`. Cross-tenant assignments are impossible.

---

### Scenario G — Forged tenant headers

**Attack:** A client sends `x-tenant-id: org_victim_id` in the HTTP request headers.

**Defence (Layer 1 + Layer 2):**
- The middleware (`proxy.ts`) **overwrites** these headers with values derived from the Clerk JWT. Any client-supplied header with these names is replaced.
- Even if somehow bypassed, Layer 2 calls `auth()` directly from the Clerk SDK, which reads and verifies the JWT — it does not use the `x-tenant-id` header.

---

## 11. File Inventory

| File | Role |
|------|------|
| `proxy.ts` | Edge middleware: auth gate, org selection, header injection |
| `app/select-org/page.tsx` | UI for selecting/creating an org on first login |
| `lib/tenant-context.ts` | `getTenantContext()`, `TenantError`, `requireRole()`, `isDemoContext()` |
| `lib/dal.ts` | `TenantDAL` — all tenant-scoped database access |
| `lib/db.ts` | `db` (app role) and `systemDb` (service role) Prisma clients |
| `lib/create-safe-action.ts` | Wraps all actions; catches `TenantError`; generic client messages |
| `prisma/schema.prisma` | Full data model: org, user, membership, board, list, card, label, comment, audit |
| `prisma/migrations/rls_policies.sql` | PostgreSQL RLS policies for all 14 tables |
| `lib/realtime-channels.ts` | Org-namespaced channel name generators and validators |
| `lib/supabase/client.ts` | Supabase realtime client (anon key, Clerk handles auth) |
| `actions/create-board.ts` | Board creation with plan limit check |
| `actions/delete-board.ts` | Board deletion via DAL (ownership verified) |
| `actions/create-card.ts` | Card creation via DAL |
| `actions/delete-card.ts` | Card deletion via DAL |
| `actions/update-card.ts` | Card update via DAL |
| `actions/update-card-order.ts` | Reorder with injection protection |
| `actions/create-list.ts` | List creation via DAL |
| `actions/delete-list.ts` | List deletion via DAL |
| `actions/update-list.ts` | List update via DAL |
| `actions/update-list-order.ts` | Reorder with injection protection |
| `actions/label-actions.ts` | Label CRUD via DAL |
| `actions/assignee-actions.ts` | User assignment via DAL |
| `actions/get-card.ts` | Card fetch via DAL (returns null for cross-tenant) |
| `actions/get-audit-logs.ts` | Org-scoped audit log fetch |
| `app/api/webhook/stripe/route.ts` | Billing webhook using `systemDb` |
| `app/api/cron/daily-reports/route.ts` | Cron job using `systemDb` |

---

## 12. Environment Variables Required

| Variable | Purpose | Role |
|----------|---------|------|
| `DATABASE_URL` | App-role PostgreSQL connection (RLS enforced) | Prisma `db` client |
| `DIRECT_URL` | Direct (non-pooled) connection for migrations | Prisma migrations |
| `SYSTEM_DATABASE_URL` | Service-role connection (bypasses RLS) | `systemDb` — webhooks/crons only |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk frontend auth | Clerk SDK |
| `CLERK_SECRET_KEY` | Clerk server-side JWT verification | Clerk SDK |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Realtime client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key for Realtime | Realtime client |
| `STRIPE_API_KEY` | Stripe API for billing operations | Stripe SDK |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification | Webhook handler |
| `DEMO_ORG_ID` | Optional: org ID that triggers demo mode (read-only) | `isDemoContext()` |

---

## Summary — Defence in Depth

```
Request arrives
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 1: Edge Middleware (proxy.ts)                         │
│  • Valid Clerk session required                             │
│  • Active org required                                      │
│  • Trusted headers injected (client values overwritten)     │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 2: Tenant Context (lib/tenant-context.ts)             │
│  • orgId from Clerk JWT (unforgeable)                       │
│  • isActive=false check (instant revocation)                │
│  • Typed TenantError thrown on any failure                  │
│  • requireRole() enforces RBAC before mutations             │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 3: Data Access Layer (lib/dal.ts)                     │
│  • orgId immutably locked in TenantDAL constructor          │
│  • Ownership verified before every read and write           │
│  • FK chain traversal for models without direct org_id      │
│  • Reorder injection attack prevention                      │
│  • Cross-tenant mismatch → NOT_FOUND (never FORBIDDEN)      │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 4: PostgreSQL Row-Level Security                      │
│  • 14 tables protected with tenant_isolation policies       │
│  • DB engine enforces org isolation at query time           │
│  • Bypassing layers 1-3 still cannot read wrong-org data   │
│  • Service role (systemDb) only for webhooks/crons          │
└─────────────────────────────────────────────────────────────┘
```

Any single-layer bypass is insufficient for a breach. An attacker must defeat the Clerk JWT (cryptographic), the application ownership checks (server-side), and PostgreSQL's RLS engine (database-level) simultaneously.
