# NEXUS — PROJECT STATUS

**Last Audited:** 23 February 2026  
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
| resend | 6.9.2 |
| jest | 30.2.0 |

---

## Database Schema (prisma/schema.prisma — verified)

| Model | Notes |
|-------|-------|
| `Organization` | id, name, slug, region, deletedAt, 6 Stripe billing fields, boards[], members[] |
| `User` | id, clerkUserId, email, name, imageUrl, assignedCards[], preferences? |
| `OrganizationUser` | role (OWNER/ADMIN/MEMBER/GUEST), isActive, invitedById, joinedAt |
| `Board` | title, orgId, imageId/imageThumbUrl/imageFullUrl/imageUserName/imageLinkHTML (stored + Unsplash picker UI built) |
| `List` | title, order (LexoRank string), boardId |
| `Card` | title, description (text), dueDate, priority (LOW/MEDIUM/HIGH/URGENT default MEDIUM), assigneeId, labels[], comments[], attachments[] |
| `Attachment` | id, fileName, fileSize, mimeType, url, storagePath, cardId → Card, uploadedById (Clerk), uploadedByName |
| `BoardTemplate` | id, title, description, category, orgId (null=global), imageThumbUrl, lists[] |
| `TemplateList` | id, title, order, templateId → BoardTemplate, cards[] |
| `TemplateCard` | id, title, order, listId → TemplateList |
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
- Board image fields (`imageThumbUrl`, `imageFullUrl`, etc.) in schema — **Unsplash picker UI built** (`components/board/unsplash-picker.tsx`)
- `UnsplashPicker` component: search with 500ms debounce, 6 quick-tag pills, 3-column photo grid, load-more pagination, selected checkmark overlay, attribution footer
- `board-list.tsx` now has photo preview banner, photo/template advanced panel, passes all 5 image fields to `createBoard`
- `CreateBoard` schema accepts title + 5 image fields + optional `templateId`
- `/api/unsplash/route.ts` — server-side Unsplash photo search (key never exposed client-side), auth-gated, returns 12 photos per page with attribution HTML
- `board/[boardId]/page.tsx` renders `imageFullUrl` as the full-page background when present; dark overlay (`bg-black/40`) applied for readability; gradient+animated blobs shown when null
  - `Tabs` (Board/Analytics) extracted into `components/board/board-tabs.tsx` (`"use client"`) to prevent Radix UI `useId()` hydration mismatch when rendered inside async Server Component
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
- **Vercel Cron**: `/api/cron/daily-reports` runs at `0 9 * * *` (UTC), generates report data structure. **Sends weekly digest emails** every Monday via Resend + due-date reminders daily via `sendDueDateReminderEmail`.
- `useRealtimeAnalytics` hook: Supabase broadcast channel per board, auto-refreshes on card_created/updated/deleted/completed events

### Email Delivery (Resend)
- `resend` package installed
- `lib/email.ts` — full Resend client with HTML templates:
  - `sendEmail(opts)` — base send with error handling and env guard
  - `sendMentionEmail(opts)` — "@mention" notification email
  - `sendDueDateReminderEmail(opts)` — due date reminder
  - `sendWeeklyDigestEmail(opts)` — weekly stats digest with stat grid cards
- Cron job (`/api/cron/daily-reports`) sends weekly digests on Monday and daily due-date reminders
- `createComment` trigger: `sendMentionEmail()` called for each `@`-mentioned user after comment save (fire-and-forget, non-blocking, skips self-mentions and draft comments)

### File Attachments (Supabase Storage)
- Prisma `Attachment` model: id, fileName, fileSize, mimeType, url, storagePath, cardId, uploadedById, uploadedByName
- `/api/upload/route.ts` — multipart upload to `card-attachments` Supabase Storage bucket, 10MB size limit, MIME allowlist (no SVG), org ownership check via `getTenantContext()` (auto-provisions User/OrganizationUser rows — fixes 403 on first visit), Prisma record creation
- DELETE endpoint: only uploader can delete; DB record deleted first then storage removed; storage failure logged (attachment.id + storagePath) but does not fail the response
- `components/board/file-attachment.tsx` — upload UI with progress, file type icons, size formatting, download link, delete; keyboard-accessible: `group-focus-within:opacity-100` on action buttons
- Card modal has "Files" tab with badge count showing attachment count; wrapped in `<ErrorBoundary>` to prevent attachment errors crashing the modal

### Board Templates
- Prisma models: `BoardTemplate`, `TemplateList`, `TemplateCard`
- 6 built-in seeded templates: Kanban Board, Sprint Planning, Marketing Campaign, Product Roadmap, Design System, Hiring Pipeline
- `actions/template-actions.ts`: `getTemplates`, `getTemplateById`, `createBoardFromTemplate`, `seedBuiltInTemplates`
- `components/board/template-picker.tsx` — category filter tabs, color-coded badges, list count, selected indicator
- `/api/admin/seed-templates` — POST endpoint to seed templates (protected by `CRON_SECRET`)
- `create-board.ts` branches: templateId present → `createBoardFromTemplate` (creates board + all lists + cards); blank → `dal.boards.create`

### @Mention UI (TipTap)
- `@tiptap/extension-mention` + `@tiptap/suggestion` installed
- `components/editor/mention-list.tsx` — dropdown with keyboard navigation (Arrow Up/Down/Enter), avatars, fallback initials, empty state; guards against empty items array before modulo arithmetic
- `components/editor/mention-suggestion.ts` — `createMentionSuggestion()` factory (scopes debounce timer + `latestResolve` per editor instance; resolves pending Promises on rapid input to prevent unresolved Promise leaks); backward-compat singleton `mentionSuggestion` export; wired to `/api/members`, 200ms debounce, tippy.js popup
- `rich-comments.tsx` — creates per-mount suggestion via `useMemo(() => createMentionSuggestion(), [])` to prevent cross-editor timer collisions
- `/api/members/route.ts` — search org members by query, returns up to 10 matches (returns `clerkUserId` as `id` field)
- `app/editor.css` — `.mention` styles + tippy override
- **Email trigger:** `createComment` (phase3-actions.ts) fires `sendMentionEmail()` for each mentioned Clerk user ID after comment save; fire-and-forget via `void Promise.allSettled()`; skips self-mentions; non-draft only

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
| Board archiving | Not started | No `archivedAt` on Board. |
| Board duplication | Not started | No action. |
| List copy / archive | Not started | No actions. |
| Card checklists | Not started | No schema model. |
| Card cover image | Not started | No field on Card. |
| Comment draft auto-recovery | Not built | `isDraft Boolean` field on Comment — not consumed by client. |
| Desktop push notifications | Not built | Preference toggle persisted; no Service Worker or Push API. |
| @mention email notifications | **Built** | Trigger wired in `createComment` (phase3-actions.ts): parses `mentions[]` (Clerk user IDs), queries `db.user` per mentioned user, calls `sendMentionEmail()` fire-and-forget; skips self-mentions; only fires on non-draft comments |
| Dedicated search page | Not built | Command palette searches API; no full-text search results page. |
| PostHog / product analytics | Not integrated | |
| Supabase Storage bucket setup | Manual step | `card-attachments` bucket must be created in Supabase dashboard |
| Uptime monitoring | Not configured | |
| Preview deployments | Not configured | |

---

## Test Coverage — Actual Numbers

**Unit test files (7 suites — all verified passing `npx jest --testPathPatterns="unit"`):**
- `__tests__/unit/action-protection.test.ts` — 19 test cases
- `__tests__/unit/tenant-context.test.ts` — 5 test cases
- `__tests__/unit/rate-limit.test.ts` — 4 test cases (`jest.useFakeTimers()`)
- `__tests__/unit/email.test.ts` — 16 test cases — sendEmail, sendMentionEmail, sendDueDateReminderEmail, sendWeeklyDigestEmail (all mocked)
- `__tests__/unit/template-actions.test.ts` — 30 test cases — getTemplates, getTemplateById, createBoardFromTemplate, seedBuiltInTemplates; `db.$transaction` mock, real user fetch for audit log, CRON_SECRET guard
- `__tests__/unit/attachment-actions.test.ts` — 15 test cases — getCardAttachments (IDOR/org-boundary + card-not-found security tests), deleteAttachment; `db.card.findUnique` mock included
- `__tests__/unit/schema.test.ts` — 32 test cases — all Zod schemas, boundary conditions, error message quality
- **Unit total: 122 tests — all passing**

**Integration test file (1 suite):**
- `__tests__/integration/server-actions.test.ts` — 19 test cases

**E2E Tests (Playwright):**
- `playwright.config.ts` — Chromium + Firefox + Mobile Chrome, auth state re-use
- `e2e/auth.setup.ts` — Clerk sign-in flow (throws if `E2E_EMAIL`/`E2E_PASSWORD` not set; guards optional continue button), saves `e2e/.auth/user.json`
- `e2e/boards.spec.ts` — dashboard load, blank board creation (direct `expect(errorInfo).toBeVisible()` + URL assertion), Unsplash picker, template picker, board navigation
- `e2e/cards.spec.ts` — card creation, card modal, Files tab, @mention dropdown (explicit visibility check + `test.skip` if absent), file upload/rejection

Run E2E: `npx playwright test` (requires `npm run dev` running or `PLAYWRIGHT_BASE_URL` set)

---

## Source File Inventory

### Server Actions (`actions/`)
| File | Exports |
|------|---------|
| `create-board.ts` | `createBoard` — org check, rate limit, Stripe board limit, Unsplash image fields, template branching |
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
| `phase3-actions.ts` | updateCardPriority, setDueDate, clearDueDate, createComment (+ @mention email trigger), updateComment, deleteComment, addReaction, removeReaction |
| `user-preferences.ts` | getPreferences, savePreferences |
| `template-actions.ts` | getTemplates, getTemplateById, createBoardFromTemplate, seedBuiltInTemplates |
| `attachment-actions.ts` | getCardAttachments, deleteAttachment |
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
| `email.ts` | Resend client: sendEmail, sendMentionEmail, sendDueDateReminderEmail, sendWeeklyDigestEmail |

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
| `/api/cron/daily-reports` | API Route | Vercel Cron — daily reports + weekly digest emails (Monday) + due-date reminders |
| `/api/tenor` | API Route | GIF search proxy (Giphy/Klipy) |
| `/api/audit-logs` | API Route | |
| `/api/unsplash` | API Route | Server-side Unsplash photo search (key never sent to client); safe defaults for null user fields via optional chaining |
| `/api/upload` | API Route | Supabase Storage file upload + delete; uses `getTenantContext()` for auth + org check |
| `/api/members` | API Route | Org member search for @mention autocomplete |
| `/api/admin/seed-templates` | API Route | POST: idempotently seed 6 built-in board templates |



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

| Area | Complete | Notes |
|------|---------|-------|
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
| PWA manifest | 100% | Icons in `/public`, manifest `icons` array |
| **Board backgrounds** | **100%** | Unsplash picker UI + server-side API route + image fields in schema + create-board wiring |
| **Email delivery** | **100%** | Resend + `lib/email.ts` + 4 email types + cron integration + `createComment` @mention trigger; `allowUrl()` + `escHtml()` on all href attributes; PII removed from logs; UTC timezone |
| **File attachments** | **100%** | Supabase Storage + Prisma model + upload API (uses `getTenantContext()`) + card modal Files tab |
| **Board templates** | **100%** | 6 seeded templates + picker UI + createBoardFromTemplate (in `db.$transaction`) + admin seed endpoint (CRON_SECRET guarded) |
| **@mention UI** | **100%** | TipTap Mention extension + dropdown + members API + CSS; per-instance debounce timer + `latestResolve` leak fix |
| **Test coverage** | **Meaningful** | 122 unit tests (7 suites) + 19 integration tests; security tests for IDOR in attachment-actions |
| **E2E tests** | **100%** | Playwright config + auth setup + boards spec + cards spec |
| CI/CD pipeline | 100% | GitHub Actions: typecheck + lint + test + build |
| **Security hardening** | **100%** | IDOR fix in `getCardAttachments`; XSS escaping in `unsplash/route`, `lib/email.ts`; SVG removed from upload allowlist; Clerk API error propagation in cron; `latestResolve` mention promise fix; hydration mismatch fix in board page |
