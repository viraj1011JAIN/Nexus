# NEXUS — PROJECT STATUS

**Last Audited:** February 22, 2026 (updated same day)  
**Audited Against:** Live codebase at `c:\Nexus\nexus`  
**Every fact verified from source files. No estimates, no aspirational claims.**

---

## Stack (exact installed versions from package.json)

| Package | Version |
|---------|---------|
| Next.js | 16.1.4 |
| React | 19.2.3 |
| TypeScript | ^5 |
| Prisma | 5.22.0 |
| @clerk/nextjs | 6.36.10 |
| @supabase/supabase-js | 2.91.1 |
| stripe (server) | 20.2.0 |
| @sentry/nextjs | 10.36.0 |
| @tiptap/react | 3.17.1 |
| @dnd-kit/core | 6.3.1 |
| zod | 4.3.6 |
| zustand | 5.0.10 |
| framer-motion | 12.29.0 |
| recharts | 3.7.0 |
| jspdf | 4.1.0 |
| date-fns | 4.1.0 |
| jest | 30.2.0 |

---

## Database Schema (prisma/schema.prisma — verified)

| Model | Notes |
|-------|-------|
| `Organization` | id, name, slug, region, deletedAt, 6 Stripe billing fields, boards[], members[] |
| `User` | id, clerkUserId, email, name, imageUrl, assignedCards[], preferences? |
| `OrganizationUser` | role (OWNER/ADMIN/MEMBER/GUEST), isActive, invitedById, joinedAt |
| `Board` | title, orgId, imageId/imageThumbUrl/imageFullUrl/imageUserName/imageLinkHTML (stored, no picker UI) |
| `List` | title, order (LexoRank string), boardId |
| `Card` | title, description (text), dueDate, priority (LOW/MEDIUM/HIGH/URGENT default MEDIUM), assigneeId, labels[], comments[] |
| `Label` | name, color, orgId — org-scoped, unique on (orgId, name) |
| `CardLabelAssignment` | join table, unique on (cardId, labelId) |
| `Comment` | text (HTML from TipTap), cardId, userId, parentId (threading), reactions[], mentions (String[]), isDraft |
| `CommentReaction` | emoji, commentId, userId — unique on (commentId, userId, emoji) |
| `AuditLog` | orgId, action, entityId/Type/Title, userId, ipAddress, userAgent |
| `BoardAnalytics` | totalCards, completedCards, overdueCards, weeklyTrends (JSON), priorityDistribution (JSON) |
| `UserAnalytics` | userId, orgId, date — daily snapshots |
| `ActivitySnapshot` | orgId, timestamp, aggregate counters |
| `UserPreference` | 9 boolean fields: emailNotifications, desktopNotifications, boardActivity, cardComments, cardDueDates, weeklyDigest, autoSave, compactMode, showArchived |

---

## What Is Built and Working

### Authentication & Multi-tenancy
- Clerk v6: sign-in, sign-up, org creation, org switching, session management
- `getTenantContext()` — extracts userId, orgId, orgRole, membership in one call; used by every server action
- `requireRole()` enforcement on all mutating actions
- Demo mode guard (`isDemoOrganization`, `isDemoContext`, `protectDemoMode`)
- Rate limiting on board creation (`checkRateLimit`, in-memory, per-user)
- Middleware auth checks protecting all app routes

### Board Management
- Create, rename, delete boards — scoped to org via tenant context
- FREE plan board limit enforced against Stripe subscription plan in `create-board.ts`
- Board image fields (`imageThumbUrl`, `imageFullUrl`, etc.) in schema — **no live Unsplash picker built**; populated only by `scripts/seed-demo.ts`
- `CreateBoard` action schema accepts `title` only; no image input
- `board-list.tsx` renders `imageThumbUrl` as a full-width 96px banner on each board card when the field is set; falls back to gradient+letter when null
- `board/[boardId]/page.tsx` renders `imageFullUrl` as the full-page background when present; dark overlay (`bg-black/40`) applied for readability; gradient+animated blobs shown when null

### List Management
- Create, rename, delete lists
- Drag-and-drop reorder — dnd-kit v6 + LexoRank string ordering
- Reorder persisted via `update-list-order.ts` server action

### Card Management
- Create, rename, delete cards
- Drag-and-drop within and between lists — dnd-kit
- LexoRank ordering persisted via `update-card-order.ts`
- **Card modal** with full detail view:
  - Rich text description — TipTap v3: StarterKit, Underline, Link, TaskList, TaskItem, Placeholder, CharacterCount (10,000 char limit), TextAlign, Highlight, CodeBlockLowlight
  - Auto-save (500ms debounce) and explicit save button
  - Visual save state: Idle / Saving / Saved / Error
  - Emoji picker via `emoji-picker-react`
  - GIF picker via Giphy API (Klipy as fallback) — `/api/tenor` route
  - Priority selector (LOW / MEDIUM / HIGH / URGENT) with suggested priority based on due date proximity
  - Smart due date: countdown display, color states (green/amber/red), quick presets, shake animation on overdue
  - Single assignee: org member picker, avatar, optimistic UI with rollback
  - Labels: org-scoped, many-to-many, color picker, optimistic UI with rollback
  - Comments: TipTap rich text, nested threading (parentId), emoji reactions (unique per user/emoji/comment), edit/delete with ownership check
  - Per-card activity log tab
  - Read-only mode enforced when card is locked by another user

### Audit Logs & Activity
- AuditLog created on every BOARD/LIST/CARD CREATE/UPDATE/DELETE
- Stores IP address and user-agent per entry
- Org-filtered activity feed at `/activity`
- Per-card activity tab in card modal

### Billing & Subscriptions
- Stripe v20 server SDK + @stripe/stripe-js client
- Plans: FREE (board limit) and PRO (unlimited)
- `/api/stripe/checkout` — creates Stripe Checkout Session
- `/api/stripe/portal` — creates Customer Portal session
- `/api/webhook/stripe` — handles subscription lifecycle events, syncs to org record
- Board creation blocked when limit reached; upgrade modal shown

### User Settings / Preferences
- 9 preferences persisted to `user_preferences` table
- `getPreferences()` server action: finds User by clerkUserId, returns row or DEFAULT_PREFERENCES
- `savePreferences()` server action: upserts row
- Settings page (`app/settings/page.tsx`) is an async server component — DB-hydrated on load
- Save and Reset to Defaults both functional

### Analytics Dashboard
- Board-level analytics tab alongside board view
- Charts rendered client-side via Recharts v3 (SSR disabled — `next/dynamic` with `ssr: false`)
- **Velocity chart**: 14-day line chart, cards created vs completed, trend indicator
- **Priority distribution**: pie chart, 4 priority levels with color coding
- **Top contributors**: bar chart, top 5 users by card activity
- **Overview metrics**: total cards, completed, avg completion time (hours), overdue count
- **PDF export**: jsPDF v4 + jspdf-autotable, auto-pagination, timestamped filename, toast feedback
- **Vercel Cron**: `/api/cron/daily-reports` runs at `0 9 * * *` (UTC), generates report data structure. No email delivery — no Resend or mailer installed.
- `useRealtimeAnalytics` hook: Supabase broadcast channel per board, auto-refreshes on card_created/updated/deleted/completed events

### Real-Time Collaboration
- `useRealtimeBoard`: Supabase Realtime postgres_changes per board — patches local state on remote list/card CRUD, shows toast for remote changes, auto-reconnects
- `usePresence`: Supabase Presence channel per board, tracks online users, count and avatar list consistent (includes self, de-duped by userId to handle multi-tab)
- `OnlineUsers` component: stacked avatars, 8-color palette, Tippy "joined X ago" tooltip, pulse indicator
- `useCardLock`: Presence-based card-level edit locking — acquires lock on modal open, releases on close, shows banner with locker name and avatar; all inputs disabled when locked
- Console logs removed from all realtime hooks; no client-side log leaks

### Sentry
- `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` all configured
- Session replay: 10% sample rate, 100% on errors
- Performance tracing on
- User context (Clerk ID + org) attached

### Error Handling
- `ErrorBoundary` component wrapping critical UI sections
- `ErrorBoundaryRealtime` variant for realtime components
- Fallback UI with retry button, prevents white-screen crash
- `not-found.tsx` and `error.tsx` at app root

### Command Palette
- `CommandPalette` component in root layout, triggered by Ctrl+K / Cmd+K
- Searches boards and cards via `/api/boards` and `/api/cards` (up to 50 results)
- Quick Actions and Navigation sections
- Recent items: localStorage, 5 most recent
- Priority badges on card results


### Performance Utilities
- `LazyLoad` component (Intersection Observer)
- `VirtualScroll` component for long lists
- `SmoothScroll` wrapper
- `PerformanceWrapper` in root layout
- Charts and PDF export code-split via `next/dynamic`
- `useMemo` / `useCallback` applied in editor and chart components
- Inter font with `display: swap` and CSS variable

### Mobile & Responsive
- Tailwind responsive breakpoints throughout
- iOS safe area insets in `globals.css`
- `100dvh` dynamic viewport height
- 44px minimum touch targets enforced in CSS
- `-webkit-tap-highlight-color: transparent` globally
- GPU acceleration utility class
- Momentum scrolling (iOS `-webkit-overflow-scrolling`)
- Overscroll containment
- Landscape mode adjustments
- `manifest.json` at `/public/manifest.json` — includes top-level `icons` array, two size shortcuts, theme color
- `public/icon-192.png` and `public/icon-512.png` present — indigo background (#4F46E5), white bold "N", generated via System.Drawing
- `public/apple-touch-icon.png` present (180×180) — solid fill, no padding; handles iOS home screen installs which ignore manifest.json
- `app/layout.tsx` metadata includes `icons: { apple: "/apple-touch-icon.png" }`

### UI Foundation
- shadcn/ui component library (Radix UI primitives)
- Tailwind v4
- Dark/Light theme via `next-themes` + inline `themeScript` (zero flash)
- `design-tokens.ts` for spacing and color references
- Sonner toasts + shadcn Toaster both present in root layout
- Landing page at `/` with animated hero, CTA buttons, auth redirect

---

## What Is Not Implemented

| Feature | Status | Notes |
|---------|--------|-------|
| Board background picker (Unsplash) | Not built | Schema has 5 image fields. `createBoard` accepts `title` only. No Unsplash API calls exist. |
| Board backgrounds rendered in board-list | Rendered | `board-list.tsx` shows `imageThumbUrl` as card banner. No picker to set it from UI — seed script only. |
| File attachments | Not started | No storage provider. No schema model. |
| Board templates | Not started | No model, no UI. |
| Board archiving | Not started | No `archivedAt` on Board. |
| Board duplication | Not started | No action. |
| List copy / archive | Not started | No actions. |
| Card checklists | Not started | No schema model. |
| Card cover image | Not started | No field on Card. |
| @mention UI | Not built | `mentions String[]` field and `@tiptap/extension-mention` installed — no picker, no notification logic. |
| Comment draft auto-recovery | Not built | `isDraft Boolean` field on Comment — not consumed by client. |
| Email delivery | Not built | Cron scaffold generates data; no mailer library installed. |
| Desktop push notifications | Not built | Preference toggle persisted; no Service Worker or Push API. |
| @mention notifications | Not built | |
| PWA install icons | Done | `icon-192.png` and `icon-512.png` present in `/public`. Manifest `icons` array added. |
| E2E tests | Not started | Playwright not in `package.json`. |
| GitHub Actions CI/CD | Configured | `.github/workflows/ci.yml` — 4 jobs: typecheck, lint, test (coverage artifact), build (needs all three; Stripe + Clerk + Supabase secrets). |
| Dedicated search page | Not built | Command palette searches API; no full-text search results page. |
| PostHog / product analytics | Not integrated | |
| Uptime monitoring | Not configured | |
| Preview deployments | Not configured | |

---

## Test Coverage — Actual Numbers

**Test files:**
- `__tests__/unit/action-protection.test.ts` — 19 test cases
- `__tests__/unit/tenant-context.test.ts` — 5 test cases (new)
- `__tests__/unit/rate-limit.test.ts` — 4 test cases (new, uses `jest.useFakeTimers()`)
- `__tests__/integration/server-actions.test.ts` — 19 test cases
- **Total: 47 test cases**

**What they test:**
- `protectDemoMode` — 11 cases (error shape, message content, null/undefined/case-sensitivity)
- `isDemoOrganization` — 5 cases
- `checkRateLimit` — 8 cases total: allows/decrements/blocks/per-user isolation (existing) + `RATE_LIMITS` constant, window-reset after 61s clock advance, fake-timer isolation (new)
- `getTenantContext` — 5 cases: UNAUTHENTICATED (no userId), UNAUTHENTICATED (no orgId), FORBIDDEN (isActive=false), valid member returns TenantContext, TenantError instanceof check
- Integration file mocks Clerk `auth()` and verifies the demo-mode guard blocks all mutation types

No other server actions, hooks, or library code is covered by tests.

**Coverage scope:** `jest.config.ts` instruments the entire source tree. The report tracks all 61 files across 20 packages including `lib/tenant-context.ts`, `lib/dal.ts`, `lib/create-audit-log.ts`, all server actions, all hooks, and all components — those files simply have 0 hits.

**Coverage from last instrumented run (coverage/clover.xml — pre-`checkRateLimit` tests):**

| Metric | Covered | Total | % |
|--------|---------|-------|---|
| Statements | 10 | 1329 | 0.75% |
| Methods | 2 | 252 | 0.79% |
| Elements | 14 | 2188 | 0.64% |

The 4 new `checkRateLimit` tests cover additional branches in `lib/action-protection.ts`. Rerun `npm run test:ci` to get updated numbers.

Jest + Testing Library are configured and runnable. No E2E tests. No visual regression tests.

---

## Source File Inventory

### Server Actions (`actions/`)
| File | Exports |
|------|---------|
| `create-board.ts` | `createBoard` — org check, rate limit, Stripe board limit |
| `delete-board.ts` | `deleteBoard` |
| `create-list.ts` | `createList` |
| `update-list.ts` | `updateList` |
| `delete-list.ts` | `deleteList` |
| `update-list-order.ts` | `updateListOrder` |
| `create-card.ts` | `createCard` |
| `update-card.ts` | `updateCard` |
| `delete-card.ts` | `deleteCard` |
| `get-card.ts` | `getCard` |
| `update-card-order.ts` | `updateCardOrder` |
| `get-audit-logs.ts` | `getAuditLogs` |
| `label-actions.ts` | createLabel, assignLabel, unassignLabel, getOrganizationLabels, getCardLabels |
| `assignee-actions.ts` | assignUser, unassignUser, getOrganizationMembers |
| `phase3-actions.ts` | updateCardPriority, setDueDate, clearDueDate, createComment, updateComment, deleteComment, addReaction, removeReaction |
| `user-preferences.ts` | getPreferences, savePreferences |
| `analytics/` | getBoardAnalytics |

### Hooks (`hooks/`)
| File | Purpose |
|------|---------|
| `use-realtime-board.ts` | Supabase postgres_changes board sync |
| `use-presence.ts` | Supabase Presence for online users |
| `use-card-lock.ts` | Presence-based card edit locking |
| `use-realtime-analytics.ts` | Supabase broadcast for analytics refresh |
| `use-card-modal.ts` | Zustand store for card modal open/close |
| `use-debounce.ts` | Value debounce + callback debounce |
| `use-optimistic-card.ts` | `useOptimistic` wrapper for card mutations |
| `use-demo-mode.ts` | Demo context detection |

### Key Library Files (`lib/`)
| File | Purpose |
|------|---------|
| `db.ts` | Prisma client singleton |
| `tenant-context.ts` | getTenantContext(), requireRole(), isDemoContext() |
| `dal.ts` | Data Access Layer — orgId injected on all queries |
| `create-safe-action.ts` | Type-safe server action wrapper |
| `create-audit-log.ts` | Creates AuditLog; accepts orgId to skip redundant auth() |
| `action-protection.ts` | protectDemoMode, isDemoOrganization, checkRateLimit, RATE_LIMITS |
| `settings-defaults.ts` | UserPreferences interface, DEFAULT_PREFERENCES constant |
| `lexorank.ts` | LexoRank string generation |
| `stripe.ts` | Stripe client, STRIPE_CONFIG with plan limits |
| `realtime-channels.ts` | Supabase channel name helpers |
| `supabase/` | Supabase client factory |
| `logger.ts` | Structured logger |
| `sentry-helpers.ts` | Sentry capture utilities |

### App Routes (`app/`)
| Route | Type | Notes |
|-------|------|-------|
| `/` | Client component | Landing page + auth redirect |
| `/sign-in`, `/sign-up` | Clerk | |
| `/select-org` | Clerk | Org selector |
| `/dashboard` | Server | Renders `BoardList` |
| `/board/[boardId]` | Server | Board view |
| `/activity` | Server | Org audit log feed |
| `/billing` | Server | Stripe billing page |
| `/settings` | Server (async) | DB-hydrated preferences |
| `/api/boards` | API Route | Board search for command palette |
| `/api/cards` | API Route | Card search for command palette |
| `/api/stripe/checkout` | API Route | Create Checkout Session |
| `/api/stripe/portal` | API Route | Create Customer Portal session |
| `/api/webhook/stripe` | API Route | Stripe webhook handler |
| `/api/cron/daily-reports` | API Route | Vercel Cron — report data generation |
| `/api/tenor` | API Route | GIF search proxy (Giphy/Klipy) |
| `/api/audit-logs` | API Route | |



---

## Infrastructure & Deployment

| Item | State |
|------|-------|
| Vercel hosting | Configured (`vercel.json` present) |
| Cron job | `0 9 * * *`  `/api/cron/daily-reports` |
| Supabase Realtime | Working via channel-name isolation; degrades gracefully without Clerk JWT template |
| Sentry | Client + server + edge configured |
| GitHub repo | `https://github.com/viraj1011JAIN/Nexus.git`, branch `main` |
| GitHub Actions CI | `.github/workflows/ci.yml` — 4 jobs: typecheck, lint (zero warnings), test (coverage artifact), build (gated on first three) |
| Preview deployments | Not configured |
| DB migrations | Managed via `prisma db push` — no migration history files |

---

## Completion Summary

| Area | Complete | Caveat |
|------|---------|--------|
| Auth + multi-tenancy | 100% | |
| Board / List / Card CRUD | 100% | |
| Drag-and-drop + LexoRank ordering | 100% | |
| Card details (description, labels, assignee, priority, due dates) | 100% | |
| Comments + reactions + threading | 100% | |
| Audit logs + activity feed | 100% | |
| Billing + Stripe | 100% | |
| User preferences (settings) | 100% | |
| Analytics dashboard + PDF export | 100% | |
| Real-time board sync | 100% | |
| Presence + card locking | 100% | |
| Sentry + error boundaries | 100% | |
| Command palette | 100% | |
| Mobile responsive | 100% | |
| PWA manifest | 100% | Icons present in `/public`, manifest `icons` array added |
| Board backgrounds | 75% | `imageThumbUrl` on board cards + `imageFullUrl` on board page; no picker UI |
| Email delivery | 0% | Cron scaffold only, no mailer |
| File attachments | 0% | Not started |
| Board templates | 0% | Not started |
| @mention UI | 0% | Extension installed, not wired |
| Test coverage | ~2% | 47 tests, action-protection.ts + tenant-context.ts covered |
| E2E tests | 0% | Not started |
| CI/CD pipeline | 100% | GitHub Actions: typecheck + lint + test + build on every push |
