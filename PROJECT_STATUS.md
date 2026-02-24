# NEXUS — PROJECT STATUS

**Last Audited:** 24 February 2026  
**Audited Against:** Live codebase at `c:\Nexus\nexus`  
**Every fact verified from source files. No estimates, no aspirational claims.**

---

## Runtime Environment

| Item | Value |
|------|-------|
| Next.js | 16.1.4 (Turbopack dev, App Router) |
| Node.js | v22.20.0 |
| Database | PostgreSQL via Supabase (`aws-1-eu-west-2.pooler.supabase.com`) |
| Dev URL | `http://localhost:3000` |
| Git remote | `https://github.com/viraj1011JAIN/Nexus.git` · branch `main` |
| Prisma ORM | 5.22.0 (schema managed via `prisma db push` — no migration file history) |

---

## Dependency Versions (from `package.json`)

### Production Dependencies

| Package | Version |
|---------|---------|
| next | 16.1.4 |
| react / react-dom | 19.2.3 |
| typescript | ^5 |
| @prisma/client | ^5.22.0 |
| @clerk/nextjs | ^6.36.10 |
| @supabase/supabase-js | ^2.91.1 |
| @supabase/realtime-js | ^2.91.1 |
| stripe (server) | ^20.2.0 |
| @stripe/stripe-js | ^8.6.4 |
| @sentry/nextjs | ^10.36.0 |
| @tiptap/react | ^3.17.1 |
| @tiptap/starter-kit | ^3.17.1 |
| @tiptap/extension-mention | ^3.17.1 |
| @tiptap/extension-character-count | ^3.18.0 |
| @tiptap/extension-code-block-lowlight | ^3.18.0 |
| @tiptap/extension-highlight | ^3.18.0 |
| @tiptap/extension-image | ^3.18.0 |
| @tiptap/extension-link | ^3.18.0 |
| @tiptap/extension-placeholder | ^3.18.0 |
| @tiptap/extension-task-item / task-list | ^3.18.0 |
| @tiptap/extension-text-align | ^3.18.0 |
| @tiptap/extension-underline | ^3.18.0 |
| @tiptap/suggestion | ^3.17.1 |
| @dnd-kit/core | ^6.3.1 |
| @dnd-kit/sortable | ^10.0.0 |
| @dnd-kit/utilities | ^3.2.2 |
| zod | ^4.3.6 |
| zustand | ^5.0.10 |
| framer-motion | ^12.29.0 |
| recharts | ^3.7.0 |
| jspdf | ^4.1.0 |
| jspdf-autotable | ^5.0.7 |
| date-fns | ^4.1.0 |
| resend | ^6.9.2 |
| unsplash-js | ^7.0.20 |
| openai | ^4.104.0 |
| web-push | ^3.6.7 |
| emoji-picker-react | ^4.17.3 |
| lowlight | ^3.3.0 |
| lucide-react | ^0.563.0 |
| next-themes | ^0.4.6 |
| sonner | ^2.0.7 |
| cmdk | ^1.1.1 |
| @tippyjs/react | ^4.2.6 |
| tippy.js | ^6.3.7 |
| tailwind-merge | ^3.4.0 |
| clsx | ^2.1.1 |
| class-variance-authority | ^0.7.1 |
| radix-ui | ^1.4.3 |

### Dev Dependencies

| Package | Version |
|---------|---------|
| prisma | ^5.22.0 |
| jest | ^30.2.0 |
| jest-environment-jsdom | ^30.2.0 |
| jest-axe | ^10.0.0 |
| @testing-library/react | ^16.3.2 |
| @testing-library/user-event | ^14.6.1 |
| @testing-library/jest-dom | ^6.9.1 |
| @playwright/test | ^1.58.2 |
| ts-jest | ^29.4.6 |
| tsx | ^4.21.0 |
| typescript | ^5 |
| eslint | ^9 |
| tailwindcss | ^4 |

---

## Database Schema (`prisma/schema.prisma` — verified)

| Model | Key Fields |
|-------|-----------|
| `Organization` | id, name, slug, region, deletedAt, subscriptionPlan, stripeCustomerId, stripeSubscriptionId, stripePriceId, stripeCurrentPeriodEnd |
| `User` | id (UUID), clerkUserId, email, name, imageUrl, createdAt |
| `OrganizationUser` | userId→User, organizationId→Org, role (OWNER/ADMIN/MEMBER/GUEST), isActive, invitedById, joinedAt |
| `Board` | id, title, orgId→Org, imageId, imageThumbUrl, imageFullUrl, imageUserName, imageLinkHTML, createdAt, updatedAt |
| `List` | id, title, order (LexoRank string), boardId→Board |
| `Card` | id, title, description (Text), dueDate, priority (LOW/MEDIUM/HIGH/URGENT, default MEDIUM), order, listId→List, assigneeId→User |
| `Label` | id, name, color (#hex), orgId→Org — unique on (orgId, name) |
| `CardLabelAssignment` | cardId→Card, labelId→Label — unique on (cardId, labelId) |
| `Comment` | id, text (HTML/TipTap), cardId→Card, userId (Clerk), parentId (threading), mentions (String[]), isDraft, reactions[] |
| `CommentReaction` | emoji, commentId→Comment, userId — unique on (commentId, userId, emoji) |
| `Attachment` | id, fileName, fileSize, mimeType, url, storagePath, cardId→Card, uploadedById (Clerk), uploadedByName |
| `AuditLog` | orgId, action (CREATE/UPDATE/DELETE), entityId, entityType (BOARD/LIST/CARD), entityTitle, userId, ipAddress, userAgent |
| `UserPreference` | userId→User, 9 boolean notification/UI fields |
| `BoardTemplate` | id, title, description, category, orgId (null = global), imageThumbUrl, lists[] |
| `TemplateList` | id, title, order, templateId→BoardTemplate, cards[] |
| `TemplateCard` | id, title, order, listId→TemplateList |
| `BoardAnalytics` | boardId→Board (1:1), totalCards, completedCards, overdueCards, weeklyTrends (JSON), priorityDistribution (JSON) |
| `UserAnalytics` | userId, orgId, date — daily activity snapshots |
| `ActivitySnapshot` | orgId, timestamp, aggregate counters |
| `Sprint` | boardId→Board, title, goal, startDate, endDate, status (ACTIVE/COMPLETED/PLANNING) |
| `Automation` | boardId→Board, trigger (JSON), actions (JSON), isActive |
| `CustomField` | boardId→Board, name, type (TEXT/NUMBER/DATE/SELECT/CHECKBOX), options (JSON) |
| `BoardShare` | boardId→Board, sharedWithOrgId, permission (VIEW/EDIT) |
| `Epic` | boardId→Board, title, description, status, startDate, endDate |
| `SavedView` | boardId→Board, name, filters (JSON), userId |

---

## Proxy / Middleware (`proxy.ts`)

Next.js 16 uses `proxy.ts` (not `middleware.ts`) as the edge request interceptor:

- **Layer 1 — Authentication:** if no Clerk session → redirect to `/sign-in?redirect_url=<original>`
- **Layer 2 — Org selection:** if signed in but no active org → redirect to `/select-org`
- **Layer 3 — Header injection:** sets `x-tenant-id`, `x-user-id`, `x-org-role` as trusted request headers for downstream Server Components and API routes
- Protected routes: everything except `/`, `/sign-in(.*)`, `/sign-up(.*)`, `/api/webhook/stripe(.*)`

> ⚠️ `middleware.ts` convention is deprecated in Next.js 16. `proxy.ts` is the correct file. A `middleware.ts` was briefly created on 24 Feb — it has been deleted. Only `proxy.ts` exists.

---

## What Is Built and Working

### Authentication & Multi-tenancy
- Clerk v6: sign-in, sign-up, org creation, org switching, session management
- `getTenantContext()` — extracts `userId`, `orgId`, `orgRole`, `membership` in one call; cached per request; used by every server action
- User row healing path: auto-provisions `User` + `OrganizationUser` DB rows on first access (no webhook dependency)
- `requireRole()` enforcement on all mutating actions
- Demo mode guard: `isDemoOrganization`, `isDemoContext`, `protectDemoMode`
- Rate limiting: in-memory per-user sliding window, `checkRateLimit()`, `RATE_LIMITS` map covering all mutation types
- `proxy.ts` edge middleware: auth + org redirect + tenant header injection

### Board Management
- Create, rename, delete boards — org-scoped via tenant context
- FREE plan board limit (50) enforced from Stripe subscription plan in `create-board.ts`; upgrade modal shown on limit
- Unsplash background picker: search with 500ms debounce, 6 quick-pick tag pills, 3-column photo grid, load-more pagination, selected checkmark overlay, attribution footer
- `/api/unsplash` — server-side only route, `accessKey` reads only `process.env.UNSPLASH_ACCESS_KEY` (no `NEXT_PUBLIC_` fallback — key never baked into client bundle); warns via `console.warn` if `NEXT_PUBLIC_` variant is set; validates photos with `allowUrl()`/`escHtml()` to prevent XSS in attribution HTML; returns `{ photos: [], unconfigured: true }` with HTTP 200 when key is not set
- Board cover image stored in 5 fields: `imageId`, `imageThumbUrl`, `imageFullUrl`, `imageUserName`, `imageLinkHTML`
- Board view renders `imageFullUrl` as full-page background with `bg-black/40` overlay; gradient + animated blobs when null
- `next.config.ts` has `remotePatterns` for `images.unsplash.com` and `plus.unsplash.com` — required for `next/image` to serve Unsplash URLs
- Board tabs (Board/Analytics) extracted to `components/board/board-tabs.tsx` (`"use client"`) to prevent Radix `useId()` hydration mismatch inside async Server Component

### List Management
- Create, rename, delete lists
- Drag-and-drop reorder — dnd-kit v6 + LexoRank string ordering
- Reorder persisted via `update-list-order.ts`

### Card Management
- Create, rename, delete cards
- Drag-and-drop within and between lists — dnd-kit; LexoRank ordering persisted via `update-card-order.ts`
- Card modal with full detail view:
  - Rich text description — TipTap v3 with StarterKit, Underline, Link, TaskList, TaskItem, Placeholder, CharacterCount (10,000 char limit), TextAlign, Highlight, CodeBlockLowlight
  - Auto-save (500ms debounce) + explicit save button; visual states: Idle / Saving / Saved / Error
  - Emoji picker via `emoji-picker-react`
  - GIF picker via Giphy/Klipy API — `/api/tenor/search` and `/api/tenor/featured` routes
  - Priority selector (LOW / MEDIUM / HIGH / URGENT) with suggested priority based on due date proximity
  - Smart due date: countdown display, color states (green/amber/red), quick presets (Today/Tomorrow/+7d/+14d), shake animation on overdue, `setDueDate`/`clearDueDate` actions
  - Single assignee: org member picker, avatar, optimistic UI with rollback
  - Labels: org-scoped, many-to-many, colour picker, optimistic UI with rollback
  - Comments: TipTap rich text, nested threading (parentId), emoji reactions (unique per user/emoji/comment), edit/delete with ownership check
  - Per-card activity log tab (audit log scoped to card entity)
  - Files tab: attachment list with upload progress, file type icons, size formatting, download link (`getCardAttachments`), delete
  - Read-only mode when card is locked by another user (`useCardLock`)
- `useOptimistic` for card mutations (instant UI, rollback on error)

### Audit Logs & Activity
- `AuditLog` created on every BOARD/LIST/CARD CREATE/UPDATE/DELETE
- Stores `ipAddress` and `userAgent` per entry
- Org-filtered activity feed at `/activity`
- Per-card activity tab in card modal

### Billing & Subscriptions
- Stripe v20 server SDK + @stripe/stripe-js client
- Plans: `FREE` (50 boards) and `PRO` (unlimited)
- `/api/stripe/checkout` — creates Checkout Session
- `/api/stripe/portal` — creates Customer Portal session
- `/api/webhook/stripe` — handles `customer.subscription.created/updated/deleted`, syncs `subscriptionPlan`, `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`, `stripeCurrentPeriodEnd` to `Organization`
- Board creation blocked when limit reached; `ProUpgradeModal` shown

### User Settings / Preferences
- 9 preferences persisted to `user_preferences` table: `emailNotifications`, `desktopNotifications`, `boardActivity`, `cardComments`, `cardDueDates`, `weeklyDigest`, `autoSave`, `compactMode`, `showArchived`
- `getPreferences()` finds User by `clerkUserId`, returns row or `DEFAULT_PREFERENCES`
- `savePreferences()` upserts row
- Settings page (`/settings`) is async Server Component — DB-hydrated on load; Save + Reset to Defaults functional

### Analytics Dashboard
- Board-level analytics tab alongside board view
- Charts rendered client-side via Recharts v3 (`next/dynamic` with `ssr: false`)
- **Velocity chart** — 14-day line chart, cards created vs completed, trend indicator
- **Priority distribution** — pie chart, 4 priority levels with colour coding
- **Top contributors** — bar chart, top 5 users by card activity
- **Overview metrics** — total cards, completed, avg completion time (hours), overdue count
- **PDF export** — jsPDF v4 + jspdf-autotable, auto-pagination, timestamped filename, toast feedback
- `useRealtimeAnalytics` hook — Supabase broadcast channel per board, auto-refreshes on card events

### Email Delivery (Resend)
- `lib/email.ts` — Resend client with 4 HTML email templates:
  - `sendEmail(opts)` — base send with error handling and env guard
  - `sendMentionEmail(opts)` — `@mention` notification with card link
  - `sendDueDateReminderEmail(opts)` — due date reminder with countdown
  - `sendWeeklyDigestEmail(opts)` — weekly stats digest with stat grid
- `createComment` (in `phase3-actions.ts`) fires `sendMentionEmail()` for each `@`-mentioned Clerk user ID; fire-and-forget via `void Promise.allSettled()`; skips self-mentions; only fires on non-draft comments
- Cron job (`/api/cron/daily-reports`) sends weekly digests on Mondays and daily due-date reminders; guarded by `CRON_SECRET` header

### File Attachments (Supabase Storage)
- `/api/upload/route.ts` — multipart upload to `card-attachments` Supabase Storage bucket; 10 MB limit; MIME allowlist (no SVG); org ownership check via `getTenantContext()`; Prisma `Attachment` record created
- DELETE endpoint: only original uploader can delete; DB record deleted first then storage removed; storage failure logged but does not fail the response
- `components/board/file-attachment.tsx` — upload UI with progress bar, file type icons, download link, delete; keyboard-accessible
- Card modal Files tab shows attachment count badge; wrapped in `<ErrorBoundary>`

### Board Templates
- Prisma models: `BoardTemplate`, `TemplateList`, `TemplateCard`
- **8 built-in global templates** seeded via `prisma/seed.ts` (global = `orgId: null`, visible to all orgs):

  | Template | Category | Lists |
  |----------|----------|-------|
  | Scrum Sprint Board | Engineering | 6 (Backlog → Sprinting → In Progress → Code Review → QA → Done) |
  | Product Roadmap | Product | 5 (Ideas → Research → Scoped → In Development → Shipped) |
  | Marketing Campaign Launch | Marketing | 6 (Ideation → Content → Review → Scheduled → Launched → Reporting) |
  | Design Sprint (5-Day) | Design | 5 (Monday–Friday phases, GV-style) |
  | Hiring Pipeline | HR | 7 (Posting → Applications → Phone Screen → Technical → Onsite → Offer → Hired) |
  | Bug Tracker | Engineering | 6 (Reported → Triage → Reproducing → In Fix → Regression → Resolved) |
  | Content Calendar | Marketing | 6 (Ideas → Writing → Design → Review → Scheduled → Published) |
  | Employee Onboarding | HR | 5 (Before Day 1 → Week 1 → Month 1 → Month 2 → Month 3) |

- Each template has 3–7 lists, each list has 3–6 pre-filled realistic cards
- `template-actions.ts`: `getTemplates`, `getTemplateById`, `createBoardFromTemplate` (runs in `db.$transaction`), `seedBuiltInTemplates`
- `components/board/template-picker.tsx` — category filter tabs, colour-coded badges, list count, selected indicator, modal with search
- `create-board.ts` branches on `templateId`: present → `createBoardFromTemplate` (creates board + all lists + all cards + audit log); absent → blank board via `dal.boards.create`
- `/api/admin/seed-templates` — POST endpoint to re-seed templates in production (guarded by `CRON_SECRET`)

### @Mention UI (TipTap)
- `@tiptap/extension-mention` + `@tiptap/suggestion` installed
- `components/editor/mention-list.tsx` — dropdown with keyboard navigation (ArrowUp/Down/Enter), avatars, fallback initials, empty state
- `components/editor/mention-suggestion.ts` — `createMentionSuggestion()` factory: per-instance debounce timer + `latestResolve` pattern prevents Promise leaks on rapid input; backward-compatible singleton `mentionSuggestion` export; hits `/api/members`, 200ms debounce, tippy.js popup
- `rich-comments.tsx` creates per-mount suggestion via `useMemo` to prevent cross-editor timer collisions
- `/api/members/route.ts` — searches org members by query, returns up to 10 matches
- `app/editor.css` — `.mention` chip styles + tippy override CSS

### Real-Time Collaboration
- `useRealtimeBoard` — Supabase `postgres_changes` per board; patches local state on remote list/card CRUD; shows toast for remote changes; auto-reconnects
- `usePresence` — Supabase Presence channel per board; tracks online users; count + avatar list de-duped by `userId` to handle multi-tab
- `OnlineUsers` component — stacked avatars, 8-colour palette, Tippy "joined X ago" tooltip, pulse indicator
- `useCardLock` — Presence-based card-level edit locking; acquires lock on modal open, releases on close; shows banner with locker name + avatar; all inputs disabled when locked

### Accessibility
- `components/accessibility/aria-live-region.tsx` — ARIA live region for screen reader announcements
  - Two regions: `role="status" aria-live="polite"` and `role="alert" aria-live="assertive"`
  - Client-only (returns `null` until `mounted` = true to prevent server/client hydration mismatch)
  - Announcements dispatched via `window.dispatchEvent(new CustomEvent("nexus:announce", ...))`
  - `announce(message, priority)` helper exported for use anywhere in the app
  - Stale announcements auto-cleared after 5 seconds
- `components/keyboard-shortcuts-modal.tsx` — keyboard shortcut reference modal

### Sentry
- `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` all configured
- Session replay: 10% sample rate, 100% on errors
- Performance tracing enabled
- User context (Clerk ID + org) attached

### Error Handling
- `ErrorBoundary` component wrapping critical UI sections
- `ErrorBoundaryRealtime` variant for realtime components
- Fallback UI with retry button; prevents white-screen crash
- Global `not-found.tsx` and `error.tsx` at app root

### Command Palette
- `CommandPalette` in root layout; triggered by `Ctrl+K` / `Cmd+K`
- Searches boards + cards via `/api/boards` and `/api/cards/search` (up to 50 results)
- Quick Actions and Navigation sections; Recent items (localStorage, 5 items); Priority badges on card results

### Notification Center
- `components/notification-center.tsx` — bell icon notification feed
- Read/unread state, mark all as read, per-notification dismiss

### Performance
- `LazyLoad` component (Intersection Observer)
- `VirtualScroll` component for long lists
- `SmoothScroll` wrapper
- `PerformanceWrapper` in root layout — Web Vitals reporting + FPS monitor (dev only)
- Charts and PDF export code-split via `next/dynamic`
- `lib/prefetch.ts` — route prefetch utilities
- `lib/performance.ts` — performance measurement helpers
- Inter font with `display: swap` + CSS variable `--font-inter`

### Mobile & Responsive
- Tailwind responsive breakpoints throughout
- iOS safe area insets in `globals.css`
- `100dvh` dynamic viewport height
- 44px minimum touch targets enforced
- `-webkit-tap-highlight-color: transparent` globally
- GPU acceleration utility class; momentum scrolling; overscroll containment
- Landscape mode adjustments
- `MobileNav` component (`components/layout/mobile-nav.tsx`): fixed header, hamburger menu, slide-in nav panel with framer-motion animation

### PWA
- `public/manifest.json` — top-level `icons` array, two size shortcuts, theme colour `#4F46E5`
- `public/icon-192.png`, `public/icon-512.png` — indigo background, white "N"
- `public/apple-touch-icon.png` (180×180) — solid fill, handles iOS home screen installs
- `app/layout.tsx` metadata includes `icons: { apple: "/apple-touch-icon.png" }` + `manifest: "/manifest.json"`
- `appleWebApp: { capable: true, statusBarStyle: "default" }` set in metadata

### UI Foundation
- shadcn/ui component library (Radix UI primitives) in `components/ui/`
- Tailwind v4 + `tw-animate-css`
- Dark/Light theme via `next-themes` + inline `themeScript` in `<head>` (zero flash on load)
- `design-tokens.ts` + `spacing.ts` for spacing and colour references
- Sonner toasts + shadcn `Toaster` both present in root layout
- Landing page at `/` with animated hero, feature list, CTA buttons, auth redirect

### Sidebar (Desktop)
- `components/layout/sidebar.tsx` — full desktop sidebar with logo, nav links, theme toggle, org switcher, user button
- `OrganizationSwitcher` and `UserButton` loaded via `dynamic(..., { ssr: false })` with loading skeleton placeholders (`h-7 w-40 rounded-md` and `h-8 w-8 rounded-full`) — prevents hydration mismatch and eliminates CLS

### Mobile Nav
- `components/layout/mobile-nav.tsx` — fixed header bar, hamburger open/close, `AnimatePresence` slide panel
- `OrganizationSwitcher` and `UserButton` loaded via `dynamic(..., { ssr: false })` with same skeleton placeholders

---

## Bug Fixes — 24 February 2026 Session

| Bug | Root Cause | Fix Applied |
|-----|-----------|-------------|
| React hydration mismatch — sidebar + mobile-nav | `UserButton`/`OrganizationSwitcher` inject `<div data-clerk-component>` on client only, not in SSR HTML | `dynamic(..., { ssr: false })` applied to both Clerk components in `sidebar.tsx` and `mobile-nav.tsx` |
| `/api/unsplash` returning 500 (round 1) | `UNSPLASH_ACCESS_KEY` env var did not exist; route threw instead of graceful fallback | Added null-check guard; returns `{ photos: [], unconfigured: true }` HTTP 200 when key missing |
| `/api/unsplash` returning 500 (round 2) | `.env` had `UNSPLASH_ACCESS_KEY` set to the Unsplash **Secret Key** (invalid for API calls) | Identified `NEXT_PUBLIC_UNSPLASH_ACCESS_KEY` as the valid Access Key; unified both vars to use same value |
| `next/image` runtime error — `images.unsplash.com` not configured | Missing `remotePatterns` in `next.config.ts` | Added `remotePatterns` for `images.unsplash.com` and `plus.unsplash.com` |
| `AriaLiveRegion` hydration mismatch | Component rendered `<div role="status">` on server but not on client (vice versa) | Added `mounted` state guard; component returns `null` until after first client render |
| Board creation silently failing | No active Clerk organization → `getTenantContext()` threw `UNAUTHENTICATED`; toast incorrectly showed "You must be signed in" | `proxy.ts` already handles org redirect correctly; confirmed working after restart; `fieldErrors` branch added to `board-list.tsx` handler |
| `fieldErrors` silent failure in board form | `createSafeAction` returns `{ fieldErrors }` on Zod validation failure — component did not handle this branch; showed `Board "undefined" created!` with no actual creation | Added `result.fieldErrors?.title` check before `result.error` check in `handleCreateBoard` |
| `middleware.ts` conflict with `proxy.ts` | Created `middleware.ts` which conflicted with existing `proxy.ts`; Next.js 16 uses `proxy.ts` exclusively | Deleted `middleware.ts`; `proxy.ts` already had complete auth + org-redirect + header-injection logic |
| NEXT_PUBLIC key in server bundle | `getUnsplashClient()` used `process.env.UNSPLASH_ACCESS_KEY ?? process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY` — the `NEXT_PUBLIC_` fallback would bake the key into the client JS bundle | Removed fallback; now reads only `process.env.UNSPLASH_ACCESS_KEY`; added `console.warn` when `NEXT_PUBLIC_` variant is set |
| CLS from Clerk dynamic components | Clerk `dynamic()` imports had no `loading` placeholder — components loaded after hydration caused layout shift | Added `loading` skeleton to all four `dynamic()` calls in `sidebar.tsx` and `mobile-nav.tsx` |
| Empty board template picker | `prisma/seed.ts` had no templates — only created default org | Added 8 full professional templates with lists + cards to seed; ran `npx prisma db push` then `npx prisma db seed` to populate DB |

---

## Source File Inventory

### Server Actions (`actions/`)

| File | Exports / Responsibility |
|------|--------------------------|
| `create-board.ts` | `createBoard` — org check, rate limit, Stripe board limit, Unsplash image fields, template branching |
| `delete-board.ts` | `deleteBoard` |
| `create-list.ts` | `createList` |
| `update-list.ts` | `updateList` |
| `delete-list.ts` | `deleteList` |
| `update-list-order.ts` | `updateListOrder` (LexoRank) |
| `create-card.ts` | `createCard` |
| `update-card.ts` | `updateCard` |
| `delete-card.ts` | `deleteCard` |
| `get-card.ts` | `getCard` |
| `update-card-order.ts` | `updateCardOrder` (LexoRank) |
| `get-audit-logs.ts` | `getAuditLogs` |
| `label-actions.ts` | createLabel, assignLabel, unassignLabel, getOrganizationLabels, getCardLabels |
| `assignee-actions.ts` | assignUser, unassignUser, getOrganizationMembers |
| `phase3-actions.ts` | updateCardPriority, setDueDate, clearDueDate, createComment (+ `@mention` email trigger), updateComment, deleteComment, addReaction, removeReaction |
| `user-preferences.ts` | getPreferences, savePreferences |
| `template-actions.ts` | getTemplates, getTemplateById, createBoardFromTemplate, seedBuiltInTemplates |
| `attachment-actions.ts` | getCardAttachments (IDOR-hardened), deleteAttachment |
| `analytics/` | getBoardAnalytics |
| `ai-actions.ts` | AI-powered card features (OpenAI `^4.104.0`) |
| `api-key-actions.ts` | API key CRUD for external integrations |
| `automation-actions.ts` | Board automation rule CRUD |
| `board-share-actions.ts` | Inter-org board sharing |
| `bulk-card-actions.ts` | Bulk move/archive/delete/label/assign operations |
| `checklist-actions.ts` | Card checklist items CRUD |
| `custom-field-actions.ts` | Custom field definitions + card values |
| `dependency-actions.ts` | Card dependency (blocks/blocked-by) management |
| `import-export-actions.ts` | Board CSV/JSON import and export |
| `notification-actions.ts` | In-app notification CRUD + mark-read |
| `roadmap-actions.ts` | Roadmap view data + epic management |
| `saved-view-actions.ts` | Saved board filter views |
| `sprint-actions.ts` | Sprint CRUD + card assignment to sprints |
| `time-tracking-actions.ts` | Per-card time tracking (start/stop/log) |
| `webhook-actions.ts` | Outbound webhook registration + delivery |
| `schema.ts` | All Zod input schemas (CreateBoard, CreateList, CreateCard, etc.) |

### Hooks (`hooks/`)

| File | Purpose |
|------|---------|
| `use-realtime-board.ts` | Supabase `postgres_changes` board sync |
| `use-presence.ts` | Supabase Presence for online users |
| `use-card-lock.ts` | Presence-based card edit locking |
| `use-realtime-analytics.ts` | Supabase broadcast for analytics auto-refresh |
| `use-card-modal.ts` | Zustand store for card modal open/close/id |
| `use-debounce.ts` | Value debounce + callback debounce |
| `use-optimistic-card.ts` | `useOptimistic` wrapper for card mutations |
| `use-demo-mode.ts` | Demo context detection |

### Library Files (`lib/`)

| File | Purpose |
|------|---------|
| `db.ts` | Prisma client singleton |
| `tenant-context.ts` | `getTenantContext()`, `requireRole()`, `isDemoContext()`, `TenantError` |
| `dal.ts` | Data Access Layer — `orgId` injected on all queries; exposes `boards`, `lists`, `cards`, `auditLogs` |
| `create-safe-action.ts` | Type-safe server action wrapper with `TenantError` translation |
| `create-audit-log.ts` | Creates `AuditLog`; accepts `orgId` to skip redundant `auth()` call |
| `action-protection.ts` | `protectDemoMode`, `isDemoOrganization`, `checkRateLimit`, `RATE_LIMITS` |
| `settings-defaults.ts` | `UserPreferences` interface, `DEFAULT_PREFERENCES` constant |
| `lexorank.ts` | LexoRank string generation for list/card ordering |
| `stripe.ts` | Stripe client, `STRIPE_CONFIG` with `FREE`/`PRO` plan limits |
| `realtime-channels.ts` | Supabase channel name helpers (board, presence, analytics) |
| `supabase/` | Supabase client factory (server + browser variants) |
| `logger.ts` | Structured logger with dev/prod modes |
| `sentry-helpers.ts` | Sentry capture utilities |
| `email.ts` | Resend client: `sendEmail`, `sendMentionEmail`, `sendDueDateReminderEmail`, `sendWeeklyDigestEmail` |
| `automation-engine.ts` | Board automation trigger/action evaluation |
| `api-key-auth.ts` | API key validation for external `/api/v1/*` routes |
| `api-key-constants.ts` | API key prefix + scopes constants |
| `bulk-selection-context.tsx` | React context for multi-card bulk selection state |
| `event-bus.ts` | Client-side typed event bus |
| `format-utils.ts` | Shared formatting helpers |
| `priority-values.ts` | Priority enum values + colour mapping |
| `webhook-constants.ts` | Outbound webhook event type constants |
| `webhook-delivery.ts` | Outbound webhook HTTP delivery; 3-attempt exponential backoff (1 s, 2 s delays); immediate break on 2xx success or 4xx client error |
| `performance.ts` | Client performance measurement |
| `prefetch.ts` | Route prefetch helpers |
| `design-tokens.ts` | Spacing + colour reference constants |
| `spacing.ts` | Spacing scale constants |

### App Routes (`app/`)

| Route | Type | Notes |
|-------|------|-------|
| `/` | Client | Landing page + auth redirect |
| `/sign-in`, `/sign-up` | Clerk | Managed by Clerk |
| `/select-org` | Server | `<OrganizationList>` for org creation/selection |
| `/onboarding` | Server/Client | New user onboarding flow |
| `/dashboard` | Server | Renders `BoardList` client component |
| `/board/[boardId]` | Server | Board + lists + cards + analytics tabs |
| `/activity` | Server | Org audit log feed |
| `/billing` | Server | Stripe billing page |
| `/settings` | Server (async) | DB-hydrated user preferences |
| `/roadmap` | Client | Roadmap/epic view |
| `/search` | Client | Full-text search results page |
| `/shared` | Server | Shared board view (guest access) |

### API Routes (`app/api/`) — 28 route files total

| Route | Method(s) | Purpose |
|-------|-----------|---------|
| `/api/boards` | GET | Board list for command palette + dashboard |
| `/api/cards/search` | GET | Card search for command palette |
| `/api/members` | GET | Org member search for `@mention` autocomplete |
| `/api/unsplash` | GET | Server-side Unsplash photo search (key never sent to client) |
| `/api/tenor/search` | GET | GIF search via Giphy API |
| `/api/tenor/featured` | GET | Featured GIFs for GIF picker |
| `/api/upload` | POST, DELETE | Supabase Storage file upload/delete |
| `/api/attachment` | GET, DELETE | Attachment metadata |
| `/api/audit-logs` | GET | Org audit log (scoped by `getTenantContext`) |
| `/api/stripe/checkout` | POST | Create Stripe Checkout Session |
| `/api/stripe/portal` | POST | Create Stripe Customer Portal session |
| `/api/webhook/stripe` | POST | Stripe webhook — subscription lifecycle |
| `/api/cron/daily-reports` | GET | Vercel Cron `0 9 * * *` — due-date reminders + weekly digest |
| `/api/admin/seed-templates` | POST | Re-seed built-in templates (CRON_SECRET guarded) |
| `/api/ai` | POST | AI-powered card features (OpenAI) |
| `/api/push/subscribe` | POST | Save Web Push subscription |
| `/api/push/send` | POST | Send Web Push notification |
| `/api/export/[boardId]` | GET | Board CSV/JSON export |
| `/api/import` | POST | Board import from CSV/JSON |
| `/api/gdpr/export` | POST | GDPR data export for user |
| `/api/gdpr/delete-request` | POST | GDPR account deletion request |
| `/api/health` | GET | Health check endpoint |
| `/api/integrations/github` | POST | GitHub webhook receiver |
| `/api/integrations/slack` | POST | Slack event/slash command handler |
| `/api/v1/boards` | GET, POST | Public REST API v1 — boards list/create |
| `/api/v1/boards/[boardId]` | GET, PATCH, DELETE | Public REST API v1 — board CRUD |
| `/api/v1/cards` | GET, POST | Public REST API v1 — cards |
| `/api/v1/cards/[cardId]` | GET, PATCH, DELETE | Public REST API v1 — card CRUD |

### Key Components (`components/`)

| File/Folder | Purpose |
|-------------|---------|
| `board-list.tsx` | Dashboard board grid + create form (title + Unsplash picker + template picker) |
| `board/unsplash-picker.tsx` | Unsplash background picker modal |
| `board/template-picker.tsx` | Board template picker with category filter |
| `board/file-attachment.tsx` | Card attachment upload/list/delete |
| `board/*.tsx` | Board view: `BoardContainer`, `ListContainer`, `CardItem`, `CardModal`, `BoardTabs` |
| `modals/card-modal/` | Full card detail modal with all tabs |
| `layout/sidebar.tsx` | Desktop sidebar — Clerk components loaded `dynamic({ ssr: false })` with loading skeletons |
| `layout/mobile-nav.tsx` | Mobile header + slide-in nav — same dynamic pattern |
| `accessibility/aria-live-region.tsx` | Screen reader ARIA live regions (client-only; `mounted` guard) |
| `analytics/` | Analytics charts (Velocity, Priority, Contributors, Metrics) |
| `activity/` | Activity feed + audit log rendering |
| `editor/mention-list.tsx` | @mention autocomplete dropdown |
| `editor/mention-suggestion.ts` | TipTap mention suggestion factory |
| `rich-comments.tsx` | TipTap comment editor with reactions |
| `rich-text-editor.tsx` | TipTap rich text editor base |
| `command-palette.tsx` | Ctrl+K command palette |
| `keyboard-shortcuts-modal.tsx` | Keyboard shortcut reference |
| `notification-center.tsx` | In-app notification bell |
| `priority-badge.tsx` | Priority chip (LOW/MEDIUM/HIGH/URGENT) |
| `smart-due-date.tsx` | Due date display with countdown + colour states |
| `assignee-picker.tsx` | Org member picker for card assignee |
| `label-manager.tsx` | Org label CRUD + card label assignment |
| `error-boundary.tsx` | React error boundary with retry |
| `error-boundary-realtime.tsx` | Error boundary variant for realtime components |
| `performance-wrapper.tsx` | Web Vitals + FPS monitoring (dev only) |
| `lazy-load.tsx` | Intersection Observer lazy load wrapper |
| `virtual-scroll.tsx` | Virtual scroll for long lists |
| `smooth-scroll.tsx` | Smooth scroll wrapper |
| `theme-provider.tsx` | next-themes ThemeProvider + `themeScript` |
| `providers/modal-provider.tsx` | Mounts all global modals |
| `providers/sonner-provider.tsx` | Sonner toast provider |
| `ui/` | shadcn/ui component library (Button, Input, Dialog, Tabs, etc.) |
| `billing-client.tsx` | Billing page client component |

---

## Test Coverage — Verified Numbers

**Run command:** `npx jest --ci`  
**Last run result:** ✅ **191 tests — 13 suites — all passing — 0 failures**

### Test Suites

| Suite | Location | Coverage |
|-------|----------|----------|
| `action-protection.test.ts` | `__tests__/unit/` | Rate limiting, demo protection, role guards |
| `tenant-context.test.ts` | `__tests__/unit/` | getTenantContext, requireRole |
| `rate-limit.test.ts` | `__tests__/unit/` | `jest.useFakeTimers()` sliding window |
| `email.test.ts` | `__tests__/unit/` | sendEmail, sendMentionEmail, sendDueDateReminderEmail, sendWeeklyDigestEmail (all mocked) |
| `template-actions.test.ts` | `__tests__/unit/` | getTemplates, getTemplateById, createBoardFromTemplate, seedBuiltInTemplates; `db.$transaction` mock |
| `attachment-actions.test.ts` | `__tests__/unit/` | getCardAttachments IDOR/org-boundary security, deleteAttachment |
| `schema.test.ts` | `__tests__/unit/` | All Zod schemas, boundary conditions, error message quality |
| `dal.test.ts` | `__tests__/unit/` | DAL org-boundary injection verification |
| `custom-field-actions.test.ts` | `__tests__/unit/` | Custom field CRUD |
| `phase3-bulk-actions.test.ts` | `__tests__/unit/` | Bulk card operations |
| `sprint-actions.test.ts` | `__tests__/unit/` | Sprint CRUD + card assignment |
| `server-actions.test.ts` | `__tests__/integration/` | Full action integration tests |
| `accessibility.test.tsx` | `__tests__/a11y/` | Accessibility checks via jest-axe |

### E2E Tests (Playwright)
- Config: `playwright.config.ts` — Chromium + Firefox + Mobile Chrome; auth state reuse
- `e2e/auth.setup.ts` — Clerk sign-in flow; saves `e2e/.auth/user.json`
- `e2e/auth-user-b.setup.ts` — second user auth state for cross-user tests; saves `e2e/.auth/user-b.json`
- `e2e/boards.spec.ts` — dashboard load, blank board creation, Unsplash picker, template picker, board navigation
- `e2e/cards.spec.ts` — card creation, card modal, Files tab, @mention dropdown, file upload/rejection
- `e2e/tenant-isolation.spec.ts` — verifies org-boundary enforcement; user-b cannot access user-a's boards
- Run: `npx playwright test` (requires dev server running or `PLAYWRIGHT_BASE_URL` set)

---

## Infrastructure & Deployment

| Item | State |
|------|-------|
| Vercel hosting | Configured (`vercel.json` present) |
| Vercel Cron | `0 9 * * *` UTC → `/api/cron/daily-reports` |
| Supabase Realtime | Working via channel-name isolation |
| Supabase Storage | `card-attachments` bucket — run `npm run setup:storage` after adding `SUPABASE_SERVICE_ROLE_KEY` |
| Sentry | Client + server + edge all configured |
| GitHub repo | `https://github.com/viraj1011JAIN/Nexus.git` · branch `main` |
| GitHub Actions CI | `.github/workflows/ci.yml` — typecheck → lint (zero warnings) → test (coverage artifact) → build |
| DB migrations | `prisma db push` — no migration file history |

---

## Environment Variables Required

| Variable | Used By | Notes |
|----------|---------|-------|
| `DATABASE_URL` | Prisma | Supabase PostgreSQL connection string |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase client | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client | |
| `SUPABASE_SERVICE_ROLE_KEY` | Storage setup script | Not used at runtime |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk | |
| `CLERK_SECRET_KEY` | Clerk server | |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Clerk redirect | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Clerk redirect | `/sign-up` |
| `STRIPE_SECRET_KEY` | Stripe server | |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe client | |
| `STRIPE_WEBHOOK_SECRET` | Webhook handler | |
| `STRIPE_PRO_PRICE_ID` | Checkout session | |
| `UNSPLASH_ACCESS_KEY` | `/api/unsplash` route | Server-only; **never use NEXT_PUBLIC_ variant** |
| `RESEND_API_KEY` | `lib/email.ts` | |
| `EMAIL_FROM` | `lib/email.ts` | e.g. `noreply@yourdomain.com` |
| `OPENAI_API_KEY` | `ai-actions.ts` | |
| `CRON_SECRET` | `/api/cron` + `/api/admin/seed-templates` | Vercel Cron auth header |
| `VAPID_PUBLIC_KEY` | Web Push | |
| `VAPID_PRIVATE_KEY` | Web Push | |
| `VAPID_SUBJECT` | Web Push | `mailto:` email |
| `GITHUB_WEBHOOK_SECRET` | GitHub integration | |
| `SLACK_SIGNING_SECRET` | Slack integration | |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry client | |
| `SENTRY_DSN` | Sentry server/edge | |
| `SENTRY_AUTH_TOKEN` | Sentry source maps | |
| `NEXT_PUBLIC_APP_URL` | Email links, webhooks | e.g. `https://yourapp.vercel.app` |

---

## What Is Not Yet Implemented

| Feature | Status | Notes |
|---------|--------|-------|
| Board archiving | Schema missing `archivedAt` | No action, no UI |
| Board duplication | No action | Schema supports it; not built |
| List copy / archive | No actions | |
| Comment draft auto-recovery | `isDraft Boolean` on `Comment` exists | Client does not consume it |

---

## Completion Summary

| Area | Status | Notes |
|------|--------|-------|
| Auth + multi-tenancy | ✅ 100% | Clerk v6, org redirect, tenant context, demo guard, rate limiting |
| Board / List / Card CRUD | ✅ 100% | Full DAL + safe actions + schema validation |
| Drag-and-drop + LexoRank | ✅ 100% | dnd-kit v6, persisted ordering |
| Card details (description, labels, assignee, priority, due dates) | ✅ 100% | TipTap v3, all fields |
| Comments + reactions + threading | ✅ 100% | TipTap in comments, emoji reactions, parentId threading |
| @mention UI + email trigger | ✅ 100% | Dropdown, /api/members, Resend email fire-and-forget |
| Audit logs + activity feed | ✅ 100% | Every mutation logged |
| Billing + Stripe | ✅ 100% | Checkout, portal, webhook, plan enforcement |
| User preferences (settings) | ✅ 100% | 9 fields, persist, reset |
| Analytics dashboard + PDF export | ✅ 100% | Recharts, jsPDF, Vercel Cron |
| Real-time board sync | ✅ 100% | Supabase postgres_changes |
| Presence + card locking | ✅ 100% | Supabase Presence, per-card lock banner |
| Sentry + error boundaries | ✅ 100% | Client/server/edge, replay, tracing |
| Command palette | ✅ 100% | Ctrl+K, board+card search, recent items |
| Mobile responsive | ✅ 100% | Breakpoints, iOS safe areas, touch targets |
| PWA manifest + icons | ✅ 100% | manifest.json, 192+512px icons, apple-touch-icon |
| Board backgrounds (Unsplash) | ✅ 100% | Server-side API, picker UI, next.config.ts remotePatterns |
| Email delivery (Resend) | ✅ 100% | 4 email types, cron integration, @mention trigger |
| File attachments | ✅ 100% | Supabase Storage, upload/delete API, card modal Files tab |
| Board templates | ✅ 100% | 8 global templates seeded, picker UI, template → board creation |
| Accessibility (ARIA live) | ✅ 100% | Polite + assertive regions, mounted guard (no hydration mismatch) |
| Keyboard shortcuts modal | ✅ 100% | Reference modal |
| Notification center | ✅ 100% | In-app bell feed |
| Sprint management | ✅ Built | sprint-actions.ts + schema + tests |
| Custom fields | ✅ Built | custom-field-actions.ts + schema + tests |
| Bulk card actions | ✅ Built | bulk-card-actions.ts + bulk selection context |
| Board automation | ✅ Built | automation-actions.ts + lib/automation-engine.ts |
| Board sharing | ✅ Built | board-share-actions.ts + BoardShare model |
| Import / Export | ✅ Built | CSV/JSON import + export API routes |
| GDPR | ✅ Built | /api/gdpr/export + /api/gdpr/delete-request |
| AI features | ✅ Built | OpenAI integration via ai-actions.ts + /api/ai |
| Public REST API v1 | ✅ Built | /api/v1/boards + /api/v1/cards with API key auth |
| GitHub + Slack integrations | ✅ Built | push: AuditLog per commit-referenced card; PR opened/closed: AuditLog; PR merged: moves referenced cards to board's Done/Complete list; Slack: event + slash command handler |
| Web Push notifications | ✅ Built — needs VAPID env vars | All code built and working; activate by adding `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` to `.env` |
| Test coverage | ✅ 191/191 | 13 suites passing |
| CI/CD pipeline | ✅ 100% | GitHub Actions: typecheck + lint + test + build |
| Security hardening | ✅ 100% | IDOR fix, XSS escaping, SVG upload blocked, NEXT_PUBLIC fallback removed, CLS skeletons |

