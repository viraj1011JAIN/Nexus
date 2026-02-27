# GitHub Copilot Prompt — NEXUS Full Test Suite Generation

> Paste this entire prompt into GitHub Copilot Chat (or Copilot Edits) to generate a complete test suite for the NEXUS application.

---

## CONTEXT

You are generating a comprehensive test suite for **NEXUS**, a Trello-like project management SaaS built with:
- **Framework:** Next.js 14 (App Router) with Server Actions
- **ORM:** Prisma + PostgreSQL
- **Auth:** Clerk
- **Realtime:** Supabase
- **Payments:** Stripe
- **Testing Stack:** Jest, React Testing Library, Playwright (E2E)

Generate tests using **Jest + React Testing Library** for unit/integration and **Playwright** for E2E flows. Follow this file structure:

```
__tests__/
  unit/
    auth/
    cards/
    lists/
    boards/
    comments/
    automations/
    rate-limiting/
    plan-limits/
    ai-quota/
    search/
    import-export/
    webhooks/
    api-keys/
    lexorank/
  integration/
    server-actions/
    api-routes/
    stripe-webhooks/
  e2e/
    flows/
    edge-cases/
```

Use `jest.useFakeTimers()` for rate limiting tests. Mock Prisma with `jest-mock-extended`. Mock Clerk with `@clerk/nextjs/testing`. Use `stripe-mock` for Stripe. All tests must be **deterministic and isolated**.

---

## SECTION 1 — AUTHENTICATION & SESSION TESTS

Generate the following test cases:

### 1.1 Middleware Redirects
```
GIVEN: User is signed in but has no active org
WHEN:  Any protected route is accessed
THEN:  Redirect to /select-org

GIVEN: User is not signed in
WHEN:  /dashboard is accessed
THEN:  Redirect to /sign-in

GIVEN: User has active org
WHEN:  Sign-in completes
THEN:  Redirect to /dashboard (not /select-org)
```

### 1.2 getTenantContext() — Auto-Provisioning
```
GIVEN: Valid Clerk session with orgId that has no DB row yet
WHEN:  getTenantContext() is called for the first time
THEN:  User + OrganizationUser rows are auto-created (upsert)
AND:   Subsequent calls in the same request return cached result (called once)

GIVEN: getTenantContext() is called twice in one request
WHEN:  React cache() wraps it
THEN:  DB is only hit once (verify with mock call count = 1)
```

### 1.3 Expired / Invalid Sessions
```
GIVEN: Clerk session has expired
WHEN:  Any server action calls getTenantContext()
THEN:  TenantError with code UNAUTHENTICATED is thrown
AND:   Action returns { error: "Unauthenticated" } (no stack trace exposed)

GIVEN: Session is valid but orgId is missing from JWT
WHEN:  getTenantContext() is called
THEN:  Redirect to /select-org
```

### 1.4 Demo Mode
```
GIVEN: URL contains /organization/demo-org-id segment
WHEN:  useDemoMode() hook runs
THEN:  isDemoMode === true
AND:   Read-only banner is rendered in UI

GIVEN: orgId = "demo-org-id" (exact lowercase match)
WHEN:  Any mutating server action runs
THEN:  Returns { error: "Cannot modify demo data" }
AND:   Error does NOT contain "demo-org-id", "database", or "Prisma"

GIVEN: orgId = "DEMO-ORG-ID" (uppercase variant)
WHEN:  protectDemoMode() is called
THEN:  Returns null (passes through — case-sensitive check)

GIVEN: orgId = null
WHEN:  protectDemoMode() is called
THEN:  Returns null (no error — unauthenticated context)

GIVEN: Demo org is active
WHEN:  GET/read operations are called (findMany, findFirst)
THEN:  Data is returned normally (not blocked)
```

---

## SECTION 2 — ROLE & PERMISSION TESTS

Generate tests for `requireRole()` with this matrix:

| Action                          | Min Role | Test: Lower Role Should Fail |
|---------------------------------|----------|------------------------------|
| Read board/cards/lists          | GUEST    | N/A (public)                 |
| Create/update/delete card/list  | MEMBER   | GUEST → FORBIDDEN            |
| Board settings, rename          | ADMIN    | MEMBER → FORBIDDEN           |
| Delete board, manage members    | OWNER    | ADMIN → FORBIDDEN            |
| Automation create/update/delete | ADMIN    | MEMBER → FORBIDDEN           |
| API key management              | ADMIN    | MEMBER → FORBIDDEN           |
| Billing access                  | OWNER    | ADMIN → FORBIDDEN            |

```
GIVEN: User with role GUEST attempts createCard()
THEN:  TenantError(FORBIDDEN) thrown → { error: "Insufficient permissions" }

GIVEN: User with role MEMBER attempts deleteBoard()
THEN:  TenantError(FORBIDDEN) thrown

GIVEN: requireRole() is called outside try/catch in update-board.ts
THEN:  Error is caught and returns clean { error } response (not HTTP 500)

Role weight order must be: GUEST(0) < MEMBER(1) < ADMIN(2) < OWNER(3)
Verify that role weight comparison is numeric, not string comparison
```

---

## SECTION 3 — RATE LIMITING TESTS

Use `jest.useFakeTimers()`. Test the in-memory sliding window rate limiter.

Generate tests for every action bucket:

| Action             | Limit/60s |
|--------------------|-----------|
| create-board       | 10        |
| delete-board       | 10        |
| create-list        | 20        |
| delete-list        | 20        |
| update-list-order  | 30        |
| create-card        | 60        |
| delete-card        | 40        |
| update-card        | 120       |
| update-card-order  | 120       |
| update-priority    | 60        |
| set-due-date       | 60        |
| create-comment     | 60        |
| update-comment     | 60        |
| delete-comment     | 40        |
| add-reaction       | 120       |
| remove-reaction    | 120       |
| create-label       | 10        |
| assign-label       | 120       |
| assign-user        | 120       |
| (default)          | 30        |

```
For EACH action above, generate:

TEST A — Happy path:
  GIVEN: User has made 0 requests
  WHEN:  Request N (at limit) is made
  THEN:  Request succeeds

TEST B — At limit:
  GIVEN: User has made exactly (limit) requests in 60s window
  WHEN:  Request (limit + 1) is made
  THEN:  Returns { error: "Too many requests. Try again in Xs." }
  AND:   X = Math.ceil(resetInMs / 1000) — verify value is a positive integer

TEST C — Window reset:
  GIVEN: User has hit the limit
  WHEN:  jest.advanceTimersByTime(60_001) runs
  THEN:  Next request succeeds (counter reset)

TEST D — User isolation:
  GIVEN: UserA has hit the create-card limit (60 requests)
  WHEN:  UserB makes a create-card request
  THEN:  UserB's request succeeds (separate counter)

TEST E — First request always allowed:
  GIVEN: Fresh state (no prior requests)
  WHEN:  First request is made for any action
  THEN:  Always succeeds regardless of action type
```

---

## SECTION 4 — PLAN LIMIT TESTS

### 4.1 Board Limits
```
GIVEN: Org is on FREE plan with 49 boards
WHEN:  createBoard() is called
THEN:  Board is created successfully (board count = 50)

GIVEN: Org is on FREE plan with exactly 50 boards
WHEN:  createBoard() is called
THEN:  Returns LIMIT_REACHED error
AND:   ProUpgradeModal is triggered client-side

GIVEN: Org is on PRO plan with 50 boards
WHEN:  createBoard() is called
THEN:  Board is created (no limit for PRO)

GIVEN: Two concurrent createBoard() calls when org has 49 boards (FREE plan)
WHEN:  Both execute simultaneously
THEN:  Exactly ONE succeeds (Serializable transaction prevents both inserting)
AND:   One returns LIMIT_REACHED
```

### 4.2 Card Limits
```
GIVEN: Board has 499 cards (FREE plan)
WHEN:  createCard() is called
THEN:  Card is created (count = 500)

GIVEN: Board has 500 cards (FREE plan)
WHEN:  createCard() is called
THEN:  Returns LIMIT_REACHED error
```

### 4.3 Attachment Limits
```
GIVEN: Org has 9 attachments (FREE plan)
WHEN:  Upload is triggered
THEN:  Upload succeeds (count = 10)

GIVEN: Org has 10 attachments (FREE plan)
WHEN:  Upload is triggered
THEN:  Upload rejected

GIVEN: Two concurrent uploads when org has 9 attachments (FREE plan)
WHEN:  Both execute simultaneously
THEN:  Exactly ONE succeeds (Serializable transaction with re-check)
AND:   One is rejected

GIVEN: Plan key is an unknown value (e.g. "enterprise")
WHEN:  REST API board creation is attempted
THEN:  HTTP 403 "Unknown plan" returned (fail-closed, not fail-open)
```

---

## SECTION 5 — CARD OPERATIONS TESTS

### 5.1 Validation
```
GIVEN: createCard() is called with empty title ("")
THEN:  Zod validation error returned before any DB call
AND:   DB mock is never called (verify call count = 0)

GIVEN: createCard() called with title of 1 character
THEN:  Card created successfully

GIVEN: updateCard() called with description of 10,001 characters
THEN:  Validation error returned

GIVEN: updateCard() called with description of exactly 10,000 characters
THEN:  Card updated successfully
```

### 5.2 LexoRank Ordering
```
GIVEN: generateNextOrder("z") is called
THEN:  Returns "za" (appends 'a', no overflow)

GIVEN: generateNextOrder("zz") is called
THEN:  Returns "zza"

GIVEN: generateMidpointOrder("m", "n") is called
THEN:  Returns "ma"

GIVEN: incrementOrder() is called on a string of 32 characters
THEN:  Returns string starting with "\uFFFF" with timestamp+random suffix
AND:   Result always sorts last

GIVEN: Many midpoint insertions between same two keys
THEN:  String grows but rebalanceOrders() compacts back to m, n, o, ...
```

### 5.3 Concurrent Writes / Card Not Found
```
GIVEN: Card is deleted by User B while User A's modal is open
WHEN:  User A submits an update
THEN:  Returns { error: "Card not found" } (no 500 error)

GIVEN: Attacker submits a reorder payload containing card IDs from another org
WHEN:  dal.cards.reorder() processes the payload
THEN:  Cross-org IDs are rejected before any UPDATE runs
AND:   Only valid IDs belonging to ctx.orgId are accepted

GIVEN: Card belongs to Board in Org A
WHEN:  User from Org B tries to read it via dal.cards.findUnique()
THEN:  Returns null (org boundary enforced via where: { orgId: ctx.orgId })
```

### 5.4 Cross-List Move
```
GIVEN: Card is moved to a different list
WHEN:  dal.cards.reorder() runs
THEN:  CARD_MOVED automation event is fired ONCE

GIVEN: Card is reordered within the same list (no list change)
WHEN:  dal.cards.reorder() runs
THEN:  CARD_MOVED automation event is NOT fired
```

---

## SECTION 6 — COMMENTS & REACTIONS TESTS

### 6.1 Comments
```
GIVEN: createComment() called with valid parentId belonging to same card
THEN:  Nested comment created successfully

GIVEN: createComment() called with parentId from a different card
THEN:  Returns error (orphan nesting rejected)

GIVEN: createComment() on a card belonging to different org
THEN:  Returns FORBIDDEN (CardNotInOrg guard)
```

### 6.2 Reactions
```
GIVEN: addReaction() called with valid single emoji "👍"
THEN:  Reaction created successfully

GIVEN: addReaction() called with text "thumbsup"
THEN:  Emoji validation fails (regex /^[\u{1F300}-\u{1F9FF}]$/u rejects it)

GIVEN: addReaction() called with "👍👎" (two emojis)
THEN:  Validation fails (multi-character rejected)

GIVEN: Same user reacts with same emoji on same comment twice
THEN:  Second call returns { error: "Already reacted" } (DB unique constraint)
AND:   Reaction count is NOT incremented twice
```

---

## SECTION 7 — AUTOMATION ENGINE TESTS

```
GIVEN: Automation is triggered at depth 0
THEN:  Action executes normally

GIVEN: Automation chain reaches depth 3 (max)
WHEN:  Automation would fire again
THEN:  Execution halts (no action performed, no error thrown)
AND:   Depth guard MAX_DEPTH = 3 is respected

GIVEN: Trigger type "INVALID_TRIGGER" is fired
THEN:  Silently ignored (no error, no action)

GIVEN: Valid TriggerType values are: CARD_CREATED, CARD_MOVED, CARD_DELETED,
       CARD_DUE_SOON, CARD_OVERDUE, LABEL_ADDED, CHECKLIST_COMPLETED,
       MEMBER_ASSIGNED, PRIORITY_CHANGED, CARD_TITLE_CONTAINS
THEN:  All 10 triggers execute their mapped actions

GIVEN: Two concurrent MOVE_CARD automations target the same list
WHEN:  Both read last card order simultaneously
THEN:  DB transaction ensures only one unique order value is written
AND:   No duplicate newOrder values exist in the list
```

For each valid TriggerType, generate one happy-path test and one edge case (e.g. missing card, org mismatch, missing action config).

---

## SECTION 8 — AI QUOTA TESTS

```
GIVEN: Org has aiCallsToday = 49, AI_DAILY_LIMIT = 50
WHEN:  AI action is called
THEN:  Action succeeds (49 → 50)

GIVEN: Org has aiCallsToday = 50 (at limit)
WHEN:  AI action is called
THEN:  Returns { error: "AI limit reached (50/day). Resets at midnight." }

GIVEN: OPENAI_API_KEY is not set
WHEN:  getOpenAI() is called
THEN:  Throws descriptive error
AND:   Build does NOT crash (lazy initialization)

GIVEN: One heavy user in org exhausts 50 daily calls
WHEN:  Different user in same org calls an AI action
THEN:  Returns quota exhausted error (org-level counter, not user-level)

GIVEN: Daily cron job runs (reset-ai-limits)
WHEN:  aiCallsToday reset to 0 on all orgs
THEN:  AI actions succeed again
AND:   Running cron twice is idempotent (safe to double-run)
```

---

## SECTION 9 — SEARCH TESTS

```
GIVEN: Search query is empty string ""
WHEN:  search() is called
THEN:  Returns [] immediately (no DB call)

GIVEN: Search query is valid text "bug"
THEN:  Returns cards matching title containing "bug"
AND:   Only cards within ctx.orgId are returned

GIVEN: page = 0 (invalid)
WHEN:  Search is called
THEN:  Clamped to page = 1 (Math.max(1, page))

GIVEN: limit = 0 (invalid)
THEN:  Clamped to limit = 1

GIVEN: limit = 200 (above max)
THEN:  Clamped to limit = 50 (Math.min(50, limit))

GIVEN: User from Org B searches for cards
THEN:  Cards from Org A are NEVER returned (where: { orgId: ctx.orgId })
```

---

## SECTION 10 — IMPORT / EXPORT TESTS

```
GIVEN: Import called with format = "nexus" and valid JSON
THEN:  Board created with all lists and cards

GIVEN: Import called with format = "trello" and valid JSON
THEN:  Board created from Trello format

GIVEN: Import called with format = "jira" and valid XML
THEN:  Board created from Jira format

GIVEN: Import called with format = "csv" (unsupported)
THEN:  HTTP 422 returned (Zod schema rejects unknown format)

GIVEN: Import called with format = "nexus" but body is invalid JSON
THEN:  Returns descriptive parse error

GIVEN: Import called with format = "jira" but body is not valid XML
THEN:  Returns descriptive error

GIVEN: Export is triggered for Org A
THEN:  Exported JSON contains ONLY data belonging to Org A
AND:   No data from Org B appears in output
```

---

## SECTION 11 — STRIPE & BILLING TESTS

### 11.1 Checkout Flow
```
GIVEN: User clicks "Upgrade to Pro" (Monthly)
WHEN:  POST /api/stripe/checkout is called
THEN:  Redirects to Stripe Checkout URL

GIVEN: Stripe returns ?success=1 after payment
THEN:  Plan is set to PRO in DB
AND:   board/card limits reflect PRO (Infinity)
```

### 11.2 Stripe Webhook Events
```
GIVEN: checkout.session.completed event arrives
THEN:  org.plan set to PRO

GIVEN: invoice.payment_succeeded event arrives
THEN:  subscription period_end updated

GIVEN: invoice.payment_failed event arrives
THEN:  org status set to past_due

GIVEN: customer.subscription.updated event arrives
THEN:  Status synced from Stripe payload

GIVEN: customer.subscription.deleted event arrives
THEN:  org.plan reset to FREE

GIVEN: Unknown Stripe event type arrives (e.g. "beta.test")
THEN:  Silently ignored (no error, no action)

GIVEN: Stripe webhook arrives with invalid signature
WHEN:  stripe.webhooks.constructEvent() is called
THEN:  Throws → HTTP 400 returned

GIVEN: Stripe subscription with unknown plan key
WHEN:  Webhook handler processes it
THEN:  Fail-closed: plan NOT upgraded, error logged (no crash)

GIVEN: STRIPE_SECRET_KEY is not set
WHEN:  Billing page renders
THEN:  "Billing not configured" UI shown (no crash, no 500)
```

---

## SECTION 12 — API KEY (REST API) TESTS

```
GIVEN: API request with key not starting with "nxk_"
THEN:  HTTP 401 returned

GIVEN: API key with prefix "nxk_" but key is revoked (revokedAt is not null)
THEN:  HTTP 401 returned

GIVEN: Valid API key with scope "boards:read" accesses GET /api/v1/boards
THEN:  HTTP 200, returns org boards

GIVEN: Valid API key with scope "boards:read" attempts POST /api/v1/boards
THEN:  HTTP 403 (scope mismatch)

GIVEN: Valid API key belongs to Org A
WHEN:  GET /api/v1/boards is called
THEN:  Only boards belonging to Org A are returned (tenant-scoped)

GIVEN: Stored key hash is SHA-256 of the raw key
THEN:  Raw key is never stored in DB
AND:   Only keyPrefix (first 8 chars) stored in plaintext
```

---

## SECTION 13 — WEBHOOK (OUTBOUND) TESTS

```
GIVEN: Webhook target URL resolves to 192.168.1.1 (RFC-1918 private)
WHEN:  Outbound webhook is dispatched
THEN:  Returns { error: "SSRF: private address blocked" }

GIVEN: Webhook target URL resolves to 10.0.0.1 (RFC-1918)
THEN:  Blocked (10.0.0.0/8 range)

GIVEN: Webhook target URL resolves to 172.16.0.0 (RFC-1918)
THEN:  Blocked (172.16.0.0/12 range)

GIVEN: Webhook target URL resolves to 127.0.0.1 (loopback)
THEN:  Blocked

GIVEN: Webhook target URL resolves to valid public IP
THEN:  Delivery proceeds

GIVEN: Webhook is delivered successfully
THEN:  X-Nexus-Signature-256 header is present
AND:   Value is "sha256=" + HMAC(webhookSecret, payload)
AND:   Signature can be verified independently
```

---

## SECTION 14 — EXTERNAL SERVICE FAILURE TESTS

For each service, test graceful degradation:

```
VAPID:
  GIVEN: VAPID_PUBLIC_KEY not set
  WHEN:  Push subscription endpoint is called
  THEN:  HTTP 503 "Push notifications not configured" (no build crash)

OpenAI:
  GIVEN: OPENAI_API_KEY not set
  WHEN:  Any AI action is invoked
  THEN:  Returns { error: "AI not configured" } (no crash)

Unsplash:
  GIVEN: UNSPLASH_ACCESS_KEY not set
  WHEN:  Board background picker loads
  THEN:  Returns { photos: [], unconfigured: true } with HTTP 200
  AND:   UI renders fallback color options

Resend:
  GIVEN: RESEND_API_KEY not set
  WHEN:  Email is triggered (e.g. digest email)
  THEN:  Fails silently (logged to Sentry, no user-visible crash)

Sentry:
  GIVEN: SENTRY_DSN not set
  THEN:  App initializes normally (Sentry init is a no-op)
```

---

## SECTION 15 — CRON JOB TESTS

```
GIVEN: /api/cron/* is called without Authorization header
THEN:  HTTP 401

GIVEN: /api/cron/* is called with wrong CRON_SECRET
THEN:  HTTP 401

GIVEN: /api/cron/reset-ai-limits runs
THEN:  aiCallsToday = 0 for ALL orgs

GIVEN: /api/cron/reset-ai-limits runs TWICE
THEN:  aiCallsToday still = 0 (idempotent)

GIVEN: /api/cron/due-dates runs
WHEN:  Card is due within 24h and not yet notified
THEN:  CARD_DUE_SOON automation event fired
AND:   notifiedAt is set (won't re-notify on next run)

GIVEN: Card is past due and already has notifiedAt set
WHEN:  Cron runs again
THEN:  Notification NOT re-sent

GIVEN: Sprint's end date has passed
WHEN:  Sprint auto-close cron runs
THEN:  Sprint status set to COMPLETED
AND:   Cards are NOT deleted
```

---

## SECTION 16 — REAL-TIME PRESENCE TESTS

```
GIVEN: User opens /board/[boardId]
THEN:  User joins Supabase Realtime channel for that boardId
AND:   User's avatar appears in board header

GIVEN: User A and User B both have board open
WHEN:  User A updates a card
THEN:  User B sees the update without page refresh (optimistic UI reconcile)

GIVEN: Realtime socket drops unexpectedly
THEN:  ErrorBoundaryRealtime catches the error
AND:   Reconnect banner is shown (board does not crash)

GIVEN: User disconnects from board (closes tab)
THEN:  Supabase heartbeat timeout removes them from presence
AND:   Their avatar disappears from board header

GIVEN: User A opens a card while User B also has it open
THEN:  "User A is editing" badge shown to User B (cosmetic only)
AND:   No server-side lock exists (last write wins — verify both writes succeed)
```

---

## SECTION 17 — E2E PLAYWRIGHT FLOWS

Generate Playwright tests for these complete user journeys:

### Flow 1: New User Onboarding
```
1. Navigate to /  → click Sign Up
2. Complete Clerk sign-up
3. Create org → /select-org
4. Redirected to /onboarding
5. Complete 4-step wizard (name board, read tips)
6. Click "Open My Board" → assert URL = /board/[boardId]
7. Assert board is visible with 0 lists
```

### Flow 2: Full Board Workflow
```
1. Sign in → /dashboard
2. Create board "My Test Board" → assert card appears in grid
3. Open board → create 3 lists: "Todo", "In Progress", "Done"
4. Create card "Task 1" in "Todo"
5. Drag card to "In Progress" → assert list change persists after refresh
6. Open card modal → set priority HIGH, due date +7 days, assign self
7. Add comment "Looking good"
8. Check filter bar: filter by assignee (self) → assert only Task 1 visible
9. Clear filters → all cards visible
```

### Flow 3: FREE Plan Limit Enforcement
```
1. Sign in as FREE org with 50 boards
2. Attempt to create 51st board
3. Assert ProUpgradeModal appears
4. Assert no new board was created in DB
```

### Flow 4: Billing Upgrade Flow
```
1. Sign in on FREE plan → /billing
2. Click "Upgrade to Pro" (Monthly - £9/mo)
3. Assert redirect to Stripe Checkout
4. (Use Stripe test card 4242424242424242)
5. Complete payment → redirect back with ?success=1
6. Assert plan = PRO in UI
7. Assert board limit now shows unlimited
```

### Flow 5: Automation Rule
```
1. /settings/automations → Create rule
2. Trigger: CARD_CREATED → Action: SET_PRIORITY HIGH
3. Save rule
4. Navigate to board → create card "New Card"
5. Assert card priority is automatically set to HIGH
```

### Flow 6: Command Palette Navigation
```
1. Press Ctrl+K on any page
2. Type "My Test Board"
3. Assert board result appears
4. Click result → assert navigation to /board/[boardId]
5. Press Ctrl+K again → type card name
6. Click card → assert Card Modal opens
```

### Flow 7: Demo Mode (Read-Only)
```
1. Navigate to /organization/demo-org-id/dashboard
2. Assert read-only banner is visible
3. Attempt to create a board → assert error "Cannot modify demo data"
4. Attempt to drag a card → assert drag is blocked or reverted
5. Assert no mutation was made to DB
```

### Flow 8: Shared (Public) Board
```
1. Open board settings → copy share link (/shared/[token])
2. Open link in incognito (no auth)
3. Assert board is visible in read-only Kanban view
4. Assert no create/edit controls are visible
```

### Flow 9: Import / Export
```
1. Board Settings → Export → Download as JSON
2. Assert JSON contains all lists and cards
3. Navigate to /api/import → upload the JSON (format: nexus)
4. Assert new board created with identical structure
```

### Flow 10: Sprint Workflow
```
1. Open board → Sprint tab
2. Create sprint "Sprint 1" with start/end dates
3. Add 3 cards to sprint
4. Start sprint → assert status = ACTIVE
5. Complete sprint → assert incomplete cards return to backlog
6. Assert sprint status = COMPLETED
```

---

## SECTION 18 — SECURITY & INJECTION TESTS

```
GIVEN: Attacker submits reorder payload with card IDs from Org B
THEN:  All foreign IDs rejected before any UPDATE executes
AND:   No cross-org data modified

GIVEN: orgId is passed in request body by attacker
THEN:  orgId is ignored — always taken from signed Clerk JWT
AND:   DB query always uses JWT-derived orgId

GIVEN: API response for any error
THEN:  Raw Prisma error messages are NOT present in response
AND:   Stack traces are NOT present in response
AND:   Internal IDs (DB row UUIDs) are NOT leaked in error messages

GIVEN: API request with SQL injection in card title: "'; DROP TABLE cards; --"
THEN:  Prisma parameterizes the query; no SQL execution occurs
AND:   Card is created with literal title string

GIVEN: XSS payload in card description: "<script>alert('xss')</script>"
THEN:  TipTap sanitizes output; script tag not rendered in DOM
```

---

## SECTION 19 — LEXORANK EDGE CASES (Unit Tests)

```
TEST: Initial order
  generateMidpointOrder(null, null) → "m"

TEST: Insert at end
  generateNextOrder("m") → "n" (or next char)
  generateNextOrder("z") → "za"
  generateNextOrder("zz") → "zza"

TEST: Insert between two adjacent chars
  generateMidpointOrder("m", "n") → "ma"

TEST: String length cap
  Given 32-char string, incrementOrder returns fallback rank
  Fallback starts with "\uFFFF"
  Fallback always sorts after any normal rank

TEST: Rebalance
  Given list with orders ["maaa", "maaaa", "maaaaa"]
  rebalanceOrders() returns ["m", "n", "o"] (compacted)
```

---

## GENERATION INSTRUCTIONS FOR COPILOT

1. **File per section:** Create one test file per major section (e.g. `__tests__/unit/rate-limiting/rate-limit.test.ts`).
2. **Describe/it blocks:** Use `describe('Section Name', () => { it('should ...', ...) })` format.
3. **Mocking:** Mock Prisma using `jest-mock-extended`. Mock Clerk auth via `@clerk/nextjs/testing`. Use `stripe-mock` or manual mocks for Stripe.
4. **Assertions:** Use `expect(...).toBe()`, `expect(...).toHaveBeenCalledTimes(n)`, `expect(...).toMatchObject({})`.
5. **E2E:** Use Playwright's `page.goto()`, `page.click()`, `page.fill()`, `expect(page).toHaveURL()`.
6. **No flakiness:** All timers via `jest.useFakeTimers()`. All async operations properly awaited. No `setTimeout` in test bodies.
7. **Coverage target:** Aim for >85% branch coverage on all server actions and API routes.
8. **Test naming convention:** `it('should [expected behavior] when [condition]', ...)`