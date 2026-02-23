<div align="center">

# NEXUS

### Enterprise-Grade Project Management Platform

[![Next.js](https://img.shields.io/badge/Next.js-16.1.4-black?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.3-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22.0-2D3748?style=flat-square&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Stripe](https://img.shields.io/badge/Stripe-v20.2.0-635BFF?style=flat-square&logo=stripe&logoColor=white)](https://stripe.com/)
[![Supabase](https://img.shields.io/badge/Supabase-2.91.1-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![Tests](https://img.shields.io/badge/Unit_Tests-122_Passing-brightgreen?style=flat-square&logo=jest&logoColor=white)](https://jestjs.io/)
[![CI](https://img.shields.io/badge/CI-GitHub_Actions-2088FF?style=flat-square&logo=github-actions&logoColor=white)](https://github.com/viraj1011JAIN/Nexus/actions)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

**A full-featured, production-ready SaaS project management tool — Kanban boards, real-time collaboration, rich card editing, analytics, file attachments, @mentions, Stripe billing and more.**

[Quick Start](#quick-start)  [Tech Stack](#tech-stack)  [Architecture](#architecture)  [Testing](#testing)  [Deployment](#deployment)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Testing](#testing)
- [CI/CD Pipeline](#cicd-pipeline)
- [Deployment](#deployment)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Nexus is a multi-tenant SaaS project management platform built on the Next.js 16 App Router. It targets the quality bar of tools like Jira, Linear and Trello — combining Kanban boards, drag-and-drop card ordering, a rich TipTap editor, real-time presence and board sync, Supabase Storage file attachments, a Recharts analytics dashboard with PDF export, Stripe subscription billing and a full email notification system, all shipped production-ready.

**What makes it different:**

| Concern | Approach |
|---|---|
| Card ordering | LexoRank strings — never breaks regardless of rearrangement count |
| Real-time sync | Supabase `postgres_changes` — whole board patches on every remote mutation |
| Presence + locking | Supabase Presence channel per board; card-level optimistic lock shown to peers |
| Auth + tenancy | Clerk v6 `getTenantContext()` auto-provisions `User` + `OrganizationUser` rows on first access |
| Rate limiting | Per-user in-memory sliding-window on board creation |
| Security | IDOR checks on every data access; XSS-safe URL/HTML escaping in email + API responses; SVG excluded from upload MIME allowlist |
| Billing | Stripe Checkout + Customer Portal + webhook lifecycle — FREE plan board limit enforced server-side |
| Email | Resend with four typed templates; cron sends daily reminders + Monday digests; `createComment` fires @mention emails fire-and-forget |

---

## Features

### Authentication & Multi-Tenancy

- Clerk v6 sign-in, sign-up, org creation and switching
- `getTenantContext()` — extracts `userId`, `orgId`, `orgRole` and membership in one call; used by every server action and API route; auto-provisions missing `User` and `OrganizationUser` rows
- `requireRole()` enforcement on all mutating operations (OWNER / ADMIN / MEMBER / GUEST)
- Demo-mode guard (`isDemoOrganization`, `protectDemoMode`) — read-only sandbox that blocks all writes
- Per-user in-memory rate limiting on board creation (`checkRateLimit`, `RATE_LIMITS`)
- Middleware protecting all `/dashboard`, `/board`, `/settings`, `/billing` and `/activity` routes

### Board Management

- Create, rename and delete boards — org-scoped, role-checked
- FREE plan board-count limit enforced against the active Stripe subscription; upgrade modal shown when limit is reached
- **Unsplash background picker** — 500 ms debounced search, 6 quick-tag pills, 3-column photo grid, load-more pagination, selected-photo checkmark overlay, attribution footer; board `imageFullUrl` renders as a full-page background with `bg-black/40` dark overlay
- **Board templates** — 6 seeded built-in templates: Kanban Board, Sprint Planning, Marketing Campaign, Product Roadmap, Design System, Hiring Pipeline; `createBoardFromTemplate` runs all list/card creation inside `db.$transaction`
- Template picker — category filter tabs, colour-coded badges, list and card counts, selected indicator
- Admin seed endpoint (`/api/admin/seed-templates`) — idempotent POST protected by `CRON_SECRET`

### List Management

- Create, rename and delete lists — scoped to board, permission-checked
- Drag-and-drop reorder with `@dnd-kit/core` v6
- Ordering persisted using LexoRank strings via `updateListOrder` server action

### Card Management

- Create, rename and delete cards; drag-and-drop within and between lists
- LexoRank ordering persisted via `updateCardOrder`
- **Card modal** with full detail view:
  - Rich-text description — TipTap v3 (StarterKit, Underline, Link, TaskList, TaskItem, Placeholder, CharacterCount 10 000 chars, TextAlign, Highlight, CodeBlockLowlight)
  - Auto-save (500 ms debounce) with `Idle / Saving / Saved / Error` visual states; explicit save button
  - Emoji picker (`emoji-picker-react`) and GIF picker (Giphy API / Klipy fallback via `/api/tenor`)
  - Priority selector — LOW / MEDIUM / HIGH / URGENT with suggested priority based on due-date proximity
  - Smart due date — countdown display, green / amber / red colour states, quick presets (+1 day, +1 week, etc.), shake animation when overdue
  - Assignee picker — org member list, avatar display, optimistic UI with rollback
  - Label manager — org-scoped labels, many-to-many, colour picker, optimistic UI with rollback
  - Threaded comments — TipTap editor, `parentId` nesting, emoji reactions (unique per user/emoji/comment), edit and delete with ownership check
  - Per-card activity log tab
  - File attachments tab with badge count — all wrapped in `<ErrorBoundary>` so attachment errors never crash the modal
  - Read-only mode enforced when the card is locked by a peer

### Real-Time Collaboration

- `useRealtimeBoard` — Supabase `postgres_changes` listener per board; patches local React state on remote CRUD events; shows toast for remote changes; auto-reconnects on channel failure
- `usePresence` — Supabase Presence channel per board; stacked avatar strip with 8-colour palette, Tippy "joined X ago" tooltip, pulse indicator; de-duplicated by `userId` to handle multi-tab sessions
- `useCardLock` — Presence-based card edit locking; acquires lock on modal open, releases on close; shows locker's name and avatar; all inputs disabled when locked
- `useRealtimeAnalytics` — Supabase broadcast channel per board; auto-refreshes analytics on `card_created`, `card_updated`, `card_deleted`, `card_completed` events

### @Mention System

- TipTap `extension-mention` + `@tiptap/suggestion`; dropdown with keyboard navigation (Up / Down / Enter), member avatars, fallback initials, empty state
- `createMentionSuggestion()` factory — debounce timer + `latestResolve` kept in closure per editor instance; resolves abandoned Promises on rapid typing to prevent leaks; backward-compatible singleton export preserved
- Wired to `/api/members` — returns up to 10 org members matching search query, with `clerkUserId` as the `id` field
- **Email trigger** — `createComment` (in `phase3-actions.ts`) calls `sendMentionEmail()` for each mentioned user after saving; fire-and-forget via `void Promise.allSettled()`; skips self-mentions and draft comments

### File Attachments

- Prisma `Attachment` model: `fileName`, `fileSize`, `mimeType`, `url`, `storagePath`, `cardId`, `uploadedById`, `uploadedByName`
- `/api/upload/route.ts` — multipart POST to Supabase Storage `card-attachments` bucket; 10 MB limit; MIME allowlist (SVG explicitly excluded); org ownership verified via `getTenantContext()` (auto-provisions rows — eliminates first-visit 403)
- DELETE endpoint — only the uploader may delete; Prisma record removed first; storage removal failure is logged with `attachment.id` + `storagePath` but does not fail the HTTP response
- File-attachment UI (`components/board/file-attachment.tsx`) — upload progress bar, file-type icons, human-readable size, download link, delete button; keyboard-accessible via `group-focus-within:opacity-100`
- `npm run setup:storage` — idempotent script that provisions the `card-attachments` bucket (public access, 10 MB limit, MIME allowlist) using the Supabase service role key

### Analytics Dashboard

- Board-level Analytics tab displayed alongside the Kanban board view
- All charts loaded client-side via `next/dynamic` with `ssr: false` to avoid SSR chart hydration issues:
  - **Velocity chart** — 14-day line chart comparing cards created vs. completed with trend indicator
  - **Priority distribution** — pie chart across 4 priority levels with colour coding
  - **Top contributors** — bar chart of the top 5 users by card activity
  - **Overview metrics** — total cards, completed cards, average completion time (hours), overdue count
- **PDF export** — jsPDF v4 + jspdf-autotable; auto-pagination; timestamped filename (`nexus-analytics-YYYY-MM-DD.pdf`); Sonner toast feedback on completion

### Email Notifications

- **Resend v6.9.2** as the delivery provider; sender address configured via `EMAIL_FROM`
- `lib/email.ts` — four typed send functions: `sendEmail`, `sendMentionEmail`, `sendDueDateReminderEmail`, `sendWeeklyDigestEmail`
- HTML templates with `escHtml()` wrapping all `allowUrl()` calls — XSS-safe link rendering
- Vercel Cron (`0 9 * * *` UTC) — issues daily due-date reminders; sends weekly digest every Monday morning

### Audit Logs & Activity

- `AuditLog` entry created on every BOARD / LIST / CARD CREATE, UPDATE and DELETE — stores `orgId`, `action`, `entityType`, `entityTitle`, `userId`, `ipAddress`, `userAgent`
- Org-filtered activity feed at `/activity`
- Per-card activity tab in the card modal

### Billing & Subscriptions

- Stripe v20 server SDK + `@stripe/stripe-js` v8 client
- **FREE plan** (enforced board limit) and **PRO plan** (unlimited boards and cards)
- `/api/stripe/checkout` — creates Stripe Checkout Session and redirects
- `/api/stripe/portal` — creates Customer Portal session for self-service subscription management
- `/api/webhook/stripe` — handles `customer.subscription.created/updated/deleted`, `invoice.payment_succeeded/failed`; syncs plan status to org record
- Board-count limit checked in `create-board.ts` before every create; upgrade modal shown contextually when limit is reached

### User Preferences

- 9 preferences persisted to `UserPreference` table: `emailNotifications`, `desktopNotifications`, `boardActivity`, `cardComments`, `cardDueDates`, `weeklyDigest`, `autoSave`, `compactMode`, `showArchived`
- `getPreferences` and `savePreferences` server actions with upsert logic
- Settings page (`/settings`) — async server component, DB-hydrated on load; both Save and Reset to Defaults buttons functional

### Command Palette

- Triggered by `Ctrl+K` / `Cmd+K` from any page in the application
- Searches boards and cards via `/api/boards` and `/api/cards` (up to 50 results each)
- Quick Actions, Navigation and Recent Items sections (localStorage, last 5 items)
- Priority badges displayed on card results

### Progressive Web App

- `manifest.json` with `icons` array, two App Shortcuts (Dashboard, New Board), theme colour `#4F46E5`
- `icon-192.png`, `icon-512.png` in `/public` — indigo background, white bold "N"
- `apple-touch-icon.png` (180180) for iOS home screen installs
- `app/layout.tsx` metadata includes `icons: { apple: "/apple-touch-icon.png" }`

### Performance Utilities

- `LazyLoad` — Intersection Observer-based deferred rendering for off-screen content
- `VirtualScroll` — windowed rendering for long card lists
- `SmoothScroll` wrapper component
- `PerformanceWrapper` mounted in root layout
- Charts and PDF export code-split via `next/dynamic`
- Inter font with `display: swap` and CSS variable for font-family
- `useMemo` / `useCallback` applied throughout editor and chart components

### Mobile & Responsive Design

- Tailwind responsive breakpoints throughout; `100dvh` dynamic viewport height
- iOS safe-area insets in `globals.css`; momentum scrolling; overscroll containment
- 44 px minimum touch targets enforced globally in CSS
- `-webkit-tap-highlight-color: transparent` applied globally
- Landscape mode layout adjustments

### Error Handling & Observability

- `ErrorBoundary` and `ErrorBoundaryRealtime` wrappers around all critical UI sections
- Fallback UI with retry button — no white-screen crashes
- App-root `error.tsx` and `not-found.tsx`
- Sentry (`@sentry/nextjs` v10) — client, server and edge configurations; session replay at 10% sample rate / 100% on errors; Clerk user ID + org ID attached to every event

---

## Tech Stack

Exact versions from `nexus/package.json`:

| Category | Package | Version |
|---|---|---|
| Framework | next | 16.1.4 |
| UI library | react / react-dom | 19.2.3 |
| Language | typescript | ^5 |
| ORM | prisma / @prisma/client | 5.22.0 |
| Auth | @clerk/nextjs | 6.36.10 |
| Realtime + Storage | @supabase/supabase-js | 2.91.1 |
| Payments (server) | stripe | 20.2.0 |
| Payments (client) | @stripe/stripe-js | 8.6.4 |
| Error tracking | @sentry/nextjs | 10.36.0 |
| Rich text editor | @tiptap/react | 3.17.1 |
| Drag and drop | @dnd-kit/core | 6.3.1 |
| Drag and drop | @dnd-kit/sortable | 10.0.0 |
| Validation | zod | 4.3.6 |
| UI state | zustand | 5.0.10 |
| Animation | framer-motion | 12.29.0 |
| Charts | recharts | 3.7.0 |
| PDF export | jspdf + jspdf-autotable | 4.1.0 / 5.0.7 |
| Dates | date-fns | 4.1.0 |
| Email | resend | 6.9.2 |
| Toast notifications | sonner | 2.0.7 |
| Tooltips | tippy.js / @tippyjs/react | 6.3.7 |
| Icons | lucide-react | 0.563.0 |
| UI primitives | Radix UI (via shadcn/ui) | various |
| Styling | tailwindcss | ^4 |
| Theming | next-themes | 0.4.6 |
| Unsplash | unsplash-js | 7.0.20 |
| Emoji picker | emoji-picker-react | 4.17.3 |
| Unit testing | jest | 30.2.0 |
| E2E testing | @playwright/test | 1.58.2 |
| Test utilities | @testing-library/react | 16.3.2 |
| Script runner | tsx | 4.21.0 |

---

## Architecture

### System Overview

```

                        CLIENT LAYER                              
          Browser (desktop + mobile)    PWA install             

                             HTTPS

                  VERCEL EDGE NETWORK                             
           Global CDN    Next.js Middleware auth guard          

                            

              NEXT.JS 16 APP ROUTER                               
                                                                  
  Server Components  data fetching, zero extra client JS   
  Client Components  interactivity, optimistic UI          
  Server Actions     Zod-validated mutations               
  API Routes         webhooks, uploads, search, cron       

                                              
    
   Supabase      Clerk      Stripe    Resend  
  PostgreSQL    Auth /     Billing     Email  
   Realtime     Org mgmt   Webhooks  Delivery 
   Storage      
 
```

### Mutating Request Lifecycle

Every server action and mutating API route follows this exact path:

```
1. getTenantContext()    validates Clerk session
                           auto-provisions User + OrganizationUser rows if absent
                           returns { userId, orgId, orgRole }

2. requireRole()         asserts minimum role (e.g. MEMBER) for the operation

3. Zod schema.parse()    rejects malformed input before any DB access

4. DAL query             orgId injected on every query (lib/dal.ts)
                           no cross-org data leakage possible

5. createAuditLog()      records action, entity, IP, user-agent

6. revalidatePath()      invalidates Next.js cache for affected pages

7. return { data }       client applies optimistic update; rolls back on error
```

---

## Database Schema

Managed by **Prisma 5.22** with `prisma db push`. All models verified from `nexus/prisma/schema.prisma`.

| Model | Key Fields |
|---|---|
| `Organization` | `id`, `name`, `slug`, `region`, `deletedAt`, 6 Stripe billing fields, `boards[]`, `members[]` |
| `User` | `id`, `clerkUserId`, `email`, `name`, `imageUrl`, `assignedCards[]`, `preferences?` |
| `OrganizationUser` | `role` (OWNER/ADMIN/MEMBER/GUEST), `isActive`, `invitedById`, `joinedAt` |
| `Board` | `title`, `orgId`, `imageId`, `imageThumbUrl`, `imageFullUrl`, `imageUserName`, `imageLinkHTML` |
| `List` | `title`, `order` (LexoRank), `boardId` |
| `Card` | `title`, `description`, `dueDate`, `priority` (LOW/MEDIUM/HIGH/URGENT, default MEDIUM), `assigneeId`, `labels[]`, `comments[]`, `attachments[]` |
| `Attachment` | `fileName`, `fileSize`, `mimeType`, `url`, `storagePath`, `cardId`, `uploadedById`, `uploadedByName` |
| `BoardTemplate` | `title`, `description`, `category`, `orgId` (null = global), `imageThumbUrl`, `lists[]` |
| `TemplateList` | `title`, `order`, `templateId`, `cards[]` |
| `TemplateCard` | `title`, `order`, `listId` |
| `Label` | `name`, `color`, `orgId` — unique on `(orgId, name)` |
| `CardLabelAssignment` | join table — unique on `(cardId, labelId)` |
| `Comment` | `text` (HTML from TipTap), `cardId`, `userId`, `parentId` (threading), `reactions[]`, `mentions` (String[]), `isDraft` |
| `CommentReaction` | `emoji`, `commentId`, `userId` — unique on `(commentId, userId, emoji)` |
| `AuditLog` | `orgId`, `action`, `entityId/Type/Title`, `userId`, `ipAddress`, `userAgent` |
| `BoardAnalytics` | `totalCards`, `completedCards`, `overdueCards`, `weeklyTrends` (JSON), `priorityDistribution` (JSON) |
| `UserAnalytics` | `userId`, `orgId`, `date` — daily snapshots |
| `ActivitySnapshot` | `orgId`, `timestamp`, aggregate counters |
| `UserPreference` | 9 boolean fields per user |

---

## Project Structure

```
nexus/                              # Next.js application root
 app/
    layout.tsx                  # Root layout — theme, auth, toasts, PWA metadata
    page.tsx                    # Landing page with animated hero + auth redirect
    globals.css                 # Tailwind base + mobile utilities
    editor.css                  # TipTap + mention + Tippy style overrides
    error.tsx                   # App-level error page
    not-found.tsx               # 404 page
    dashboard/                  # Board list (server component)
    board/[boardId]/            # Board view + analytics tabs
    activity/                   # Org audit log feed
    billing/                    # Stripe billing page
    settings/                   # User preferences (async server component)
    sign-in/ sign-up/           # Clerk-hosted auth pages
    api/
        upload/                 # Supabase Storage multipart upload + DELETE
        members/                # Org member search for @mention autocomplete
        unsplash/               # Server-side Unsplash photo search
        tenor/                  # GIF search proxy (Giphy / Klipy)
        boards/ cards/          # Command palette search endpoints
        audit-logs/             # Audit log query endpoint
        stripe/checkout/        # Create Checkout Session
        stripe/portal/          # Create Customer Portal session
        webhook/stripe/         # Stripe webhook handler
        cron/daily-reports/     # Vercel Cron — daily reminders + Monday digest
        admin/seed-templates/   # POST: idempotent template seeder

 actions/
    create-board.ts             # Org check, rate limit, Stripe limit, template branching
    delete-board.ts
    create-list.ts / update-list.ts / delete-list.ts / update-list-order.ts
    create-card.ts / update-card.ts / delete-card.ts / get-card.ts / update-card-order.ts
    get-audit-logs.ts
    label-actions.ts            # createLabel, assignLabel, unassignLabel, getOrg/CardLabels
    assignee-actions.ts         # assignUser, unassignUser, getOrganizationMembers
    phase3-actions.ts           # Priority, due dates, comments + @mention email trigger
    template-actions.ts         # getTemplates, createBoardFromTemplate, seedBuiltInTemplates
    attachment-actions.ts       # getCardAttachments (IDOR-safe), deleteAttachment
    user-preferences.ts         # getPreferences, savePreferences
    schema.ts                   # Zod schemas shared across all server actions
    analytics/getBoardAnalytics.ts

 components/
    ui/                         # shadcn/ui primitives (Button, Dialog, Tabs, Input )
    board/
       board-tabs.tsx          # "use client" wrapper for Radix Tabs (prevents hydration mismatch)
       list-container.tsx      # dnd-kit DnD orchestration
       card-item.tsx           # Card tile with priority badge
       card-form.tsx           # Inline card creation form
       unsplash-picker.tsx     # Board background Unsplash picker
       template-picker.tsx     # Board template selection UI
       file-attachment.tsx     # Attachment upload + management UI
       online-users.tsx        # Presence stacked-avatar strip
    modals/card-modal/          # Full card detail modal with all tabs
    analytics/                  # Recharts chart wrappers
    editor/
       mention-list.tsx        # @mention autocomplete dropdown
       mention-suggestion.ts   # createMentionSuggestion() factory
    layout/                     # Navbar, sidebar, org switcher
    providers/                  # Theme + modal store providers
    command-palette.tsx         # Ctrl+K global search palette
    priority-badge.tsx          # LOW/MEDIUM/HIGH/URGENT colour badge
    smart-due-date.tsx          # Countdown + colour states + presets
    rich-text-editor.tsx        # TipTap editor wrapper
    rich-comments.tsx           # Threaded comments with reactions
    label-manager.tsx           # Org label CRUD
    assignee-picker.tsx         # Member selector with avatar
    billing-client.tsx          # Stripe checkout / portal triggers
    error-boundary.tsx          # Generic error boundary
    error-boundary-realtime.tsx

 hooks/
    use-realtime-board.ts       # Supabase postgres_changes board sync
    use-presence.ts             # Supabase Presence channel
    use-card-lock.ts            # Presence-based card edit locking
    use-realtime-analytics.ts   # Supabase broadcast for analytics refresh
    use-card-modal.ts           # Zustand store — card modal open/close
    use-debounce.ts             # Value debounce + callback debounce
    use-optimistic-card.ts      # React useOptimistic wrapper
    use-demo-mode.ts            # Demo context detection

 lib/
    db.ts                       # Prisma client singleton
    tenant-context.ts           # getTenantContext(), requireRole(), isDemoContext()
    dal.ts                      # Data Access Layer — orgId injected on all queries
    create-safe-action.ts       # Type-safe server action wrapper
    create-audit-log.ts         # AuditLog creation helper
    action-protection.ts        # protectDemoMode, checkRateLimit, RATE_LIMITS
    stripe.ts                   # Stripe client + STRIPE_CONFIG plan limits
    email.ts                    # Resend: sendEmail, sendMentionEmail, sendDueDateReminderEmail, sendWeeklyDigestEmail
    lexorank.ts                 # LexoRank string generation
    realtime-channels.ts        # Supabase channel name helpers per org/board
    supabase/                   # Supabase client factory
    logger.ts                   # Structured logger
    sentry-helpers.ts           # Sentry capture utilities
    settings-defaults.ts        # UserPreferences interface + DEFAULT_PREFERENCES

 prisma/
    schema.prisma
    seed.ts                     # Seeds 6 built-in board templates

 scripts/
    seed-demo.ts                # Demo workspace data seeder
    setup-storage.ts           # Idempotent Supabase bucket provisioner

 __tests__/
    unit/                       # 7 Jest suites — 122 tests
    integration/                # 1 Jest suite — 19 tests

 e2e/                            # Playwright E2E specs
    auth.setup.ts
    boards.spec.ts
    cards.spec.ts

 public/
    manifest.json
    icon-192.png
    icon-512.png
    apple-touch-icon.png

 next.config.ts
 tailwind.config.ts
 tsconfig.json
 jest.config.ts
 jest.setup.ts
 package.json
```

---

## Quick Start

### Prerequisites

- **Node.js 20+**
- A **Supabase** project (PostgreSQL + Realtime + Storage)
- A **Clerk** application with at least one organisation enabled
- A **Stripe** account (test mode is fine for development)
- An **Unsplash** developer application
- A **Resend** account for email delivery

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/viraj1011JAIN/Nexus.git
cd Nexus/nexus

# 2. Install dependencies
npm install

# 3. Set up environment variables
#    (copy the template below into nexus/.env.local and fill in all values)

# 4. Generate the Prisma client
npx prisma generate

# 5. Push the database schema
npx prisma db push

# 6. Seed the 6 built-in board templates
npx prisma db seed

# 7. Provision the Supabase Storage bucket (run once)
npm run setup:storage

# 8. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

Create `nexus/.env.local` and populate every variable:

```bash
#  Database (Supabase) 
# Connection pooler URL — Transaction mode, port 6543 — used for all runtime queries
DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct connection URL — port 5432 — used by Prisma db push / migrate
DIRECT_URL="postgresql://postgres.<ref>:<password>@db.<ref>.supabase.co:5432/postgres"

#  Authentication (Clerk) 
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/dashboard"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/dashboard"

#  Supabase (Realtime + Presence + Storage) 
NEXT_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."

# Service role key — ONLY used by scripts/setup-storage.ts — never sent to client
SUPABASE_SERVICE_ROLE_KEY="eyJ..."

#  Payments (Stripe) 
STRIPE_API_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID="price_..."

#  External APIs 
UNSPLASH_ACCESS_KEY="..."
RESEND_API_KEY="re_..."
GIPHY_API_KEY="..."          # Optional — falls back to Klipy for GIF picker

#  Email 
EMAIL_FROM="Nexus <noreply@yourdomain.com>"

#  Application 
NEXT_PUBLIC_APP_URL="http://localhost:3000"   # https://yourdomain.com in production

#  Demo mode 
DEMO_ORG_ID=""    # Clerk org ID for the read-only sandbox (optional)

#  Cron security 
CRON_SECRET="..."    # Random secret — must match vercel.json cron Authorization header

#  Monitoring 
NEXT_PUBLIC_SENTRY_DSN="https://..."
SENTRY_AUTH_TOKEN="..."
SENTRY_ORG="..."
SENTRY_PROJECT="..."
```

### Where to get each key

| Key | Source |
|---|---|
| `DATABASE_URL` | Supabase Dashboard  Settings  Database  Connection string (Transaction mode) |
| `DIRECT_URL` | Supabase Dashboard  Settings  Database  Connection string (Session / Direct mode) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard  Settings  API  Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard  Settings  API  `anon` public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard  Settings  API  `service_role` secret key |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard  API Keys |
| `CLERK_SECRET_KEY` | Clerk Dashboard  API Keys |
| `STRIPE_API_KEY` | Stripe Dashboard  Developers  API keys  Secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard  Webhooks  Select endpoint  Signing secret |
| `UNSPLASH_ACCESS_KEY` | [unsplash.com/developers](https://unsplash.com/developers)  Your app  Access Key |
| `RESEND_API_KEY` | [resend.com](https://resend.com)  API Keys |

### Enable Supabase Realtime JWT Authentication (one-time step)

Nexus uses Clerk JWTs to authenticate Supabase Realtime channels for proper RLS enforcement:

1. Open **Clerk Dashboard**  **JWT Templates**  **New template**
2. Name it exactly **`supabase`** (case-sensitive)
3. Set **Signing algorithm** to `HS256`
4. Set **Signing key** to your Supabase project's **JWT Secret** (Supabase Dashboard  Settings  API  JWT Secret)
5. Add the following claim in the template body:
   ```json
   { "org_id": "{{org.id}}" }
   ```
6. Save. No code changes required.

> Without this step Realtime still works — channels are isolated by org ID in the channel name — but Supabase RLS policies cannot verify the JWT claim.

---

## Available Scripts

Run from the `nexus/` directory:

```bash
# Development
npm run dev              # Start Next.js dev server at http://localhost:3000
npm run build            # Production build
npm run start            # Serve the production build
npm run lint             # ESLint — zero-warning policy enforced in CI

# Database
npx prisma generate      # Regenerate Prisma client after schema changes
npx prisma db push       # Push schema to database (no migration history files)
npx prisma db seed       # Seed 6 built-in board templates
npx prisma studio        # Open Prisma Studio at http://localhost:5555
npm run db:seed          # Seed the demo workspace (scripts/seed-demo.ts)

# Storage
npm run setup:storage    # Provision card-attachments Supabase Storage bucket
                         # Idempotent — safe to re-run
                         # Requires SUPABASE_SERVICE_ROLE_KEY in .env.local

# Unit and integration tests
npm test                 # Jest in watch mode
npm run test:ci          # Jest with coverage report (CI mode, no watch)
npm run test:unit        # Run unit test suites only (__tests__/unit/)
npm run test:integration # Run integration test suite (__tests__/integration/)

# E2E tests (Playwright)
npx playwright test              # Full E2E suite (requires dev server running)
npx playwright test --ui         # Interactive Playwright UI mode
npx playwright codegen           # Record new test interactions
```

---

## Testing

### Unit Tests — Jest 30

**7 suites  122 tests  all passing**

```bash
npm run test:unit
```

| Suite | Tests | What it covers |
|---|---|---|
| `action-protection.test.ts` | 19 | `protectDemoMode`, `isDemoOrganization`, `checkRateLimit`, `RATE_LIMITS` constants |
| `tenant-context.test.ts` | 5 | `getTenantContext()`, `requireRole()`, `isDemoContext()` |
| `rate-limit.test.ts` | 4 | In-memory sliding-window with `jest.useFakeTimers()` |
| `email.test.ts` | 16 | All 4 email functions — Resend client fully mocked |
| `template-actions.test.ts` | 30 | `getTemplates`, `getTemplateById`, `createBoardFromTemplate`, `seedBuiltInTemplates`; `db.$transaction` mock; `CRON_SECRET` guard |
| `attachment-actions.test.ts` | 15 | `getCardAttachments` IDOR + org-boundary security tests; `deleteAttachment` |
| `schema.test.ts` | 32 | All Zod action schemas, boundary conditions, error message quality |

### Integration Tests — Jest 30

**1 suite  19 tests** in `__tests__/integration/server-actions.test.ts`

```bash
npm run test:integration
```

### Coverage

```bash
npm run test:ci    # Generates coverage report in nexus/coverage/
```

Coverage artifacts include `lcov.info`, `clover.xml` and an HTML report at `coverage/lcov-report/index.html`.

### E2E Tests — Playwright 1.58

**Browsers:** Chromium, Firefox, Mobile Chrome (auth state reused across specs)

```bash
# Requires the dev server to be running
npm run dev &
npx playwright test

# Required environment variables for E2E
E2E_EMAIL=your-test-clerk-email@example.com
E2E_PASSWORD=your-test-clerk-password
```

| Spec | Scenarios covered |
|---|---|
| `e2e/auth.setup.ts` | Clerk sign-in flow; saves auth state to `e2e/.auth/user.json` for reuse |
| `e2e/boards.spec.ts` | Dashboard load, blank board creation (URL assertion), Unsplash picker, template picker, board navigation |
| `e2e/cards.spec.ts` | Card creation, card modal open, Files tab, @mention dropdown visibility, file upload, file type rejection |

---

## CI/CD Pipeline

GitHub Actions at `.github/workflows/ci.yml` — four jobs gated sequentially:

```
Push to main / PR against main
            
             1. typecheck    npx tsc --noEmit
            
             2. lint         eslint (zero-warning policy)
            
             3. test         jest --ci --coverage    coverage artifact uploaded
            
             4. build        next build  (gated: runs only if all three pass)
```

Merges to `main` are blocked unless every job is green. The build job failing does not affect the coverage artifact.

---

## Deployment

### Vercel (recommended)

Vercel detects Next.js automatically and builds on every push to `main`.

1. Connect the GitHub repository to Vercel
2. Set the **Root Directory** to `nexus`
3. Add all [environment variables](#environment-variables) in the Vercel project settings
4. Deploy

**Configure webhooks after first deployment:**

- **Stripe** — Dashboard  Webhooks  Add endpoint: `https://yourdomain.com/api/webhook/stripe`
  - Events to listen for: `customer.subscription.*`, `invoice.payment_succeeded`, `invoice.payment_failed`
- **Vercel Cron** — already configured in `nexus/vercel.json`:
  ```json
  {
    "crons": [{ "path": "/api/cron/daily-reports", "schedule": "0 9 * * *" }]
  }
  ```
  Set `CRON_SECRET` in Vercel environment variables to secure the endpoint.

### Post-Deploy Checklist

- [ ] `npx prisma db push` against the production database
- [ ] `npx prisma db seed` to seed the 6 built-in templates
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY` in production env, run `npm run setup:storage` once to create the `card-attachments` bucket
- [ ] Stripe webhook delivering events to `/api/webhook/stripe`
- [ ] Clerk JWT template named `supabase` configured
- [ ] Sentry DSN set and a test error appearing in the Sentry dashboard

---

## Security

All items verified from source — no aspirational claims.

| Concern | Implementation |
|---|---|
| Authentication | Clerk v6 — session verified on every server action and API route |
| Authorization | `requireRole()` checked before every mutation; OWNER/ADMIN/MEMBER/GUEST enforced |
| Multi-tenant isolation | `orgId` injected on all DAL queries; IDOR checks in every attachment action prevent cross-org access |
| Input validation | Zod schema parse before any database write |
| SQL injection | Prisma ORM with parameterized queries |
| XSS in emails | `escHtml()` wraps all `allowUrl()` calls in `lib/email.ts`; no raw HTML reflected |
| XSS in API responses | Optional-chaining with string defaults on Unsplash API `user.name` and `user.links.html` fields |
| Upload safety | SVG excluded from MIME allowlist; 10 MB hard limit; org ownership verified before write |
| Webhook integrity | Stripe webhook signature verified by Stripe SDK before any state change |
| Error leakage | Sentry captures all exceptions; raw errors never sent to the browser |
| Rate limiting | Per-user in-memory sliding-window on board creation |
| Demo mode | `protectDemoMode()` blocks all writes on the demo org without throwing |
| Promise hygiene | `latestResolve` pattern in mention suggestion prevents unresolved Promise accumulation |

---

## Contributing

1. Fork the repository and create a feature branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Make your changes. Write or update tests for any modified behaviour.
3. Verify TypeScript compiles cleanly: `npx tsc --noEmit`
4. Verify lint passes: `npm run lint`
5. Commit using [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat(board): add card duplication action
   fix(upload): handle missing Content-Type header gracefully
   docs(readme): correct environment variable table
   test(schema): add boundary test for empty title
   ```
6. Push and open a pull request against `main`
7. All four CI jobs must be green before merge

---

## License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE) for details.

---

<div align="center">

Built with [Next.js](https://nextjs.org)  [Supabase](https://supabase.com)  [Clerk](https://clerk.com)  [Stripe](https://stripe.com)  [Resend](https://resend.com)  [Sentry](https://sentry.io)

[GitHub Repository](https://github.com/viraj1011JAIN/Nexus)  [Report a Bug](https://github.com/viraj1011JAIN/Nexus/issues)  [Request a Feature](https://github.com/viraj1011JAIN/Nexus/issues)

</div>
