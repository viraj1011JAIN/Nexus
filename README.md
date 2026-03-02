<div align="center">

<img src="Web-screenshort/Dashboard.png" alt="NEXUS Dashboard" width="100%" style="border-radius: 12px;" />

# NEXUS

**A production-grade, multi-tenant project management platform.**  
Real-time collaboration · Dual-gate RBAC · AI-powered workflows · Stripe billing

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Next.js](https://img.shields.io/badge/Next.js-16.1.4-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma&logoColor=white)](https://prisma.io)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Clerk](https://img.shields.io/badge/Clerk-Auth-6C47FF?logo=clerk&logoColor=white)](https://clerk.com)
[![Stripe](https://img.shields.io/badge/Stripe-Billing-008CDD?logo=stripe&logoColor=white)](https://stripe.com)
[![TypeScript Errors](https://img.shields.io/badge/TypeScript%20Errors-0-success)](nexus/tsconfig.json)
[![ESLint](https://img.shields.io/badge/ESLint-clean-4B32C3?logo=eslint&logoColor=white)](nexus/eslint.config.mjs)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

</div>

---

## Table of Contents

- [About](#about)
- [Screenshots](#screenshots)
- [Tech Stack](#tech-stack)
- [Feature List](#feature-list)
- [System Architecture](#system-architecture)
- [Multi-Tenant System & RBAC](#multi-tenant-system--rbac)
- [Authentication Flow](#authentication-flow)
- [Database Architecture](#database-architecture)
- [Drag & Drop System](#drag--drop-system)
- [Real-Time System](#real-time-system)
- [Payments & Billing](#payments--billing)
- [API Reference](#api-reference)
- [Server Actions](#server-actions)
- [Custom Hooks](#custom-hooks)
- [Component Library](#component-library)
- [Email Templates](#email-templates)
- [File System Structure](#file-system-structure)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Testing](#testing)
- [Security](#security)
- [Performance Optimizations](#performance-optimizations)
- [Deployment](#deployment)
- [Workflow Diagrams](#workflow-diagrams)
- [Use Case Diagram](#use-case-diagram)
- [Scalability](#scalability)
- [Known Limitations & Roadmap](#known-limitations--roadmap)
- [Changelog](#changelog)
- [Contributing](#contributing)
- [License](#license)

---

## About

Nexus is a full-stack, multi-tenant project management platform built for teams that need more than a basic Kanban board.

- **5 board views** — Kanban, Calendar, Gantt, Table, Workload
- **Dual-gate RBAC** — Organization-level + board-level access control with 28 granular permissions
- **Real-time collaboration** — Live board updates, cursor presence, card edit locking via Supabase WebSockets
- **CRDT collaborative editing** — Yjs CRDTs over Supabase Realtime broadcast — concurrent card description edits from multiple users merge automatically with no data loss
- **AI-powered workflows** — Checklist generation, card suggestions, and content summaries via OpenAI
- **Stripe billing** — FREE and PRO plans with full webhook lifecycle management
- **Public REST API** — API key authentication with per-scope permissions
- **GDPR compliant** — Data export and deletion endpoints built in
- **Production-ready security** — SSRF protection, audit logs, rate limiting, Row-Level Security
- **Horizontal database sharding** — FNV-1a consistent hashing routes each org to a dedicated shard with automatic health probing and failover (`lib/shard-router.ts`)
- **Immutable audit forensics** — dual-write to Axiom append-only cloud log + Postgres `BEFORE DELETE OR UPDATE` trigger ensures audit evidence survives even a fully compromised database credential
- **Step-Up authentication** — `createStepUpAction` factory wraps destructive server actions with mandatory biometric/TOTP re-verification, configurable per-action at four strictness levels
- **Chaos Engineering** — 40 dedicated tests (plus 6 E2E scenarios) proving the platform survives shard kill-switches, Axiom outages, step-up network partitions, and 5 s Supabase latency injection

> Built as a self-hostable alternative to Trello and Jira — with multi-organization support, a public API, and enterprise-grade security architecture out of the box.

**Code quality status:**
- TypeScript: **0 errors** across all 100 components, 42 server actions, and 35 lib modules
- ESLint: **0 warnings** — all Tailwind v4 utilities, a11y rules, and import rules pass cleanly
- Hydration: **0 mismatches** — all CSS utilities use bracket syntax (`gap-[5px]`, `h-[30px]`) for consistency between server and client renders
- Tests: **1,449 passing, 0 failing** across 49 test suites (Jest 30 + ts-jest + Playwright)

**What makes the architecture distinct:**
- `orgId` is **always** extracted from the Clerk JWT — never accepted from client parameters
- Even organization owners need an explicit `BoardMember` row to access a board (dual-gate model)
- Supabase is used **exclusively** for WebSocket events — all DB reads/writes go through Prisma
- RLS enforces tenant boundaries at the database level, even if application checks are bypassed

---

## Why NEXUS Isn't a Tutorial Clone

The core stack (Clerk + Prisma + Stripe + shadcn) appears in many tutorials. Here is what NEXUS adds that tutorials never cover:

| Non-Tutorial Feature | Where It Lives | Why It Matters |
|---|---|---|
| **Dual-Gate RBAC** | `lib/board-permissions.ts` | Org owners still need an explicit `BoardMember` row — org role alone grants zero board access |
| **LexoRank Ordering + Auto-Rebalancer** | `lib/lexorank.ts` + `/api/cron/lexorank-rebalance` | String-based card ordering with a weekly cron job that re-normalises long order strings before the 64-char DoS limit is hit |
| **SSRF Blocklist on Webhooks** | `lib/webhook-delivery.ts` | User-supplied webhook URLs are validated against RFC-1918 + loopback ranges before any outbound HTTP call |
| **Audit Log with Diffs** | `lib/create-audit-log.ts` | Every mutation records `previousValues` / `newValues` diffs — not just "action taken" |
| **Immutable Forensic Audit Sink** | `lib/audit-sink.ts` + `supabase-audit-immutability.sql` | Dual-write: every audit event is streamed to Axiom (append-only, no delete API) via `after()` + a Postgres `BEFORE DELETE OR UPDATE` trigger blocks mutations from all roles including `service_role` — attacker can't erase evidence even with a leaked DB credential |
| **Stripe Idempotency Guard** | `app/api/webhook/stripe/route.ts` | `ProcessedStripeEvent` table + Prisma `P2002` guard prevents double-processing replayed webhooks |
| **Supabase Channel Pre-Flight** | `hooks/use-presence.ts` | Calls `/api/realtime-auth` before opening any WebSocket channel — board membership verified server-side |
| **Presence Throttle + Visibility API** | `hooks/use-presence.ts` | Presence unsubscribes immediately when the user switches away from the tab; throttled state sync prevents N² event storms |
| **AI Prompt Injection Protection** | `lib/automation-engine.ts` | `sanitizeForPrompt()` strips control characters; all OpenAI calls use `system`/`user` role separation |
| **Rate Limiter (Redis + In-Memory)** | `lib/action-protection.ts` | Sliding-window via Upstash Redis when configured; automatic in-memory fallback so local dev needs no Redis |
| **RLS at Database Level** | `prisma/migrations/rls_policies.sql` | Row-Level Security policies on every tenant-scoped table — application-layer bypasses are blocked at the DB |
| **Full-Board CSV + JSON Export** | `actions/import-export-actions.ts` | Complete board snapshots including checklists, labels, and assignees — not just a title list |
| **Public REST API with Scoped Keys** | `app/api/v1/` | Per-scope API keys (`nxk_` prefix) stored as SHA-256 hashes — never retrievable after creation |
| **Realtime Drag Race Guard** | `hooks/use-realtime-board.ts` | Per-card 2-second suppression window stored in a `Map` ref — remote Supabase broadcasts are silently dropped for cards that were just dragged locally, preventing board snap-back during concurrent drags |
| **Storage Cleanup on Card Delete** | `actions/delete-card.ts` | Fetches all attachment `storagePaths` before Prisma cascade delete, then calls Supabase Storage `remove()` in `after()` — orphaned blobs are cleaned even though Prisma cascades only remove DB rows |
| **Share Link Field Whitelist** | `app/shared/[token]/page.tsx` + `actions/board-share-actions.ts` | Unauthenticated shared-board responses use an explicit Prisma `select` — `orgId`, `createdById`, and all non-display columns are structurally excluded, not redacted |
| **AI Frontend Cooldown** | `hooks/use-ai-cooldown.ts` | 10-second client-side cooldown on every AI trigger button with live countdown display — prevents OpenAI quota burn before the server-side rate limiter fires |
| **Dependency Cycle Detection (BFS)** | `actions/dependency-actions.ts` | `wouldCreateCycle()` runs a breadth-first search (MAX_VISITED=500) across the full dependency graph before any new edge is saved — circular dependency deadlocks are rejected at the action layer |
| **CRDT Collaborative Editing** | `lib/yjs-supabase-provider.ts` + `components/collaborative-rich-text-editor.tsx` | Card descriptions use Yjs CRDTs over a Supabase Realtime broadcast channel — concurrent edits from any number of users merge automatically with no data loss; replaces last-write-wins debounce with an eventually-consistent operational transform that is idempotent and commutative |
| **Database Shard Router** | `lib/shard-router.ts` + `app/api/health/shards/` | FNV-1a 32-bit hash routes each `orgId` to a deterministic shard; 30 s TTL health cache per shard; automatic failover to next healthy shard on failure; fail-open to shard 0 on total outage; `GET /api/health/shards` returns per-shard status map (200/207/503) |
| **Step-Up Authentication** | `lib/step-up-action.ts` | `createStepUpAction(schema, handler, level)` factory wraps any destructive server action with a mandatory Clerk biometric/TOTP re-verification challenge; four levels (`strict` 10 min, `moderate` 1 hr, `lax` 24 hr, `strict_mfa`); client `useReverification()` hook detects the magic Clerk error object and shows the modal automatically |
| **Chaos Engineering Suite** | `__tests__/unit/chaos/` + `e2e/chaos.spec.ts` | 40 tests across three resilience pillars: SK1-SK16 shard kill-switch (FNV-1a determinism, dead-shard failover, 30 s cache TTL, invalidation/recovery), AO1-AO12 Axiom audit outage (AbortSignal timeout, 429/503, Postgres trigger holds when Axiom is dark), NP1-NP10 step-up network partition (concurrent isolation, sequential independence); CE-1-CE-6 E2E: health endpoint shape, 401 guard on `/api/health/shards`, 5 s Supabase latency injection, offline/reconnect indicator, network recovery, step-up cancel leaves board intact |

> If you are a recruiter or technical reviewer: the files above are the non-standard work in this project. The `lib/` directory is where bespoke business logic lives — not boilerplate.

---

## Screenshots

> All screenshots are located in the `Web-screenshort/` folder.  
> The application fully supports **dark mode** (default) and **light mode** with an instant toggle.

---

### Landing Page

![Landing Page](Web-screenshort/Landing%20Page.png)

- Dark-theme marketing landing page at `/` — the first thing visitors see
- **Canvas nebula background** — animated starfield with drifting orbs and constellation lines, rendered on a full-viewport `<canvas>` element at 60 fps
- **Custom cursor** — pink-to-blue gradient dot with a trailing ring that follows via lerp animation; scales up with glow on hover over interactive elements; auto-hidden on touch devices
- **Hero section** — "Your team's work, beautifully connected" headline with live badge ("Supabase Realtime · Now Live"), stats bar (10K+ teams, 99.9% SLA, <50ms sync), and primary CTA
- **3D parallax board showcase** — three floating mock browser windows (Kanban, Dashboard, Analytics) that tilt on mouse movement via `rotateX`/`rotateY` transforms
- **Bento feature grid** — 7 cards covering: Real-time Collaboration, LexoRank Ordering, Analytics, Dual-gate RBAC, Audit Logs, Stripe Billing, and Command Palette (⌘K) — each with animated mini-demos
- **Draggable screenshot carousel** — horizontal scroll track with mock screenshots of Dashboard, Kanban Board, Analytics, Activity Feed, and Billing views; drag to scroll with grab/grabbing cursor
- **Workflow steps** — 4-step guide: Create Workspace → Build Boards → Collaborate Live → Track Progress
- **Tech stack ticker** — infinite-scrolling marquee of the 10 core technologies (Next.js 16, TypeScript, Supabase, Prisma, Clerk, Stripe, Tailwind, shadcn/ui, Vercel Edge, LexoRank)
- **CTA section** — gradient call-to-action ("Ship faster. Build together.") with sign-up and sign-in buttons
- **Footer** — branding, copyright, and quick links (Privacy, Terms, GitHub, Get Started)
- **Performance** — scroll reveal via `IntersectionObserver`, `will-change` hints on animated elements, `prefers-reduced-motion` support for accessibility
- Server Component wrapper at `page.tsx` — checks auth server-side and redirects signed-in users to `/dashboard`; all interactive content lives in a `"use client"` component

---

### Sign In

![Sign In](Web-screenshort/Signin.png)

- Dark-themed authentication page at `/sign-in` with animated particle canvas background
- **Particle network** — 60 floating particles with connection lines rendered on `<canvas>` at 60 fps; purple-tinted with organic drift
- **Gradient orbs** — three layered blurred orbs (purple, pink, cyan) with slow floating animations for depth
- **Split layout** — desktop shows branding + feature highlights on the left, auth card on the right; mobile collapses to single column
- **Feature highlights** (desktop) — four cards: Real-time collaboration, Enterprise-grade security, Multi-tenant workspaces, Advanced analytics
- **Social proof** — "Trusted by 2,000+ teams worldwide" with stacked avatar indicators
- **Clerk `<SignIn>` component** — dark-themed appearance overrides: translucent inputs, purple accent gradients, rounded-[12px] elements
- **Guest Demo Mode** — amber gradient button to explore the app without signup; sets `sessionStorage` flags and routes to demo org
- **Demo info banner** — explains guest mode limitations (changes not saved, sign up for full access)
- **Fully responsive** — mobile header shows NEXUS branding inline; auth card expands to full width; 44px minimum touch targets
- **Smooth entrance** — opacity + translateY transition on mount, staggered `animate-auth-*` keyframes for each section
- Grid overlay at 3% opacity for subtle texture

---

### Sign Up

![Sign Up](Web-screenshort/Signup.png)

- Dark-themed registration page at `/sign-up` with matching particle canvas and gradient orbs
- **Split layout** — desktop: branding + benefits checklist + testimonial on left, auth card on right; mobile: single column
- **Benefits checklist** — four items with green check-circle icons: Unlimited boards on Pro, Real-time collaboration, AI-powered suggestions, Advanced analytics
- **Testimonial card** — glass-effect quote card with avatar and attribution
- **Clerk `<SignUp>` component** — same dark appearance as sign-in for visual consistency
- **Free plan note** (mobile only) — green-tinted banner: "Free plan includes: 50 boards, 500 cards/board, real-time updates"
- After registration, automatically triggers the "healing" path in `getTenantContext()` — creates `User` and `OrganizationUser` rows
- Organization creation prompt appears immediately after sign-up if no org exists
- Redirect URL configurable via `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL`

---

### Dashboard

![Dashboard](Web-screenshort/Dashboard.png)

- Main landing page after login at `/dashboard`
- Displays all boards belonging to the active organization
- Each board card shows: title, background image/color, member count, and last activity
- **Create Board button** — opens a dialog with title input, Unsplash background picker, and template selector
- **Sidebar navigation** — links to Dashboard, Activity feed, Roadmap, Search, Billing, Settings
- **Online presence bar** — shows avatars of teammates currently active on shared boards
- **Organization switcher** — powered by Clerk; instantly switches context between orgs
- **Plan badge** — FREE / PRO indicator with "Upgrade" CTA for free plan users
- **Board limit meter** — FREE plan shows `X / 50 boards used` progress bar
- **Dark mode** active by default as shown; toggle in top-right corner
- Server Component — board list fetched on the server via DAL scoped to `orgId`
- **Real-time updates** — Supabase `org:{orgId}:boards` channel syncs board additions/deletions live

---

### Boards and Lists (Board View)

![Boards and List](Web-screenshort/Boards%20and%20List.png)

- Full Kanban board view at `/board/[boardId]`
- **Tab bar at top** — switches between: Board (Kanban), Calendar, Table, Gantt, Workload
- **Lists rendered as columns** — each list is a named, reorderable column
  - Drag a list left/right to reorder (LexoRank updates one DB row)
  - "Add list" button at the far right creates a new column
  - List title is inline-editable with a click
- **Cards rendered inside lists** — each card chip shows:
  - Card title (truncated to 2 lines)
  - Priority color accent bar on the left edge (Urgent = red, High = orange, Medium = cyan, Low = green)
  - Due date chip (red if overdue, amber if < 24h, grey otherwise)
  - Labels as colored pill badges
  - Assignee avatar
  - Checklist progress bar
  - Paperclip + count badge if attachments exist
  - Dependency lock icon if blocked by other cards
  - Story points badge
- **Drag and drop** — powered by `@dnd-kit`; cards and lists both draggable
  - Optimistic UI fires immediately; server action confirms asynchronously
  - `DragOverlay` shows a ghost copy of the dragged card
- **Filter bar** — filter by assignee, label, priority, due date range, keyword search
- **Bulk selection mode** — toggle to select multiple cards; floating action bar appears
- **Board header** — shows board title, member avatars, online users, settings menu, share button
- **3-dot card menu** — hover to reveal delete option per card
- Background image or color set per board (Unsplash picker)
- Board is a React Server Component for the shell; drag-and-drop and real-time are client-only

---

### Cards (Card Detail Modal)

![Cards](Web-screenshort/Cards.png)

- Full-screen dialog opened from any card click
- **Title bar** — inline-editable card title with auto-save
- **Left panel (main content):**
  - Rich text description editor (TipTap WYSIWYG — bold, italic, headings, lists, links, code, mentions, GIFs)
  - Character count indicator
  - AI "Generate Description" button — calls OpenAI and replaces current description (confirm prompt shown)
  - Save status indicator: Saved / Saving… / Error
- **Right sidebar (metadata):**
  - **Assignee picker** — search org members, assign/unassign
  - **Priority selector** — dropdown: Low / Medium / High / Urgent, with colored icon
  - **Due date** — SmartDueDate picker with relative presets (today, tomorrow, next week)
  - **Labels** — multi-select label picker, org-scoped labels with custom colors
  - **Sprint** — assign card to an active sprint
  - **Epic** — link card to an epic/initiative
  - **Story Points** — numeric estimate input
- **Tab bar (bottom of modal):**
  - **Description** — TipTap editor (default tab)
  - **Attachments** — file upload/download panel (up to 100 MB per file via Supabase Storage)
    - Files displayed with icon, name (clickable link → opens in new tab), size, uploader, upload time
    - Download button for forced download
    - Delete button with confirmation toast
    - Toast notification on successful upload
    - FREE plan: 10 attachment limit
  - **Checklists** — create multiple checklists; check/uncheck items; AI item generation from description
  - **Custom Fields** — text, number, date, checkbox, select, multi-select, URL, email, phone
  - **Time Tracking** — log time entries with start/end or duration; set estimate; visual progress bar
  - **Dependencies** — link cards as Blocks / Blocked By / Related; affected cards show a lock icon
- **Activity & Comments panel (bottom):**
  - Threaded comments with TipTap rich text, @mentions, emoji reactions
  - Audit log timeline — every card mutation recorded with who/what/when
- **Card edit locking** — if another user has the card open for editing, an overlay shows "Locked by [Name]"
- Keyboard shortcuts: `Esc` closes modal, `L` opens labels, `A` opens assignee, `D` opens due date

---

### Realtime Analytics Dashboard

![Realtime Analytics Dashboard](Web-screenshort/Realtime%20Analytics%20Dashboard.png)

- Analytics overlay accessible from within a board (chart icon in header)
- **Live metrics panel (top row):**
  - Total Cards, Completed, Overdue, Active Members — all update in real time via Supabase broadcast
- **Charts section:**
  - **Priority Distribution** — donut chart showing Urgent / High / Medium / Low split
  - **Weekly Trend** — line chart of cards created vs completed over the past 7 days
  - **Burndown chart** — remaining vs completed items across the sprint timeline
  - **Velocity chart** — story points completed per sprint
  - **Label distribution** — bar chart of label usage across the board
- **Real-time updates** — `use-realtime-analytics` hook subscribes to `org:{orgId}:analytics:{boardId}` channel
  - Card create/complete/delete events broadcast to all connected clients instantly
  - Charts animate to new values without page reload
- **PDF export** — "Export PDF" button generates a formatted report using jsPDF + AutoTable
- **Multi-tab view** — Board Overview / User Activity / Sprint Stats / Label Stats each on separate tabs
- Board-scoped — analytics shown are for the currently open board only

---

### Realtime Activity Feed

![Realtime Activity](Web-screenshort/Realtime%20Activity.png)

- Organisation-wide activity feed at `/activity`
- Shows every audited action across all boards the user has access to
- **Each entry shows:**
  - User avatar + name
  - Action description (e.g., "created card 'Fix login bug' in Sprint 4")
  - Board name and list name as breadcrumb links
  - Relative timestamp (e.g., "3 minutes ago")
  - IP address and browser agent (visible to org admins)
  - Before/after diff for update operations (previous value → new value)
- **Filters:** filter by action type, board, user, or date range
- **Real-time** — new audit log entries appear instantly via Supabase `org:{orgId}:activity` channel
  - ARIA live region announces new entries for screen readers
- **Pagination** — infinite scroll loads older entries
- Powered by the `getAuditLogs` server action, scoped strictly to `orgId`
- Useful for compliance tracking, debugging, and onboarding reviews

---

### Billing

![Billing](Web-screenshort/Billing.png)

- Premium billing management page at `/billing` with smooth entrance animations
- **Current plan status card** — full-width gradient banner (indigo → purple → violet) showing active plan, Crown icon for Pro, renewal date with green checkmark, or inactive warning; "Manage Billing" button opens Stripe Customer Portal
- **Billing period toggle** — pill-shaped segmented control (Monthly / Yearly) with emerald "-17%" savings badge; smooth background slide transition
- **Plans grid** — two-column responsive layout:
  - **Free card** — clean surface with Shield icon, $0/month pricing, 5 feature items with green checkmarks in circular badges, "Current Plan" disabled state
  - **Pro card** — gradient border accent (purple → indigo), "Popular" sparkle badge, £9/mo or £90/yr pricing, 8 feature items with purple checkmarks, gradient CTA button with shadow glow
- **Trust indicators** — footer row: 256-bit SSL encryption, Cancel anytime, Powered by Stripe
- **Stripe Configuration Warning** — amber alert with setup guide links when Stripe keys not configured; only rendered after client-side mount check
- **Webhook lifecycle** — all Stripe events processed by `app/api/webhook/stripe/route.ts`:
  - Plan activates immediately on `checkout.session.completed`
  - `invoice.payment_failed` → shows "Past Due" warning banner
  - `customer.subscription.deleted` → resets to FREE silently
- **Responsive** — stacks to single column on mobile; 44px touch targets; proper spacing
- UK VAT and Tax ID collection enabled in Stripe configuration
- `ProUpgradeModal` component shown contextually when FREE plan limits are hit elsewhere in the app

---

### Settings

![Settings](Web-screenshort/Settings.png)

- Organisation settings hub at `/settings`
- **Main settings page tabs:**
  - **General** — org name, slug, region, logo upload
  - **Members** — invite members, view roles, suspend/remove members
  - **API Keys** (`/settings/api-keys`) — create, view, revoke API keys with scope selection
    - Keys are prefixed `nxk_`; hashed with SHA-256 before storage; plaintext shown only once
    - Each key has an optional expiry date and a list of scopes (`boards:read`, `cards:write`, etc.)
    - Usage stats (last used, total requests)
  - **Automations** (`/settings/automations`) — visual rule builder
    - Trigger: card created / moved / due date approaching / label added / priority changed
    - Conditions: filter by list, assignee, priority, label
    - Actions: move card, assign member, add label, send notification, call webhook
    - Up to 3-level nesting; each automation has enable/disable toggle and run log
  - **Webhooks** (`/settings/webhooks`) — register outbound HTTP endpoints
    - HMAC-SHA256 signing with per-webhook secret
    - Event selection (card.created, card.updated, card.moved, etc.)
    - Delivery log with HTTP status, payload preview, retry option
    - SSRF protection blocks private IP ranges
  - **Integrations** (`/settings/integrations`) — GitHub and Slack
    - GitHub: maps push events and PR events to card status changes
    - Slack: posts card activity notifications to a Slack channel via incoming webhook URL
  - **GDPR** (`/settings/gdpr`) — data portability tools
    - "Export My Data" — downloads a ZIP of all user data (GDPR Art. 20)
    - "Request Account Deletion" — initiates soft delete workflow (GDPR Art. 17)
    - Audit log of all GDPR requests
- All settings pages are protected; only OWNER / ADMIN roles can access most sections

---

### Light Mode

![Light Mode](Web-screenshort/Light%20Mode.png)

- The entire application supports both dark and light themes
- **Theme toggle** — sun/moon icon button in the top navigation bar
- Persisted in `localStorage` and applied via a `class` on the `<html>` element (no flash of wrong theme on reload)
- System preference detection — defaults to OS-level `prefers-color-scheme` on first visit
- Light mode uses a warm off-white (`#F4F1ED`) background and soft shadows
- Dark mode uses a deep indigo-charcoal (`#0D0C14`) with purple-tinted glows
- All Tailwind utility classes use `dark:` prefix variants — no CSS variable swapping
- `useTheme` hook from `components/theme-provider.tsx` exposes `resolvedTheme` to all components
- `useSyncExternalStore` used for hydration-safe mount detection — prevents theme flash on SSR

---

### Command Palette (⌘ K / Ctrl K)

![Command Palette](Web-screenshort/Command%20Pallete%20(ctrl%20+%20K).png)

- Global command palette triggered anywhere in the app with `Ctrl+K` (Windows/Linux) or `⌘K` (macOS)
- **Search bar** — fuzzy-search across commands, boards, cards, and navigation links in real time
- **Quick navigation** — jump directly to any board, settings page, or route without using the sidebar
- **Card actions** — find and open any card by title; actions like assign, change priority, and move list are accessible without opening the card modal
- **Board actions** — create board, archive board, manage members — all surfaced as palette commands
- **Keyboard-driven** — arrow keys navigate results, `Enter` executes, `Esc` dismisses
- Built on `cmdk` (Command Menu) with Radix UI Dialog as the overlay container
- Results are grouped by category: Navigation, Boards, Cards, Actions
- Accessible — ARIA roles `combobox` / `listbox`, focus trap inside the dialog, screen-reader announcements for result count
- Available on every page — mounted at the root layout level so it never unmounts between navigations

---

## Pages Deep-Dive

### `/` — Landing / Home

- Root route — auto-redirects to `/dashboard` for authenticated users (handled in `proxy.ts` middleware before page render)
- Shows a minimal marketing page for unauthenticated visitors with CTA to sign up
- Server-side `auth()` check redirects signed-in users to `/dashboard` (instant HTTP 307, no client JS required); unauthenticated visitors get a pure static marketing page

---

### `/sign-in` — Sign In

- Clerk-managed authentication at `[[...sign-in]]` catch-all route
- Renders `<SignIn />` component from `@clerk/nextjs`
- Supports: Email/password, magic link, Google OAuth, GitHub OAuth
- On success: redirects to `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` (defaults to `/`)
- `getTenantContext()` auto-heals missing User/OrganizationUser rows on first login

---

### `/sign-up` — Sign Up

- Clerk-managed registration at `[[...sign-up]]` catch-all route
- Renders `<SignUp />` component from `@clerk/nextjs`
- Email verification step (OTP or magic link)
- After successful registration: redirects to `/`, then `select-org` if no org exists
- New users provisioned automatically in DB on first `getTenantContext()` call

---

### `/select-org` — Organisation Selector

- Displayed when a user is authenticated but has no active organisation context
- Renders Clerk `<OrganizationList />` — shows orgs the user belongs to with create option
- Selecting or creating an org sets the active org JWT claim and redirects to `/dashboard`

---

### `/onboarding` — Onboarding

- Shown to new organisations that haven't completed initial setup
- Step-by-step wizard: org name → first board → invite teammates → choose template
- Guards redirect to here if `org.onboardingComplete` is false

---

### `/dashboard` — Dashboard

- **Protected:** requires active Clerk session + valid `orgId` JWT claim
- Server Component — fetches board list via `dal.boards.findMany()` scoped to `orgId`
- Rendered features:
  - Board grid with cards (image thumbnail, title, member count)
  - Create Board dialog — title, Unsplash picker, optional template
  - Board limit meter (FREE plan)
  - Sidebar with nav links, org switcher, user avatar
  - Online presence indicators
- Real-time: `org:{orgId}:boards` Supabase channel updates board list on create/delete

---

### `/board/[boardId]` — Board View

- **Protected:** requires valid `BoardMember` row (dual-gate check)
- Server Component shell; drag-and-drop and realtime are client-only
- Five tabs:
  - **Board (Kanban)** — lists + cards with full drag-and-drop
  - **Calendar** — month/week/day view of cards by `dueDate`
  - **Table** — sortable spreadsheet of all cards across all lists
  - **Gantt** — horizontal timeline bars colored by priority; zoom levels; today line
  - **Workload** — per-assignee capacity chart showing card distribution
- Card query includes: `assignee`, `labels`, `checklists.items` (progress bar), `_count.dependencies`, `_count.attachments`
- **Filter bar** — multi-criteria: assignee, label, priority, due date, search text
- **Sprint panel** (slide-out) — sprint CRUD, backlog assignment, burndown stats
- **Board settings** — accessible from header ⚙️ menu; redirects to `/board/[boardId]/settings`

---

### `/board/[boardId]/settings` — Board Settings

- Board-level config accessible to ADMIN and OWNER roles
- Sections:
  - **General** — board title, visibility (public/private), background image
  - **Members** — add/remove board members, change roles (OWNER/ADMIN/MEMBER/VIEWER)
  - **Permissions** — create/apply custom permission schemes; override role defaults
  - **Sharing** — generate public share links with optional password, expiry, and view limit
  - **Danger Zone** — delete board (cascades to all lists, cards, attachments)

---

### `/billing` — Billing

- Shows current plan (FREE / PRO), usage metrics, and upgrade options
- FREE → PRO: Stripe Checkout Session (GBP, `subscription` mode)
- PRO: Stripe Customer Portal for self-service changes, cancellation
- Webhook-driven plan sync — no page refresh needed after payment

---

### `/activity` — Activity Feed

- Organisation-wide audit log feed
- Real-time new entries via Supabase broadcast
- Each entry: user, action, entity, board, list, timestamp, IP, before/after values
- Filterable by action type, board, user, date range
- Infinite scroll pagination
- Admin-only fields (IP, user agent) hidden from MEMBER/VIEWER roles

---

### `/roadmap` — Roadmap

- Org-level roadmap view of Initiatives and Epics
- **Initiatives** — top-level goals (e.g., "Q2 Product Launch")
  - Each initiative contains multiple Epics
- **Epics** — milestone groupings of cards across boards
  - Shows progress bar (completed cards / total cards)
  - Due date, assignee, priority
- Create Initiative / Create Epic dialogs with date range pickers
- Gantt-style timeline visualization with swimlanes per initiative

---

### `/search` — Global Search

- Full-text search across all cards in all boards the user has access to
- Query sent to `GET /api/cards/search?q=...`
- Results grouped by board and list
- Each result shows: card title, list, board, assignee avatar, priority badge, due date
- Keyboard shortcut `Ctrl+K` / `Cmd+K` opens the command palette (includes search)
- Debounced input — waits 300ms after last keypress before firing search request

---

### `/settings` — Organisation Settings

- Hub for all org-level configuration
- **General** — org name, slug, region
- **Members** — list, invite (email), role assignment, suspension
- **API Keys** — create/revoke API keys with scoped permissions and expiry
- **Automations** — visual trigger/action rule builder with enable/disable toggle
- **Webhooks** — HMAC-signed outbound webhooks with delivery logs and retry
- **Integrations** — GitHub and Slack webhook configurations
- **GDPR** — data export and deletion request tools

---

### `/shared/[token]` — Public Shared Board

- Public route — no authentication required
- Accessible via a tokenized URL generated in Board Settings → Sharing
- Optional password prompt before content is shown
- Optional view count limit (board becomes inaccessible after N views)
- Optional expiry date
- Read-only view — no mutations allowed (demo mode protection active)
- Guest users see the Kanban view only; no settings, no member list

---

### `/pending-approval` — Pending Membership Approval

- Shown when a user has submitted a membership request to an org or board and is awaiting approval
- Displays status of all pending requests (org-level and board-level)
- Refreshes automatically when a request is approved or rejected via real-time broadcast
- "Cancel request" button available

---

### `/request-board-access` — Board Access Request

- Shown when a user tries to navigate to a board they aren't a member of
- Submits a `MembershipRequest` record to the board owner/admin for approval
- User can add an optional message to their request
- After submission → redirects to `/pending-approval`

---

### `/privacy` — Privacy Policy

- Static legal page — no auth required, no data fetching
- Outlines data collection, processing, and retention policies

---

### `/terms` — Terms of Service

- Static legal page — no auth required, no data fetching
- Outlines acceptable use, subscription terms, and service limits

---

### `error.tsx` — Error Boundary

- Next.js App Router root error boundary
- Catches unhandled errors in the render tree
- Shows a user-friendly "Something went wrong" UI with a "Try again" button
- Errors reported to Sentry automatically via `lib/logger.ts`

---

### `not-found.tsx` — 404 Page

- Shown when a route isn't matched or `notFound()` is called in a server component
- Custom branded 404 UI with navigation back to dashboard

---

## Tech Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Framework | Next.js (App Router) | 16.1.4 | Server Components, Server Actions, Turbopack |
| Runtime | React | 19.2.3 | UI rendering with React Compiler auto-memoization |
| Language | TypeScript | 5 | Strict-mode type-safe codebase |
| Database | PostgreSQL | — | Primary data store (Supabase-hosted) |
| ORM | Prisma | 5.22+ | Type-safe queries, migrations, schema |
| Auth | Clerk | 6.36+ | Multi-org auth, JWT, managed sign-in UI |
| Payments | Stripe SDK | v20 | Subscriptions, checkout, billing portal |
| Real-time | Supabase Realtime | 2.91+ | WebSocket subscriptions, presence, broadcast |
| Styling | Tailwind CSS | 4 | Utility-first CSS, class-based dark mode |
| UI Components | shadcn/ui (Radix UI) | — | Accessible, composable component primitives |
| Drag & Drop | @dnd-kit | 6.3+ | Card and list drag-and-drop |
| Ordering | LexoRank | Custom | String-based O(1) ordering |
| State | Zustand | 5.0+ | Client-side modal state |
| Rich Text | TipTap | 3.17+ | WYSIWYG editor, mentions, links |
| Charts | Recharts | 3.7+ | Analytics dashboards and metrics |
| Animations | Framer Motion | 12.29+ | Page transitions, micro-interactions |
| Validation | Zod | 4.3+ | Schema validation for actions and API input |
| Email | Resend | 6.9+ | Transactional email delivery |
| AI | OpenAI | 4.104+ | Card suggestions, checklist generation, summaries |
| Push | Web Push (VAPID) | — | Browser push notifications via Service Worker |
| PDF Export | jsPDF + AutoTable | 4.1+ | Board analytics PDF generation |
| Error Tracking | Sentry | 10.36+ | Error capture and performance monitoring |
| Testing | Jest | 30.2+ | Unit and integration tests |
| E2E Testing | Playwright | 1.58+ | End-to-end browser testing |
| Bundle Analysis | @next/bundle-analyzer | 16.1+ | Production bundle size analysis |
| Deployment | Vercel | — | Edge network, serverless functions, cron jobs |

---

## Feature List

### Board Views

- **Kanban** — Drag-and-drop cards across lists with live updates
- **Calendar** — Cards laid out by due date in month/week/day grid
- **Gantt** — Timeline chart with priority-colored bars, today line, zoom levels
- **Table** — Spreadsheet-style sortable view of all cards
- **Workload** — Team capacity visualization showing card distribution per member

### Card & Task Management

- Priority levels: Low, Medium, High, Urgent
- Due dates with smart date picker and priority-aware styling
- Labels with custom colors (organization-scoped)
- Checklists with progress tracking and AI-generated items
- File attachments via Supabase Storage (100 MB per file)
- Card cover images and colors
- Custom fields: Text, Number, Date, Checkbox, Select, Multi-Select, URL, Email, Phone
- Card dependencies: Blocks, Relates To, Duplicates
- Time tracking with minute-level logging and estimates
- Story points for agile estimation
- Threaded comments with rich text, mentions, and emoji reactions
- @mention support in comments and descriptions
- Card assignment to organization members
- Bulk card selection and batch operations (move, delete, assign, label, priority)

### Board Management

- Unsplash background image picker
- Board templates with pre-configured lists and cards
- Saved views with custom filters
- Sprint management: Planning, Active, Completed with burndown stats
- Epics and initiatives for roadmap planning
- Board-level settings and configuration
- Public/private board toggle

### Authentication & Multi-Tenant

- Clerk-managed sign-in/sign-up flows
- Multi-organization support with org switching
- Dual-gate RBAC: organization membership + board membership
- 4 board roles: Owner, Admin, Member, Viewer
- 28 granular board permissions
- Customizable permission schemes per board or per member
- Membership request system (org-level and board-level)
- Guest board access via tokenized links
- Password-protected shared boards
- Expiring share links with view count tracking

### Payments & Billing

- Stripe Checkout for subscription upgrades
- Stripe Customer Portal for self-service billing management
- FREE plan (£0, 50 board limit) and PRO plan (£9/month or £90/year, unlimited)
- Automatic webhook-driven subscription lifecycle management
- Promotion code support
- UK VAT / Tax ID collection

### Real-Time & Collaboration

- Live board updates via Supabase WebSockets (cards, lists, comments, reactions)
- Online user presence indicators (colored avatars)
- Card edit locking — prevents two users editing the same card simultaneously
- Real-time analytics broadcast
- Organization-wide activity feed

### API & Integrations

- Public REST API (v1) with API key authentication and scoped permissions
- Outbound webhooks with HMAC-SHA256 signing and SSRF protection
- GitHub integration webhook
- Slack integration webhook
- Unsplash image search
- GIF picker (Tenor)

### AI Features

- AI-powered card suggestions
- Automatic checklist generation from card descriptions
- Content summaries for cards and boards
- Daily AI call quota tracking per organization

### Notifications

- Web Push notifications (VAPID-based, via Service Worker)
- Email notifications via Resend
- In-app notification center with real-time unread badge
- Daily digest email reports (cron job at 9 AM UTC)
- Configurable notification preferences per user

### Analytics & Reporting

- Board analytics: total cards, completed, overdue, active members
- User activity analytics: cards created/completed, comments, active minutes
- Weekly trend tracking with JSON snapshots
- Priority distribution charts
- Burndown and velocity charts
- Activity timeline snapshots
- PDF export for analytics reports

### Security & Compliance

- Sliding-window rate limiting per action (in-memory) via `lib/action-protection.ts`
- Route-level rate limiting via `lib/rate-limit.ts` — AI endpoint capped at 20 req/user/min with 429 + `Retry-After`
- HSTS (2-year `max-age`, `includeSubDomains`, `preload`) in production
- `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Resource-Policy: same-origin` + `X-Permitted-Cross-Domain-Policies: none`
- Audit logs with IP address and User-Agent forensics
- Before/after value snapshots in audit trail
- SSRF protection on all outbound webhook deliveries
- Stripe webhook replay guard (300 s staleness check)
- Stripe TOCTOU protection: `updateMany` with subscription ID guard prevents stale plan downgrades
- RBAC auto-heal wrapped in `db.$transaction()` — atomic, suspension-aware
- Realtime WebSocket subscriptions authenticated with Clerk JWT
- LexoRank DoS guard: order strings > 64 chars rejected
- AI prompt injection protection: `sanitizeForPrompt()` + `system`/`user` role separation
- GDPR data export endpoint
- GDPR account deletion endpoint
- Demo mode read-only protection

### UI/UX

- Dark and light mode (class-based toggle with system preference detection)
- Command palette (Cmd+K / Ctrl+K) for quick navigation
- Keyboard shortcuts with modifier key support
- Smooth scrolling with GPU acceleration
- Virtual scrolling for large lists
- Lazy-loaded components via Intersection Observer
- Loading skeletons
- Global and realtime-specific error boundaries
- Accessibility support (ARIA live regions)
- PWA manifest with app icons

---

## System Architecture

### High-Level Overview

```
Browser Client (React 19 + RSC)
        │
        ├──── HTTP ──────────────────────────────────────────────────────────────────┐
        │                                                                            │
        │                         Next.js App Router (Server Components)            │
        │                                  │                                         │
        │                    ┌─────────────┴─────────────┐                          │
        │                    │                           │                           │
        │          Server Actions                  API Routes                        │
        │       (createSafeAction + Zod)     (REST v1 + Internal)                   │
        │                    │                           │                           │
        │          getTenantContext()            authenticateApiKey()                │
        │          (Clerk JWT → orgId)            (SHA-256 + Scopes)                │
        │                    │                           │                           │
        │                 Prisma ORM ◄──────────────────┘                           │
        │                    │                                                       │
        │              PostgreSQL (Supabase-hosted)                                 │
        │                                                                            │
        │  Server Actions also emit:                                                 │
        │       emitCardEvent() → AutomationEngine + WebhookDelivery (HMAC-SHA256) │
        │                                                                            │
        └──── WebSocket ──────────────────────────────────────────────────────────┐ │
                                                                                  │ │
                         Supabase Realtime (WebSocket only)                       │ │
                         Channels: org:{orgId}:board:{boardId}                    │ │
                                                                                  │ │
External Services:  Stripe · OpenAI · Resend · Sentry · Unsplash · Tenor        │ │
```

### Architecture Decision Records

**Next.js App Router over Pages Router**
- React Server Components render data-heavy pages with zero client-side JS
- Server Actions co-locate mutations with UI — type-safe, Zod-validated, no custom API routes needed
- Built-in `cache()` deduplicates DB calls within a single request

**Supabase + Prisma together (not one or the other)**
- Prisma handles 100% of all read/write queries with full TypeScript type safety
- Supabase is used exclusively for its Realtime engine — `postgres_changes`, `presence`, `broadcast`
- The database connection goes through Prisma via PgBouncer (port 6543)
- The Supabase client never writes to the database directly

**Clerk over NextAuth**
- Built-in multi-organization support with org-scoped JWTs
- The `orgId` JWT claim is the foundation of the entire tenant isolation model
- Webhook-driven user provisioning with auto-healing on first sign-in

**LexoRank over integer or fractional ordering**
- String-based ordering: O(1) insertions, only one DB row updated per move
- No floating-point degradation after many insertions (unlike fractional indexing)
- Built-in rebalancing when strings grow too long

**Server vs Client Component split**
- Server: data fetching, layout shells, board pages, settings pages
- Client: drag-and-drop, real-time subscriptions, modals, command palette, presence
- React Compiler (`babel-plugin-react-compiler`) provides automatic memoization — no manual `useMemo`/`useCallback` needed

---

## Multi-Tenant System & RBAC

### How Tenant Isolation Works

Every request follows this exact path:

1. `auth()` from `@clerk/nextjs/server` reads the session cookie and extracts signed JWT claims: `userId`, `orgId`, `orgRole`
2. `orgId` is **never** accepted from query parameters, request bodies, or URL paths — this is enforced in `lib/tenant-context.ts`
3. `getTenantContext()` resolves the internal `User` UUID from the Clerk user ID
4. If the user row doesn't exist (first sign-in), it creates one automatically — the "healing" path
5. The function loads the `OrganizationUser` membership record. If missing but the Clerk org exists, it auto-creates the membership
6. Users with `isActive=false` or `status=SUSPENDED` are rejected immediately with a `TenantError`
7. The entire function is wrapped in React's `cache()` — one DB call maximum per request

### Dual-Gate Access Control

```
Incoming Request
       │
       ▼
Clerk JWT Extraction
       │
       ▼
Gate 1: Organization Membership
       │
       ├── No OrganizationUser row OR status=SUSPENDED ──► 403 Forbidden
       │
       └── Active membership (OWNER/ADMIN/MEMBER/GUEST)
                    │
                    ▼
           Gate 2: Board Membership
                    │
                    ├── No BoardMember row ──► Zero Permissions (board invisible)
                    │
                    └── BoardMember exists
                                 │
                                 ▼
                    Resolve Permissions
                                 │
                    ┌────────────┴────────────┐
                    │                         │
             Custom Scheme?             Default Matrix
                    │                         │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    28 Granular Permissions Checked Per Action
```

### Role Hierarchy

**Organization Level**

| Role | Capabilities |
|---|---|
| OWNER | Full org control, billing, member management, all boards |
| ADMIN | Member management, create boards, org settings |
| MEMBER | Participate in boards they're added to |
| GUEST | Limited access, read-only by default |

**Board Level**

| Role | Capabilities |
|---|---|
| OWNER | All board operations, delete board, manage members |
| ADMIN | Edit settings, manage members, configure permissions |
| MEMBER | Create/edit/move cards, comment, upload files, track time |
| VIEWER | Read-only access to board and cards |

### Permission Schemes

- Each board can have a custom `PermissionScheme` that overrides the default role-to-permission matrix
- Individual `BoardMember` records can also have their own `PermissionScheme` for member-level customization
- 28 granular permissions cover every action: `CREATE_CARD`, `DELETE_CARD`, `MOVE_CARD`, `MANAGE_MEMBERS`, `CHANGE_PERMISSIONS`, and more

### Realtime Channel Isolation

- Every Supabase channel name includes `orgId`: `org:{orgId}:board:{boardId}`
- `lib/realtime-channels.ts` validates that `orgId` does not contain the `:` delimiter before constructing channel names
- This prevents injection attacks and ensures WebSocket events never leak across tenants

### Database-Level RLS

- The Prisma client sets `app.current_org_id` as a PostgreSQL session variable on every connection
- Row-Level Security policies filter all queries by this variable at the database engine level
- Even if application-level RBAC checks are bypassed, data from other organizations cannot be read
- A separate `systemDb` Prisma client bypasses RLS for trusted system operations (Stripe webhooks, cron jobs)

---

## Authentication Flow

### Full Request Authentication Sequence

```
Browser                Next.js Server          Clerk            PostgreSQL
   │                         │                    │                  │
   │── GET /dashboard ───────►│                    │                  │
   │                         │── auth() ──────────►│                  │
   │                         │◄── {userId, orgId} ─│                  │
   │                         │                    │                  │
   │                         │── getTenantContext() ──────────────────►│
   │                         │   (React cache() — max 1 DB call)       │
   │                         │                                         │
   │                         │   ┌─ Find User by clerkUserId           │
   │                         │   │  If not found → CREATE User         │
   │                         │   │  (first sign-in healing)            │
   │                         │   │                                     │
   │                         │   └─ Find OrganizationUser(userId,orgId)│
   │                         │      If not found → CREATE membership   │
   │                         │      If SUSPENDED → return TenantError  │
   │                         │◄── TenantContext {userId, orgId, role} ─│
   │                         │                                         │
   │                         │── Fetch page data (scoped by orgId) ───►│
   │◄── Rendered page ───────│◄────────────────────────────────────────│
```

### Route Protection Strategy

Auth is enforced at two layers — `proxy.ts` (Next.js 16 middleware) and at the action/route level:

- **`proxy.ts` middleware** — Clerk `clerkMiddleware()` runs on every non-static request. Unauthenticated users on protected routes are redirected to `/sign-in`. Org membership and board membership gates run before page render. Security headers (CSP, HSTS, X-Frame-Options, etc.) are injected here
- **Server Actions** call `getTenantContext()` as the first operation
- **API routes** call `authenticateApiKey()` for public v1 endpoints, or `getTenantContext()` for internal endpoints

**Public routes (no auth):**
- `/sign-in`, `/sign-up` — Clerk managed
- `/shared/[token]` — Guest board access via share token
- `/privacy`, `/terms` — Legal pages
- `/api/health` — Health check
- `/api/webhook/stripe` — HMAC-verified Stripe webhooks

---

## Database Architecture

### What the Database Is

Nexus uses **PostgreSQL** hosted on **Supabase**. All database access goes through **Prisma ORM** — a type-safe query builder that auto-generates TypeScript types from the schema. The database is never accessed directly from the browser.

### Schema Overview

- **41 models** — every concept in the app (boards, cards, users, labels, sprints, analytics, templates, etc.) has its own table
- **13 enums** — fixed value sets used across the schema: `BoardRole`, `BoardPermission`, `Priority`, `ACTION`, `ENTITY_TYPE`, `SprintStatus`, and more
- **All primary keys are CUID strings** — e.g. `clx1a2b3c4d5e6f7g8h` — not auto-incremented integers
  - CUIDs are collision-resistant, URL-safe, and do not expose creation order to attackers
- **Two database connections are configured:**
  - `DATABASE_URL` → PgBouncer pooler on port **6543** — used by the app for all reads and writes; handles high concurrency efficiently
  - `DIRECT_URL` → direct PostgreSQL on port **5432** — used only by Prisma Migrate when running schema migrations
- **Row-Level Security (RLS)** is enabled — the app sets a PostgreSQL session variable `app.current_org_id` on every connection; RLS policies filter all rows by this variable at the database engine level, so even a misconfigured app query cannot read another tenant's data
- **A separate `systemDb` Prisma client bypasses RLS** — used only for trusted internal operations: Stripe webhooks, cron jobs, and admin seeding
- **Cascade deletes are configured carefully:**
  - Deleting a Board cascades to: Lists → Cards → Comments → Attachments → Checklists → ChecklistItems → BoardMembers → Sprints → Epics → SavedViews → MembershipRequests
  - Deleting an Organization does **not** cascade automatically — this is an intentional safety guard to prevent accidental data loss
- **JSON columns** are used where flexibility is needed — automation triggers/conditions/actions, webhook payloads, and audit log before/after snapshots are all stored as JSON
- **Denormalized user fields** — `Comment` and `AuditLog` store `userName` and `userImage` directly in the row so historical records remain accurate even if a user changes their name or profile picture later

### Core Entity Relationship Diagram

> **How to read this diagram:**
> - `||--o{` means "one-to-many" — for example one Organization contains many Boards
> - `||--||` means "one-to-one" — for example one User has exactly one UserPreference
> - `}o--o|` means "many-to-optional-one" — for example many Boards can optionally use one PermissionScheme

**Plain English walkthrough of every relationship:**

- **Organization → Board** — Every board belongs to exactly one organization. An organization can have many boards (up to 50 on FREE plan, unlimited on PRO).
- **Organization → OrganizationUser** — This is the membership table. It records which users are members of which organization, and their role (OWNER / ADMIN / MEMBER / GUEST).
- **Organization → Label** — Labels (coloured tags applied to cards) are defined at the organization level and shared across all boards in that org.
- **Organization → Automation** — Automation rules ("when X happens, do Y") are set up per organization.
- **Organization → Webhook** — Outbound HTTP webhooks are registered per organization. When events happen, Nexus sends signed HTTP POST requests to the configured URLs.
- **Organization → ApiKey** — API keys for the public REST API are issued per organization.
- **Organization → PermissionScheme** — Custom permission schemes can be created per organization and then applied to individual boards or members.
- **Organization → MembershipRequest** — When someone requests to join the organization, a record is created here.
- **Organization → Initiative** — High-level strategic initiatives that group multiple epics together.
- **Organization → Notification** — In-app notifications sent to org members.
- **User → OrganizationUser** — A user can be a member of multiple organizations (through multiple OrganizationUser rows).
- **User → BoardMember** — A user can be a member of multiple boards.
- **User → Card** — Cards can be assigned to a user (the assignee).
- **User → TimeLog** — Users log their time spent working on cards.
- **User → ApiKey** — Each API key is owned by a specific user.
- **User → UserPreference** — One-to-one settings record per user: theme preference, notification settings, etc.
- **Board → List** — A board contains multiple lists (Kanban columns like "To Do", "In Progress", "Done").
- **Board → BoardMember** — Tracks which users have access to a specific board and their role on that board.
- **Board → Sprint** — Boards can have sprints for Scrum-style time-boxed work.
- **Board → BoardShare** — Public share links for guest access are stored here with expiry and password.
- **Board → Epic** — Large features or themes that group related cards together.
- **Board → SavedView** — Users can save filter combinations (e.g. "My high priority cards") as named views.
- **Board → MembershipRequest** — Users can request access to a specific board.
- **Board ↔ PermissionScheme** — A board can optionally be linked to a custom permission scheme that overrides the default role matrix.
- **List → Card** — Each list contains multiple cards. Cards are ordered by their `order` field (LexoRank string).
- **Card → Comment** — Cards have threaded comments. Each comment is a rich-text entry made by a user.
- **Card → Attachment** — Files uploaded to a card are stored in Supabase Storage; the Attachment record holds the URL, filename, size, and uploader.
- **Card → Checklist** — A card can have multiple named checklists, each containing multiple checkbox items.
- **Card → CardLabelAssignment** — Labels are applied to cards through this join table (many-to-many between Card and Label).
- **Card → TimeLog** — Individual time log entries per card per user.
- **Card → CardDependency** — Links between cards: "this card blocks that card", "this card is blocked by that card", or "related".
- **Card ↔ Sprint** — A card can optionally be placed inside a sprint.
- **Card ↔ Epic** — A card can optionally belong to an epic.
- **Label → CardLabelAssignment** — Each label can be applied to many cards.
- **Checklist → ChecklistItem** — Each checklist has multiple items; each item has a `completed` boolean.
- **Comment → CommentReaction** — Emoji reactions on comments (like Slack reactions).
- **Comment → Comment** — Comments can have replies (self-referential relationship).
- **PermissionScheme → PermissionSchemeEntry** — Each scheme has multiple entries, each mapping a role to a specific permission.
- **Automation → AutomationLog** — Every time an automation rule runs, a log entry is created with the result.
- **Webhook → WebhookDelivery** — Every outbound webhook request is logged with the HTTP status, response body, and timing.
- **Initiative → Epic** — An initiative groups multiple epics (cross-board strategic planning).

```mermaid
erDiagram
    Organization ||--o{ Board : "contains"
    Organization ||--o{ OrganizationUser : "has members"
    Organization ||--o{ Label : "defines"
    Organization ||--o{ Automation : "configures"
    Organization ||--o{ Webhook : "registers"
    Organization ||--o{ ApiKey : "issues"
    Organization ||--o{ PermissionScheme : "defines"
    Organization ||--o{ MembershipRequest : "receives"
    Organization ||--o{ Initiative : "plans"
    Organization ||--o{ Notification : "sends"

    User ||--o{ OrganizationUser : "belongs to"
    User ||--o{ BoardMember : "participates in"
    User ||--o{ Card : "assigned to"
    User ||--o{ TimeLog : "logs time"
    User ||--o{ ApiKey : "owns"
    User ||--|| UserPreference : "has"

    Board ||--o{ List : "contains"
    Board ||--o{ BoardMember : "has members"
    Board ||--o{ Sprint : "plans"
    Board ||--o{ BoardShare : "shared via"
    Board ||--o{ Epic : "tracks"
    Board ||--o{ SavedView : "saves"
    Board ||--o{ MembershipRequest : "receives"
    Board }o--o| PermissionScheme : "uses"

    List ||--o{ Card : "contains"

    Card ||--o{ Comment : "has"
    Card ||--o{ Attachment : "has"
    Card ||--o{ Checklist : "has"
    Card ||--o{ CardLabelAssignment : "labeled with"
    Card ||--o{ TimeLog : "tracks"
    Card ||--o{ CardDependency : "depends on"
    Card }o--o| Sprint : "in sprint"
    Card }o--o| Epic : "in epic"

    Label ||--o{ CardLabelAssignment : "applied to"
    Checklist ||--o{ ChecklistItem : "contains"
    Comment ||--o{ CommentReaction : "reacted with"
    Comment ||--o{ Comment : "replies"
    PermissionScheme ||--o{ PermissionSchemeEntry : "defines"
    Automation ||--o{ AutomationLog : "logs"
    Webhook ||--o{ WebhookDelivery : "delivers"
    Initiative ||--o{ Epic : "contains"
```

### Database Schema — Every Model Explained

Below is every model in the database with a plain English description of each field and why it exists.

---

#### `Organization`
Represents a company or team workspace. Everything in the app is scoped to an organization.

| Field | Type | Description |
|---|---|---|
| `id` | CUID string | Unique ID, never exposed as a sequential number |
| `name` | String | Display name shown in the UI (e.g. "Acme Corp") |
| `slug` | String (unique) | URL-friendly identifier (e.g. `acme-corp`) |
| `region` | String | Data residency region selected at creation |
| `subscriptionPlan` | Enum | `FREE` or `PRO` — controls feature limits |
| `stripeCustomerId` | String? | Stripe's ID for this customer (set after first checkout) |
| `stripeSubscriptionId` | String? | Active Stripe subscription ID |
| `currentPeriodEnd` | DateTime? | When the current billing period ends |
| `aiCallsToday` | Int | Counter reset daily — enforces per-org AI usage limits |
| `createdAt` | DateTime | When the org was created |

---

#### `User`
A real person who has signed in. Created automatically the first time a Clerk user accesses the app.

| Field | Type | Description |
|---|---|---|
| `id` | CUID string | Internal user ID used for all DB relations |
| `clerkUserId` | String (unique) | The `userId` from Clerk's JWT — used to link Clerk sessions to this record |
| `email` | String (unique) | User's email address |
| `name` | String | Display name |
| `imageUrl` | String | Profile photo URL (from Clerk / OAuth provider) |
| `createdAt` | DateTime | When the account was first created in Nexus |

---

#### `OrganizationUser`
The join table between a User and an Organization. A user can be a member of multiple orgs.

| Field | Type | Description |
|---|---|---|
| `id` | CUID string | Row ID |
| `userId` | FK → User | Which user this membership is for |
| `orgId` | FK → Organization | Which organization this membership is in |
| `role` | OrgRole | `OWNER` / `ADMIN` / `MEMBER` / `GUEST` |
| `isActive` | Boolean | `false` = suspended; these users are rejected at the auth gate |
| `status` | Enum | `ACTIVE` / `SUSPENDED` / `PENDING` |
| `joinedAt` | DateTime | When they joined |

---

#### `Board`
A project workspace with multiple lists and cards inside it.

| Field | Type | Description |
|---|---|---|
| `id` | CUID string | Board ID (used in the URL: `/board/[boardId]`) |
| `orgId` | FK → Organization | Which org this board belongs to — every query is scoped by this |
| `title` | String | Board name shown at the top |
| `isPrivate` | Boolean | If `true`, only explicitly added members can see it — org admins cannot see it unless added |
| `imageFullUrl` | String? | Full-resolution Unsplash background image |
| `imageThumbUrl` | String? | Thumbnail used for board cards on the dashboard |
| `imageUserName` | String? | Unsplash photographer name (attribution requirement) |
| `permissionSchemeId` | FK? → PermissionScheme | Optional custom permission override for this board |
| `createdById` | FK → User | Who created this board |
| `createdAt` | DateTime | Creation timestamp |

---

#### `List`
A single column in Kanban view (e.g. "To Do", "In Progress", "Done").

| Field | Type | Description |
|---|---|---|
| `id` | CUID string | List ID |
| `boardId` | FK → Board | Which board this column belongs to |
| `title` | String | Column name — editable in-place |
| `order` | String | LexoRank string (e.g. `"m"`) — determines left-to-right column position |
| `createdAt` | DateTime | Creation timestamp |

---

#### `Card`
The core work item in the app — equivalent to a Jira issue or Trello card.

| Field | Type | Description |
|---|---|---|
| `id` | CUID string | Card ID |
| `listId` | FK → List | Which list/column this card currently lives in |
| `assigneeId` | FK? → User | The person assigned to work on this card |
| `title` | String | Short title of the card |
| `description` | String? | Rich text content (stored as HTML/JSON from TipTap editor) |
| `order` | String | LexoRank string — determines vertical position within a list |
| `priority` | Priority enum | `LOW` / `MEDIUM` / `HIGH` / `URGENT` — shown as a coloured accent bar |
| `dueDate` | DateTime? | Optional deadline — cards turn red when overdue |
| `storyPoints` | Int? | Effort estimate for sprint planning |
| `sprintId` | FK? → Sprint | Optional sprint assignment |
| `epicId` | FK? → Epic | Optional epic assignment |
| `isArchived` | Boolean | Archived cards are hidden from normal view but not deleted |
| `coverImage` | String? | URL of a cover photo shown at the top of the card |
| `coverColor` | String? | Hex color for a solid color cover |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Last modified timestamp |

---

#### `BoardMember`
Gate 2 of access control — explicitly tracks who has access to each board.

| Field | Type | Description |
|---|---|---|
| `id` | CUID string | Row ID |
| `boardId` | FK → Board | The board being accessed |
| `userId` | FK → User | The user who has access |
| `orgId` | String | Denormalized org ID for fast scoped queries |
| `role` | BoardRole | `OWNER` / `ADMIN` / `MEMBER` / `VIEWER` |
| `permissionSchemeId` | FK? → PermissionScheme | Optional per-member custom permissions |
| `joinedAt` | DateTime | When access was granted |

---

#### `Sprint`
A time-boxed period of work for Scrum teams.

| Field | Type | Description |
|---|---|---|
| `id` | CUID string | Sprint ID |
| `boardId` | FK → Board | Which board this sprint belongs to |
| `name` | String | Sprint name (e.g. "Sprint 4") |
| `goal` | String? | Optional sprint goal description |
| `startDate` | DateTime? | Sprint start date |
| `endDate` | DateTime? | Sprint end date |
| `status` | SprintStatus | `PLANNING` / `ACTIVE` / `COMPLETED` |
| `velocity` | Int? | Story points completed — calculated on completion |

---

#### `Epic`
A large feature or theme that groups multiple related cards.

| Field | Type | Description |
|---|---|---|
| `id` | CUID string | Epic ID |
| `boardId` | FK → Board | Which board this epic lives in |
| `initiativeId` | FK? → Initiative | Optional link to a higher-level initiative |
| `title` | String | Epic name |
| `color` | String | Color used in Gantt and roadmap views |
| `startDate` | DateTime? | Planned start |
| `endDate` | DateTime? | Planned end |
| `status` | EpicStatus | `PLANNED` / `IN_PROGRESS` / `COMPLETED` |

---

#### `Comment`
Rich-text comment on a card. Supports threading (replies) and emoji reactions.

| Field | Type | Description |
|---|---|---|
| `id` | CUID string | Comment ID |
| `cardId` | FK → Card | Which card this comment is on |
| `userId` | FK → User | Who wrote it |
| `userName` | String | Denormalized — preserved even if user changes display name |
| `userImage` | String | Denormalized — preserved even if user changes avatar |
| `content` | String | Rich-text HTML from TipTap editor |
| `parentId` | FK? → Comment | If this is a reply, points to the parent comment |
| `isEdited` | Boolean | Shown as "(edited)" in the UI if `true` |
| `createdAt` | DateTime | Timestamp |

---

#### `Attachment`
A file uploaded to a card, stored in Supabase Storage.

| Field | Type | Description |
|---|---|---|
| `id` | CUID string | Attachment ID |
| `cardId` | FK → Card | Which card this file belongs to |
| `uploadedById` | FK → User | Who uploaded it |
| `name` | String | Original filename |
| `url` | String | Supabase Storage URL |
| `size` | Int | File size in bytes |
| `mimeType` | String | MIME type (e.g. `image/png`, `application/pdf`) |
| `createdAt` | DateTime | Upload timestamp |

---

#### `Checklist` and `ChecklistItem`
A named to-do list inside a card.

| Field | Type | Description |
|---|---|---|
| `Checklist.title` | String | Name of the checklist (e.g. "Acceptance Criteria") |
| `ChecklistItem.title` | String | The individual to-do item |
| `ChecklistItem.completed` | Boolean | Whether the item has been ticked |
| `ChecklistItem.order` | String | LexoRank ordering within the checklist |

---

#### `Label`
Coloured tag applied to cards to categorize or filter them.

| Field | Type | Description |
|---|---|---|
| `id` | CUID string | Label ID |
| `orgId` | FK → Organization | Labels are shared across all boards in an org |
| `name` | String | Label text (e.g. "Bug", "Feature") |
| `color` | String | Hex color (e.g. `#E53E3E`) |

---

#### `AuditLog`
Immutable record of every significant action taken in the system.

| Field | Type | Description |
|---|---|---|
| `id` | CUID string | Log entry ID |
| `orgId` | FK → Organization | Tenant scope |
| `boardId` | FK? → Board | Board context (nullable for org-level actions) |
| `userId` | FK → User | Who performed the action |
| `userName` | String | Denormalized name (preserved historically) |
| `userImage` | String | Denormalized avatar |
| `action` | ACTION enum | What happened (e.g. `CARD_CREATED`, `MEMBER_REMOVED`) |
| `entityType` | ENTITY_TYPE enum | What type of thing was affected (e.g. `CARD`, `BOARD`, `USER`) |
| `entityId` | String | The ID of the affected thing |
| `entityTitle` | String | Name/title of the affected thing at time of action |
| `ipAddress` | String | Client IP address |
| `userAgent` | String | Browser/client info |
| `previousValues` | Json | Snapshot of the record before the change |
| `newValues` | Json | Snapshot of the record after the change |
| `createdAt` | DateTime | When the action happened |

---

#### `PermissionScheme` and `PermissionSchemeEntry`
Allows overriding the default role-to-permission mapping per board or per member.

| Field | Type | Description |
|---|---|---|
| `PermissionScheme.name` | String | Human-readable name (e.g. "Read-only clients") |
| `PermissionSchemeEntry.role` | BoardRole | The role this entry applies to |
| `PermissionSchemeEntry.permission` | Permission enum | The specific permission being granted or denied |
| `PermissionSchemeEntry.granted` | Boolean | `true` = allow, `false` = deny |

---

#### `Automation` and `AutomationLog`
If-then rules that run automatically when card events fire.

| Field | Type | Description |
|---|---|---|
| `Automation.trigger` | Json | What causes the rule to run (e.g. `{"type": "CARD_MOVED", "listId": "..."}`) |
| `Automation.conditions` | Json | Optional filters to narrow when the rule applies |
| `Automation.actions` | Json | What to do when triggered (e.g. assign a member, add a label) |
| `Automation.isActive` | Boolean | Enable/disable the rule without deleting it |
| `AutomationLog.status` | String | `SUCCESS` or `FAILED` |
| `AutomationLog.error` | String? | Error message if the automation failed |

---

#### `Webhook` and `WebhookDelivery`
Outbound HTTP notifications sent to external URLs when events happen.

| Field | Type | Description |
|---|---|---|
| `Webhook.url` | String | The HTTPS endpoint to send events to |
| `Webhook.secret` | String | Per-webhook HMAC secret for signing each request |
| `Webhook.events` | String[] | List of event types subscribed to |
| `Webhook.isActive` | Boolean | Can be paused without deleting |
| `WebhookDelivery.status` | Int | HTTP response status code |
| `WebhookDelivery.responseBody` | String | First 2000 chars of the response body |
| `WebhookDelivery.duration` | Int | Round-trip time in milliseconds |
| `WebhookDelivery.nextRetryAt` | DateTime? | Set if delivery failed and retry is scheduled |

---

#### `ApiKey`
Programmatic access tokens for the public REST API.

| Field | Type | Description |
|---|---|---|
| `id` | CUID string | Key ID |
| `orgId` | FK → Organization | Which org this key belongs to |
| `userId` | FK → User | Who created the key |
| `name` | String | Friendly name (e.g. "CI/CD pipeline") |
| `keyHash` | String | SHA-256 hash of the actual key — plaintext is never stored |
| `prefix` | String | First 8 chars of the key (e.g. `nxk_a1b2`) shown in UI for identification |
| `scopes` | String[] | List of permissions (e.g. `["boards:read", "cards:write"]`) |
| `expiresAt` | DateTime? | Optional expiry date |
| `lastUsedAt` | DateTime? | Updated on every API call |
| `totalRequests` | Int | Lifetime usage counter |

---

#### `UserPreference`
Per-user settings stored in the database.

| Field | Type | Description |
|---|---|---|
| `userId` | FK → User (unique) | One preference record per user |
| `theme` | String | `"dark"` or `"light"` |
| `emailNotifications` | Boolean | Whether to receive email summaries |
| `pushNotifications` | Boolean | Whether browser push is enabled |
| `digestFrequency` | String | `"daily"` / `"weekly"` / `"never"` |

---

#### `ProcessedStripeEvent`
Idempotency table that prevents duplicate Stripe webhook events from being processed twice.

| Field | Type | Description |
|---|---|---|
| `id` | CUID string | Row ID |
| `stripeEventId` | String (unique) | The Stripe event ID (e.g. `evt_1...)`) — `UNIQUE` constraint stops double-processing |
| `eventType` | String | The Stripe event type (e.g. `checkout.session.completed`) |
| `processedAt` | DateTime | When the event was first processed |

When a Stripe event arrives, the handler attempts to `INSERT` a row before the `switch` statement. If a row already exists (duplicate delivery → Prisma `P2002` error), the handler returns HTTP 200 immediately without re-running business logic. This is an additional safety layer on top of the 300-second staleness check — it handles retries delivered within the staleness window.

---

### Database Design Decisions

- **CUID primary keys** — CUIDs look like `clx1a2b3c4d` — they are random enough to be unguessable, safe to expose in URLs, and work in distributed environments without a central sequence counter
- **LexoRank `order` field** — Cards and lists are sorted by a string like `"m"` or `"nt"` instead of integers. Moving a card only requires updating that one card's `order` string — no other rows are touched regardless of how many items are in the list
- **Denormalized user fields on Comment + AuditLog** — Storing `userName` and `userImage` directly in those rows means historical records stay accurate even after a user renames themselves or changes avatar. No join required either, which speeds up the activity feed.
- **JSON columns** — `Automation.trigger/conditions/actions`, `WebhookDelivery.payload`, and `AuditLog.previousValues/newValues` use JSON because their shape varies by use case — using JSON avoids dozens of extra tables for each automation trigger type or action type
- **Cascade deletes (Board → List → Card → …)** — Deleting a board automatically cleans up all child records so no orphaned data is left behind. The cascade chain is: Board → Lists → Cards → (Comments, Attachments, Checklists, Labels, TimeLogs, Dependencies, BoardMembers, Sprints, Epics, SavedViews)
- **Organization deletion is NOT cascaded** — Deleting an org is a rare, irreversible action. Nexus requires explicit cleanup to prevent accidental mass data loss from a single API call
- **Separate `systemDb` for trusted operations** — Stripe webhooks and cron jobs use a Prisma client that bypasses Row-Level Security. This is intentional — these processes need to read/write across tenant boundaries, but they authenticate via HMAC signatures and cron secrets rather than Clerk JWTs

---

## Drag & Drop System

### LexoRank Ordering — How It Works

LexoRank is a string-based ordering system. Implementation lives in `lib/lexorank.ts`.

- Items are ordered lexicographically: `"m"` < `"n"` < `"o"`
- **`generateNextOrder(lastOrder)`** — appends the next character: `"m"` → `"n"` → ... → `"z"` → `"za"` → `"zb"`
- **`generateMidpointOrder(before, after)`** — calculates a midpoint string for mid-list insertions
- **`rebalanceOrders(items)`** — resets all items to clean values when strings grow too long

**Why not integer ordering?**
Moving a card to position 3 in a 100-item list requires updating all items at positions 3–100. LexoRank only updates the moved card.

**Why not fractional indexing?**
After ~50 moves between the same two positions, floating-point precision degrades and causes ordering bugs. LexoRank strings can always generate a valid midpoint.

### Drag & Drop End-to-End Flow

```
1. User starts dragging a card (via @dnd-kit DragOverlay)
        │
2. Optimistic UI update fires immediately
   └── use-optimistic-card hook updates local state before server responds
        │
3. User drops card in new position
        │
4. LexoRank calculates new order string based on neighbors
        │
5. Server Action fires: update-card-order
   └── Validates input (Zod)
   └── getTenantContext() checks auth + permissions
   └── Prisma updates Card.order in DB (one row)
        │
6. emitCardEvent() fires
   └── Automation engine evaluates matching rules
   └── Webhooks fire (HMAC-signed)
        │
7. Supabase postgres_changes broadcasts update to all connected clients
        │
8. Other users see the card move in real time via use-realtime-board hook
```

---

## Real-Time System

### Architecture

Supabase is used **exclusively** for its Realtime WebSocket engine. All database reads and writes go through Prisma only.

### Channel Map

| Channel Pattern | Purpose | Hook |
|---|---|---|
| `org:{orgId}:board:{boardId}` | Card/list CRUD events | `use-realtime-board` |
| `org:{orgId}:presence:{boardId}` | Online user tracking | `use-presence` |
| `org:{orgId}:analytics:{boardId}` | Live metrics broadcast | `use-realtime-analytics` |
| `org:{orgId}:boards` | Org-wide board list updates | — |
| `org:{orgId}:activity` | Audit log feed | — |

### Card Edit Locking Flow

```
User A opens card for editing
        │
        ├── Broadcasts presence on board channel with cardId
        │
User B views same card
        │
        ├── Receives presence event: "Card locked by User A"
        ├── Edit button disabled
        │
User A closes card
        │
        ├── Presence removed (or disconnects)
        ├── Lock released
        │
User B can now edit
```

A `cancelled` flag in the async setup prevents race conditions during rapid open/close cycles.

### Optimistic Updates

```
User performs action (e.g., adds label)
        │
        ├── useOptimistic updates UI immediately (0ms delay)
        │
Server Action runs in background
        │
        ├── Success → Supabase broadcast confirms the change
        │
        └── Failure → UI rolls back to previous state
```

---

## Payments & Billing

### Plans

| Feature | FREE | PRO |
|---|---|---|
| Price | £0/month | £9/month or £90/year |
| Board limit | 50 | Unlimited |
| All core features | ✓ | ✓ |
| Priority support | — | ✓ |

### Stripe Integration Flow

```
User clicks "Upgrade to Pro"
        │
App creates Stripe Checkout Session (GBP, subscription mode)
        │
User redirected to Stripe Checkout
        │
User enters payment details
        │
Stripe fires: checkout.session.completed
        │
Webhook handler (app/api/webhook/stripe/route.ts)
        ├── Verifies stripe-signature header (HMAC)
        ├── Uses systemDb (bypasses RLS)
        ├── Sets subscriptionPlan = PRO
        └── Saves stripeCustomerId + stripeSubscriptionId
        │
Monthly/Yearly:
        ├── invoice.payment_succeeded → Update currentPeriodEnd
        ├── invoice.payment_failed → Set status = past_due
        └── customer.subscription.deleted → Reset to FREE plan
```

### Webhook Events Handled

| Event | Action |
|---|---|
| `checkout.session.completed` | Set PRO plan, store Stripe IDs |
| `invoice.payment_succeeded` | Update subscription period end |
| `invoice.payment_failed` | Set status to `past_due` |
| `customer.subscription.updated` | Sync status changes |
| `customer.subscription.deleted` | Reset to FREE plan |

---

## API Reference

### Public REST API (v1)

All v1 endpoints require `Authorization: Bearer nxk_your_api_key` with the correct scope.

```bash
curl -H "Authorization: Bearer nxk_your_api_key_here" \
  https://your-nexus-instance.com/api/v1/boards
```

API keys are:
- Hashed with SHA-256 before storage
- Prefixed with `nxk_` for identification
- Scoped per permission (e.g., `boards:read`, `cards:write`)
- Optionally set to expire by date

| Method | Endpoint | Scope | Description |
|---|---|---|---|
| `GET` | `/api/v1/boards` | `boards:read` | List all boards in the organization |
| `POST` | `/api/v1/boards` | `boards:write` | Create a new board |
| `GET` | `/api/v1/boards/[boardId]` | `boards:read` | Get board details with lists |
| `GET` | `/api/v1/cards` | `cards:read` | List cards (filter by boardId, listId, assigneeId, priority) |
| `POST` | `/api/v1/cards` | `cards:write` | Create a card in a list |
| `GET` | `/api/v1/cards/[cardId]` | `cards:read` | Get full card details |
| `DELETE` | `/api/v1/cards/[cardId]` | `cards:write` | Delete a card |

### Internal API Routes

All internal routes use Clerk session (cookie) authentication.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check: DB connectivity, build info, response time |
| `GET` | `/api/health/shards` | Shard health map (Bearer `CRON_SECRET`) — returns per-shard status with HTTP 200 (all healthy), 207 (partial), or 503 (all down) |
| `POST` | `/api/ai` | AI completion and analysis |
| `POST` | `/api/import` | Board/card import |
| `GET` | `/api/export/[boardId]` | Board export (JSON/CSV) |
| `GET` | `/api/audit-logs` | Fetch audit trail |
| `POST` | `/api/upload` | File upload to Supabase Storage |
| `DELETE` | `/api/upload` | File deletion |
| `GET` | `/api/attachment` | Attachment retrieval |
| `GET` | `/api/boards` | List organization boards |
| `GET` | `/api/boards/requestable` | Boards available for access request |
| `POST` | `/api/members` | Invite organization members |
| `GET` | `/api/members` | List organization members |
| `POST` | `/api/membership-requests` | Create org/board access request |
| `GET` | `/api/membership-requests/mine` | Current user's pending requests |
| `GET` | `/api/cards/search` | Full-text card search |
| `GET` | `/api/unsplash` | Unsplash image search proxy |
| `GET` | `/api/tenor/featured` | Featured GIFs |
| `GET` | `/api/tenor/search` | GIF search |
| `POST` | `/api/integrations/github` | GitHub integration webhook |
| `POST` | `/api/integrations/slack` | Slack integration webhook |
| `POST` | `/api/stripe/checkout` | Create Stripe Checkout session |
| `POST` | `/api/stripe/portal` | Create Stripe Customer Portal session |
| `POST` | `/api/webhook/stripe` | Stripe webhook receiver (HMAC-verified) |
| `POST` | `/api/push/subscribe` | Register push notification subscription |
| `POST` | `/api/push/send` | Send push notification |
| `POST` | `/api/gdpr/export` | Export user data (GDPR Article 20) |
| `POST` | `/api/gdpr/delete-request` | Request account deletion (GDPR Article 17) |
| `POST` | `/api/admin/seed-templates` | Seed board templates (admin only) |
| `POST` | `/api/cron/daily-reports` | Daily report generation (Vercel Cron, 9 AM UTC) |
| `GET` | `/api/realtime-auth` | Pre-flight board membership check before Supabase channel subscription (`?boardId=<id>`) |

---

## Server Actions

All server actions follow the `createSafeAction` pattern from `lib/create-safe-action.ts`:
1. Input validated by Zod schema
2. `getTenantContext()` resolves auth and tenant
3. Permission check against RBAC matrix
4. Database mutation (Prisma, scoped to `orgId`)
5. `emitCardEvent()` triggers automations and webhooks
6. `createAuditLog()` records the action

**40 server actions across these domains:**

| Domain | Action Files |
|---|---|
| Board | `create-board.ts`, `update-board.ts`, `delete-board.ts` |
| Card | `create-card.ts`, `update-card.ts`, `delete-card.ts`, `update-card-order.ts` |
| List | `create-list.ts`, `update-list.ts`, `delete-list.ts`, `update-list-order.ts` |
| Members | `board-member-actions.ts` |
| Permissions | `permission-scheme-actions.ts` |
| Membership | `membership-request-actions.ts` |
| Sharing | `board-share-actions.ts` |
| Automations | `automation-actions.ts` |
| AI | `ai-actions.ts` |
| Sprints | `sprint-actions.ts` |
| Roadmap | `roadmap-actions.ts` |
| Time Tracking | `time-tracking-actions.ts` |
| Custom Fields | `custom-field-actions.ts` |
| Webhooks | `webhook-actions.ts` |
| API Keys | `api-key-actions.ts` |
| Notifications | `notification-actions.ts` |
| Bulk Operations | `phase3-bulk-actions.ts` |
| Import/Export | `import-export-actions.ts` |
| Templates | `template-actions.ts` |
| Saved Views | `saved-view-actions.ts` |

---

## Custom Hooks

| Hook | Purpose |
|---|---|
| `use-realtime-board` | Supabase WebSocket subscription — live card/list/comment/reaction updates; includes 2-second per-card drag-race suppression window via `markLocalCardUpdate()` |
| `use-presence` | Online user tracking on a board — avatar colors, join/leave events |
| `use-card-lock` | Prevents concurrent card edits — broadcasts lock state via presence channel |
| `use-card-modal` | Zustand store — centralized card modal open/close/view/edit mode state |
| `use-keyboard-shortcuts` | Global keyboard listener — modifier key support, ignores input field focus |
| `use-debounce` | Debounces a value or callback — used for auto-save and search inputs |
| `use-optimistic-card` | React `useOptimistic` wrapper for instant label add/remove on cards |
| `use-push-notifications` | Web Push registration via Service Worker and PushManager API |
| `use-realtime-analytics` | Live analytics via Supabase broadcast — card created/completed/deleted events |
| `use-demo-mode` | Guest demo mode detection, read-only enforcement, session tracking |
| `use-ai-cooldown` | Per-button 10-second client-side cooldown for AI trigger actions — countdown display, independent per component instance, cleans up timers on unmount |

---

## Component Library

### Board Components (28 files)

| Component | Description |
|---|---|
| `board-header.tsx` | Title bar, back navigation, share dialog, settings dropdown |
| `board-tabs.tsx` | Main tabbed view switcher (Board/Calendar/Table/Gantt/Workload) |
| `list-container.tsx` | DnD context container managing drag-and-drop of lists and cards |
| `list-item.tsx` | Individual sortable list column with card creation and AI suggestions |
| `card-item.tsx` | Draggable card with priority badge, due date, bulk selection |
| `calendar-view.tsx` | Month/week/day calendar displaying cards by due date |
| `gantt-view.tsx` | Timeline chart with priority bars, today line, zoom levels |
| `table-view.tsx` | Sortable spreadsheet view of all cards |
| `workload-view.tsx` | Team workload visualization per assignee |
| `filter-bar.tsx` | Multi-criteria filter (assignee, label, priority, date, search) |
| `sprint-panel.tsx` | Sprint management with create/start/complete and burndown |
| `share-board-dialog.tsx` | Public share links with expiry, password, view count |
| `checklist-panel.tsx` | Checklist management with AI-suggested items |
| `custom-fields-panel.tsx` | Custom field types: text, number, date, checkbox, select, URL, email, phone |
| `dependency-panel.tsx` | Card dependencies (blocks/blocked-by/related) |
| `time-tracking-panel.tsx` | Time logs, estimates, progress visualization |
| `bulk-action-bar.tsx` | Floating bar for batch operations on selected cards |
| `online-users.tsx` | Avatar row of currently online board members |

### Card Modal (6 sub-components)

| Component | Description |
|---|---|
| `card-modal/index.tsx` | Main card detail view/edit modal |
| `card-modal/activity.tsx` | Audit log and activity timeline |
| `card-modal/attachments.tsx` | File attachments tab |
| `card-modal/checklists.tsx` | Checklists with AI item generation |
| `card-modal/cover.tsx` | Cover image/color picker |
| `card-modal/dependencies.tsx` | Card dependency management |

### Editor Components (7 files)

| Component | Description |
|---|---|
| `editor-toolbar.tsx` | Rich-text formatting toolbar |
| `emoji-picker.tsx` | Emoji picker popover |
| `gif-picker.tsx` | Tenor GIF search and insertion |
| `link-popover.tsx` | Hyperlink insert/edit/remove |
| `mention-list.tsx` | @mention dropdown for TipTap |
| `mention-suggestion.ts` | Mention suggestion factory |
| `toolbar-button.tsx` | Reusable toolbar button with tooltip |

### Analytics Components (3 files)

| Component | Description |
|---|---|
| `analytics-dashboard.tsx` | Board metrics with real-time updates and charts |
| `advanced-analytics.tsx` | Burndown, velocity, label distribution, multi-tab view |
| `export-pdf.tsx` | PDF export using jsPDF + autoTable |

### Settings Components (3 files)

| Component | Description |
|---|---|
| `api-keys-settings.tsx` | API key CRUD — create, revoke, copy, view usage |
| `automation-builder.tsx` | Visual automation rule builder with trigger/action config |
| `webhooks-settings.tsx` | Webhook endpoint management with delivery logs |

### UI Primitives (shadcn/ui — 24 components)

`alert-dialog`, `avatar`, `badge`, `button`, `card`, `checkbox`, `collapsible`, `command`, `dialog`, `dropdown-menu`, `input`, `label`, `popover`, `progress`, `scroll-area`, `select`, `separator`, `skeleton`, `switch`, `tabs`, `textarea`, `toaster`, `tooltip`, `visually-hidden`

---

## Email Templates

Located in `nexus/emails/`:

| Template | Description |
|---|---|
| `_base.ts` | Base layout and shared styles |
| `assigned.ts` | You've been assigned to a card |
| `digest.ts` | Daily/weekly activity digest |
| `due-soon.ts` | Due date approaching reminder |
| `invite.ts` | Board or org invitation |
| `mention.ts` | @mention in a comment or description |

---

## File System Structure

```
nexus/
├── actions/                         # 40 server actions (createSafeAction pattern)
│   ├── create-board.ts
│   ├── create-card.ts
│   ├── create-list.ts
│   ├── update-card-order.ts         # LexoRank reordering
│   ├── board-member-actions.ts
│   ├── permission-scheme-actions.ts
│   ├── membership-request-actions.ts
│   ├── board-share-actions.ts
│   ├── automation-actions.ts
│   ├── ai-actions.ts
│   ├── sprint-actions.ts
│   ├── roadmap-actions.ts
│   ├── time-tracking-actions.ts
│   ├── custom-field-actions.ts
│   ├── webhook-actions.ts
│   ├── api-key-actions.ts
│   ├── schema.ts                    # Shared Zod validation schemas
│   └── ...                          # 20+ more
│
├── app/
│   ├── api/
│   │   ├── v1/                      # Public REST API (API key auth)
│   │   │   ├── boards/
│   │   │   └── cards/
│   │   ├── stripe/                  # Checkout + portal
│   │   ├── webhook/stripe/          # Stripe webhook handler
│   │   ├── health/
│   │   │   └── shards/              # GET /api/health/shards — per-shard status map (200/207/503)
│   │   ├── ai/
│   │   ├── audit-logs/
│   │   ├── integrations/            # GitHub + Slack
│   │   ├── gdpr/                    # Export + deletion
│   │   ├── cron/                    # Scheduled jobs
│   │   └── ...                      # Upload, search, push, media
│   │
│   ├── board/[boardId]/             # Board views
│   │   └── settings/
│   ├── dashboard/
│   ├── onboarding/
│   ├── settings/
│   │   ├── api-keys/
│   │   ├── automations/
│   │   ├── gdpr/
│   │   ├── integrations/
│   │   └── webhooks/
│   ├── billing/
│   ├── activity/
│   ├── roadmap/
│   ├── search/
│   ├── shared/[token]/              # Public guest view
│   ├── sign-in/[[...sign-in]]/
│   ├── sign-up/[[...sign-up]]/
│   ├── select-org/
│   ├── privacy/
│   ├── terms/
│   ├── layout.tsx
│   └── error.tsx
│
├── components/
│   ├── board/                       # 28 board UI components
│   ├── modals/
│   │   ├── card-modal/              # 6 sub-components
│   │   └── pro-upgrade-modal.tsx
│   ├── ui/                          # 24 shadcn/ui primitives
│   ├── layout/                      # Sidebar, mobile nav, notifications
│   ├── editor/                      # 7 rich text components
│   ├── settings/                    # 3 settings components
│   ├── analytics/                   # 3 chart components
│   ├── providers/                   # Clerk, modals, toast
│   ├── accessibility/               # ARIA live regions
│   └── ...                          # Theme, billing, command palette, etc.
│
├── hooks/                           # 11 custom React hooks
│   ├── use-realtime-board.ts
│   ├── use-presence.ts
│   ├── use-card-lock.ts
│   ├── use-card-modal.ts
│   ├── use-keyboard-shortcuts.ts
│   ├── use-debounce.ts
│   ├── use-optimistic-card.ts
│   ├── use-push-notifications.ts
│   ├── use-realtime-analytics.ts
│   ├── use-demo-mode.ts
│   └── use-ai-cooldown.ts
│
├── lib/                             # 38 utility modules
│   ├── db.ts                        # Prisma client (db + systemDb)
│   ├── tenant-context.ts            # Multi-tenant auth resolution
│   ├── board-permissions.ts         # RBAC permission matrix
│   ├── shard-router.ts              # FNV-1a shard router — org→shard hashing, health cache, failover
│   ├── audit-sink.ts                # Axiom append-only forensic audit sink (dual-write via after())
│   ├── step-up-action.ts            # createStepUpAction factory — biometric/TOTP re-verification gate
│   ├── yjs-supabase-provider.ts     # Yjs CRDT transport over Supabase Realtime broadcast
│   ├── rate-limit.ts                # Route-level sliding-window rate limiter (used by /api/ai)
│   ├── action-protection.ts         # Action-level rate limiting + demo guard
│   ├── create-safe-action.ts        # Server action wrapper
│   ├── create-audit-log.ts          # Audit trail + dual-write to Axiom via audit-sink
│   ├── event-bus.ts                 # Card event emission
│   ├── automation-engine.ts         # Automation rule evaluation
│   ├── webhook-delivery.ts          # Outbound webhooks + SSRF protection
│   ├── lexorank.ts                  # String-based ordering
│   ├── api-key-auth.ts              # API key validation
│   ├── realtime-channels.ts         # Tenant-isolated channel names (+ cardYjsChannel)
│   ├── stripe.ts                    # Stripe client + config
│   ├── logger.ts                    # Structured logging + Sentry
│   ├── request-context.ts           # IP + User-Agent extraction
│   ├── supabase/client.ts           # Supabase client factory
│   └── ...                          # DAL, email, utils, design tokens, etc.
│
├── prisma/
│   ├── schema.prisma                # 35 models, 13 enums
│   ├── seed.ts
│   └── migrations/
│
├── __tests__/
│   ├── unit/                        # 47 unit test files
│   │   └── chaos/                   # Chaos Engineering suite — 3 files, 38 tests (SK + AO + NP)
│   ├── integration/                 # 1 integration test file
│   └── a11y/                        # 1 accessibility test file
│
├── e2e/                             # 7 Playwright E2E specs
│   ├── auth.setup.ts
│   ├── auth-user-b.setup.ts
│   ├── boards.spec.ts
│   ├── cards.spec.ts
│   ├── tenant-isolation.spec.ts
│   ├── user-journeys.spec.ts
│   └── chaos.spec.ts                # CE-1-CE-6: shard health, latency injection, reconnect, step-up cancel
│
├── emails/                          # 6 Resend email templates
├── scripts/                         # 6 utility scripts
│   ├── migrate-org-to-shard.ts      # Dual-write org migration (FK-ordered, batched, idempotent)
│   └── test-shard-failover.ts       # 4-step shard failover verification
├── types/                           # TypeScript type definitions
├── public/
│   ├── manifest.json                # PWA manifest
│   ├── sw.js                        # Service Worker
│   ├── icon-192.png
│   └── icon-512.png
│
├── supabase-realtime-rls.sql        # RLS policies for realtime.messages + realtime.subscription
├── supabase-audit-immutability.sql  # BEFORE DELETE OR UPDATE trigger — blocks audit_log mutations for all DB roles
├── proxy.ts                         # Next.js 16 middleware (Clerk auth, route protection, security headers)
├── next.config.ts
├── tailwind.config.ts
├── jest.config.ts
├── playwright.config.ts
├── vercel.json
├── components.json
├── eslint.config.mjs
└── package.json
```

**Codebase summary:**

| Section | Count |
|---|---|
| Components | 100 files |
| Custom Hooks | 10 files |
| Pages | 24 pages |
| API Routes | 33 routes |
| Server Actions | 42 files |
| Lib Modules | 38 files |
| Test Files | 49 files |
| E2E Specs | 7 files |
| Email Templates | 6 files |

---

## Environment Variables

```bash
cp .env.example .env
```

### Required

| Variable | Description | Source |
|---|---|---|
| `DATABASE_URL` | PostgreSQL via PgBouncer (port 6543) | Supabase > Settings > Database |
| `DIRECT_URL` | Direct PostgreSQL (port 5432, migrations only) | Supabase > Settings > Database |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk frontend key | Clerk Dashboard > API Keys |
| `CLERK_SECRET_KEY` | Clerk server key | Clerk Dashboard > API Keys |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Set to `/sign-in` | — |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Set to `/sign-up` | — |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | Set to `/` | — |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | Set to `/` | — |
| `STRIPE_SECRET_KEY` | Stripe server key | Stripe > Developers > API Keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Stripe > Webhooks |
| `NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID` | Monthly plan Price ID (browser) | Stripe > Products |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | Monthly plan Price ID (server) | Stripe > Products |
| `STRIPE_PRO_YEARLY_PRICE_ID` | Yearly plan Price ID (server) | Stripe > Products |
| `NEXT_PUBLIC_APP_URL` | App base URL (`http://localhost:3001` locally) | — |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase > Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Supabase > Settings > API |
| `CRON_SECRET` | Cron job auth secret | `openssl rand -base64 32` |

### Optional

| Variable | Description | Source |
|---|---|---|
| `SENTRY_DSN` | Sentry error tracking DSN | Sentry > Project > DSN |
| `AXIOM_DATASET` | Axiom dataset name for the append-only forensic audit sink (e.g. `nexus-audit-logs`) — set to enable dual-write audit logging | [axiom.co](https://axiom.co) > Datasets |
| `AXIOM_API_KEY` | Axiom **ingest-only** API key (scoped to append, no delete) — a leaked key can add audit events but never erase them | Axiom Dashboard > API Tokens |
| `SHARD_1_DATABASE_URL` | PgBouncer connection string for shard 1 (must include port 6543 and `?pgbouncer=true`) — omit for single-shard mode | Supabase > Additional Projects |
| `SHARD_2_DATABASE_URL` | PgBouncer connection string for shard 2 — add incrementally as you scale | Supabase > Additional Projects |
| `NEXT_PUBLIC_UNSPLASH_ACCESS_KEY` | Unsplash client key | unsplash.com/developers |
| `UNSPLASH_ACCESS_KEY` | Unsplash server key | unsplash.com/developers |
| `RESEND_API_KEY` | Resend email API key | resend.com/api-keys |
| `EMAIL_FROM` | Sender address (must be verified in Resend) | Your domain |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service key for file uploads (`sb_secret_*` format from modern Supabase projects) | Supabase > Settings > API |
| `GIPHY_API_KEY` | Giphy API key | developers.giphy.com |
| `KLIPY_API_KEY` | Alternative GIF provider | klipy.com/developers |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint — enables distributed rate limiting across all Vercel instances | [upstash.com](https://upstash.com) > New Database > REST API |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token — required alongside `UPSTASH_REDIS_REST_URL` | Upstash Console |
| `E2E_EMAIL` | Playwright test account email | Create a test account |
| `E2E_PASSWORD` | Playwright test account password | — |

---

## Getting Started

### Prerequisites

- Node.js 18+ (LTS)
- npm (bundled with Node.js)
- Supabase account — [supabase.com](https://supabase.com) (free tier works)
- Clerk account — [clerk.com](https://clerk.com) (free tier works)
- Stripe account — [stripe.com](https://stripe.com) (test mode)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/viraj1011JAIN/Nexus.git
cd Nexus/nexus

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Fill in all required values (see Environment Variables above)
# Note: SUPABASE_SERVICE_ROLE_KEY uses the modern sb_secret_* format —
#       find it in Supabase Dashboard > Settings > API > service_role key

# 4. Generate Prisma client
npx prisma generate

# 5. Push schema to database
npx prisma db push

# 6. (Optional) Seed demo data
npm run db:seed

# 7. Configure Supabase storage buckets
npm run setup:storage

# 8. Start development server
npm run dev
```

App runs at: `http://localhost:3001`

### Stripe Local Webhook Setup

```bash
# Install Stripe CLI (macOS)
brew install stripe/stripe-cli/stripe

# Install Stripe CLI (Windows)
scoop install stripe

# Log in
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3001/api/webhook/stripe

# Copy the displayed whsec_... secret into STRIPE_WEBHOOK_SECRET in .env
```

### Clerk Setup

1. Create a new application at [dashboard.clerk.com](https://dashboard.clerk.com)
2. Enable **Organizations** under the Configure menu
3. Copy Publishable Key and Secret Key to `.env`
4. Set redirect URLs:
   - Sign-in: `/sign-in`
   - Sign-up: `/sign-up`
   - After sign-in: `/`
   - After sign-up: `/`

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server with Turbopack |
| `npm run build` | Create production build |
| `npm run start` | Start production server |
| `npm run analyze` | Production build with bundle size analysis |
| `npm run lint` | Run ESLint |
| `npm test` | Run Jest in watch mode |
| `npm run test:ci` | Run all tests with coverage (CI mode) |
| `npm run test:unit` | Run unit tests only |
| `npm run test:integration` | Run integration tests only |
| `npm run db:seed` | Seed database with demo data |
| `npm run setup:storage` | Configure Supabase Storage buckets |
| `npx prisma generate` | Regenerate Prisma client after schema changes |
| `npx prisma db push` | Push schema changes to database (dev) |
| `npx prisma migrate deploy` | Apply migrations (production) |
| `npx prisma studio` | Open Prisma Studio database browser |

---

## Testing

### Test Metrics

| Metric | Value |
|---|---|
| Unit test files | 49 |
| Unit tests passing | 1,449 / 1,449 |
| E2E test specs | 7 |
| Files with coverage | 241 |
| Statement coverage | ~19.5% |
| Test runner | Jest 30 + ts-jest |
| E2E runner | Playwright 1.58 |

> Coverage is intentionally focused on critical business logic paths — security, auth, billing, and data integrity — rather than chasing UI component coverage numbers.

### What Is Tested

**Security & Authentication**
- `tenant-context.test.ts` — Multi-tenant context resolution and healing paths
- `action-protection.test.ts` — Rate limiting and demo mode protection
- `auth/auth-session.test.ts` — Session management
- `auth/role-permissions.test.ts` — RBAC permission enforcement
- `security/security-injection.test.ts` — SQL injection, channel name injection prevention
- `api-keys/api-key-auth.test.ts` — API key hashing and scope validation
- `step-up/step-up-auth.test.ts` — `createStepUpAction` factory: unauthenticated rejection, stale-session reverification, Zod validation pipeline, `TenantError` mapping
- `chaos/step-up-network-partition.test.ts` (NP1-NP10) — Concurrent step-up isolation, sequential call independence, billing handler hardening

**Billing**
- `billing/stripe-checkout.test.ts` — Checkout session creation
- `billing/stripe-webhook.test.ts` — All webhook event handlers
- `billing/stripe-config.test.ts` — Stripe configuration validation
- `billing/billing-client.test.tsx` — Billing UI component behavior

**Core Server Actions**
- AI actions, automations, attachments, board sharing, bulk operations
- Custom fields, dependencies, notifications, sprints, templates
- Time tracking, webhooks, API key CRUD

**Data Layer**
- `lexorank/lexorank.test.ts` — String ordering: insertions, midpoints, rebalancing
- `dal.test.ts` — Data access layer queries
- `schema.test.ts` — Zod schema validation rules
- `search/search.test.ts` — Full-text search functionality
- `import-export/` — Board import and export operations

**Real-Time**
- `realtime/realtime-presence.test.ts` — Supabase presence tracking

**Chaos Engineering & Resilience**
- `chaos/shard-kill-switch.test.ts` (SK1-SK16) — FNV-1a determinism, getShardCount, single-shard dead (two ERROR log sequence), multi-shard failover (WARN + healthy fallback), 30 s TTL cache, `invalidateShardHealthCache` recovery
- `chaos/audit-axiom-outage.test.ts` (AO1-AO12) — AbortSignal 5 s timeout, HTTP 429/503, three consecutive events captured, Postgres trigger holds when Axiom is dark, prod warn vs dev no-op, Sentry severity tags
- `chaos/step-up-network-partition.test.ts` (NP1-NP10) — `has()` throws mid-check, billing handler isolation, three concurrent partitions, sequential independence

**E2E (Playwright)**
- `boards.spec.ts` — Board creation, navigation, management
- `cards.spec.ts` — Card CRUD and interactions
- `tenant-isolation.spec.ts` — Multi-tenant data isolation (two users, two orgs)
- `user-journeys.spec.ts` — Full end-to-end user workflows
- `chaos.spec.ts` — Health API shape, shard endpoint 401 guard, 5 s Supabase latency injection, offline/reconnect indicator, network recovery, step-up cancel leaves board intact

### Running Tests

```bash
# All tests in watch mode
npm test

# All tests with coverage report
npm run test:ci

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Single file
npx jest --testPathPattern=tenant-context

# E2E tests (requires dev server running)
npx playwright test

# E2E with browser UI
npx playwright test --ui

# E2E specific spec
npx playwright test boards.spec.ts
```

---

## Security

### Tenant Isolation

- `orgId` is **never** accepted from client input — always from the signed Clerk JWT
- **Row-Level Security (RLS)** — Prisma sets `app.current_org_id` as a PostgreSQL session variable. RLS policies filter at the DB engine level
- **Dual-gate RBAC** — Organization membership and board membership verified independently. No implicit access even for org admins
- **Realtime channel isolation** — All channels include `orgId`. Names are validated before subscription to prevent injection

### Rate Limiting

**Action-level limiting** — `lib/action-protection.ts`:

- Sliding-window limiter using in-memory `Map<string, number[]>` with 60-second windows
- Per-action limits:
  - Card creation: 60 requests/minute
  - Card reorder: 120 requests/minute
  - Default: 30 requests/minute
- Returns `{ allowed, remaining, retryAfter }` for client-side handling

**Route-level limiting** — `lib/rate-limit.ts`:

- **Distributed (Upstash Redis)** when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set — sliding-window via `@upstash/ratelimit`; state shared across all Vercel instances
- **In-memory fallback** — GC-enabled `Map<string, number[]>` with GC every 200 calls; used when Upstash is not configured or if Redis is temporarily unavailable (fail-open to keep the app live)
- Applied to `/api/ai`: 20 requests per user per minute; returns 429 + `Retry-After` header on breach
- Ratelimit instances are cached in-process per `limit:windowMs` key — no Redis round-trip overhead for setup

### Webhook Security

- **Inbound (Stripe)** — HMAC signature verification via `stripe-signature` header before any processing
- **Outbound (user webhooks)** — HMAC-SHA256 signing with per-webhook secrets, delivered as `X-Nexus-Signature-256`
- **SSRF protection** — Outbound webhooks block:
  - Private IPv4 ranges: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`
  - IPv6 private/loopback/link-local ranges
  - Cloud metadata endpoints: `metadata.google.internal`, `169.254.169.254`

### Audit Logging

Every mutation captured via `createAuditLog()`:

- **Who** — userId, userName, userImage
- **What** — action enum, entityType, entityId, entityTitle
- **When** — createdAt timestamp
- **Where** — ipAddress, userAgent (from request headers)
- **Before/after** — previousValues and newValues as JSON snapshots

Failures captured in Sentry — never silently swallowed.

### Audit Forensic Integrity (Immutable Append-Only Logging)

Storing audit logs exclusively in the same database they monitor creates a forensic gap: a compromised credential can `DELETE FROM audit_logs` and erase evidence of the breach. NEXUS addresses this with three independent layers of protection:

**Layer 1 — Prisma (in-app)** — `lib/create-audit-log.ts`
The existing Postgres write to the org's shard. Used for the in-app audit trail UI (activity feed, org admin history). Present on every shard.

**Layer 2 — Axiom (forensic copy)** — `lib/audit-sink.ts`
Every audit event is streamed to Axiom (append-only cloud log store) via `after()` — the call runs after the response is already sent and never delays the parent server action. Axiom's ingest API has no DELETE operation; the application token is scoped to Ingest-Only, so even a fully leaked `AXIOM_API_KEY` can only append new events, never erase existing ones. Set `AXIOM_DATASET` and `AXIOM_API_KEY` to enable.

**Layer 3 — Postgres trigger** — `supabase-audit-immutability.sql`
A `BEFORE DELETE OR UPDATE` trigger (`enforce_audit_log_immutability`) fires before any mutation on `audit_logs` and raises a `restrict_violation` exception (SQLSTATE 23001). This runs for **all** Postgres roles including `service_role` — it cannot be bypassed by any application-tier credential. Only a Postgres superuser with direct server access could disable it.

Testing the guard:
```sql
-- Should throw: "NEXUS: audit_logs.DELETE is forbidden"
DELETE FROM audit_logs LIMIT 1;

-- Should throw: "NEXUS: audit_logs.UPDATE is forbidden"
UPDATE audit_logs SET entity_title = 'tampered' WHERE id = (SELECT id FROM audit_logs LIMIT 1);
```



Configured in `next.config.ts` for all routes:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
X-Permitted-Cross-Domain-Policies: none
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```

Production-only (HTTPS required):

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

### Input Validation

- All Server Actions validate input via Zod schemas before any processing
- Prisma uses parameterized queries throughout — SQL injection is not possible
- `TenantError` messages are mapped to generic client-safe strings — internal IDs and stack traces never reach the client

### RBAC Atomicity

The auto-heal path in `lib/tenant-context.ts` runs inside `db.$transaction()`. When a missing `OrganizationUser` row is created, the operation:
1. Re-checks for an existing row **inside the transaction** to defeat concurrent duplicate inserts
2. Uses the actual DB `isActive` and `status` values from the healed row — never trusts JWT defaults
3. Throws `TenantError FORBIDDEN` immediately if the healed row has `isActive = false` or `status = SUSPENDED`

This prevents a race condition where two parallel requests could both pass the membership check before either write committed.

### Realtime Channel Authentication

`hooks/use-realtime-analytics.ts` now uses `getAuthenticatedSupabaseClient(token)` with a Clerk JWT fetched via `getToken({ template: "supabase" })`. This matches the security posture already in place for `use-realtime-board.ts` and `use-presence.ts`. If the Clerk JWT template is not configured, the hook falls back gracefully to the anonymous key.

### LexoRank DoS Guard

`actions/update-card-order.ts` and `actions/update-list-order.ts` reject any order string exceeding 64 characters with a safe error message. Normal LexoRank strings max out at ~32 characters; this cap only triggers on malformed or malicious payloads.

### Stripe Idempotency

`app/api/webhook/stripe/route.ts` records every processed Stripe event in the `ProcessedStripeEvent` table (Prisma model added 2026-03-02). The `stripeEventId` column has a `UNIQUE` constraint — a duplicate delivery causes a Prisma `P2002` error which is caught and silently acknowledged with HTTP 200 without re-processing. This closes the gap left by the 300-second staleness check, which only filters *very* old replays.

### Realtime Channel Pre-flight Verification

Before subscribing to any Supabase channel, client hooks (`use-presence`, `use-card-lock`) call `GET /api/realtime-auth?boardId=<id>`. That endpoint:
1. Extracts `userId` + `orgId` from the signed Clerk JWT
2. Resolves the internal `User` record (same pattern as `getTenantContext()`)
3. Verifies an active `OrganizationUser` row exists (`isActive = true`, `status = ACTIVE`)
4. Verifies a `BoardMember` row exists for the requested `boardId`
5. Returns `{ allowed: false }` with HTTP 403/401 on any failure — fail-closed

This prevents a user who has been removed from a board from continuing to receive live WebSocket events until their Clerk JWT expires.

### Supabase Realtime Row-Level Security

`supabase-realtime-rls.sql` (run once in Supabase SQL Editor) enables RLS on `realtime.messages` and `realtime.subscription`. Policies restrict channel subscriptions to topics that start with `org:<jwt.org_id>:` — matching the channel naming convention enforced in `lib/realtime-channels.ts`. Requires the Clerk JWT template `supabase` to include `{ "org_id": "{{org.id}}" }`.

### Stripe Replay Attack + TOCTOU

`app/api/webhook/stripe/route.ts` now:
- **Replay guard**: Events older than 300 seconds (`event.created` vs `Date.now()`) are silently rejected with HTTP 200 — Stripe’s default `stripe-signature` tolerance is 300 s, so legitimate retries won’t be affected
- **TOCTOU fix**: The `customer.subscription.deleted` handler uses `db.organization.updateMany()` with a `WHERE stripeSubscriptionId = subscription.id` guard instead of `update()`. This prevents a stale deletion from overwriting a newly-granted PRO status when a delete event arrives out of order

### AI Prompt Injection

`actions/ai-actions.ts` now:
- `sanitizeForPrompt()` strips control characters (`\x00`–`\x1F`), collapses excessive line padding, and trims whitespace before any user content reaches OpenAI
- All three OpenAI calls (`suggestPriority`, `generateCardDescription`, `suggestChecklists`) split input into a **`system`** role message (fixed instructions) and a **`user`** role message (sanitized user-supplied content only). The model gives higher authority to `system` messages, preventing instruction injection via card titles or descriptions

### AI Frontend Cooldown (Client-Side Spam Guard)

`hooks/use-ai-cooldown.ts` adds a **secondary defence** in front of all AI trigger buttons:

- **Why it matters**: The server-side per-org daily counter (`Organization.aiCallsToday`) fires *after* an OpenAI API call has already been made and billed. A single user could spam an AI button dozens of times per second, burning the daily quota before a single request is rejected.
- **Implementation**: `triggerCooldown()` is called as the **first** line of every AI handler — before any `await` — so the button is disabled instantly on click. A `setInterval` ticks down a `secondsRemaining` counter displayed on the button label (`Wait 9s…`, `Wait 8s…`, …). Cleanup runs on unmount to prevent memory leaks.
- **Scope**: Independent per component instance — checklist generation, description generation, and priority suggestion each have their own 10-second window.
- Applied to: `components/modals/card-modal/checklists.tsx`, `components/modals/card-modal/index.tsx`, `components/board/list-item.tsx`

### Realtime Drag Race Guard

`hooks/use-realtime-board.ts` now includes a **version-gate suppression window** to prevent state flickering during concurrent drag operations:

- **Root cause**: After a user reorders a card via `@dnd-kit`, the optimistic UI update is instant. However, a Supabase `postgres_changes` UPDATE broadcast for that same card arrives shortly after and re-applies the old (server-confirmed) position, causing a visible snap-back.
- **Fix**: A `Map<cardId, suppressUntil>` ref stores `Date.now() + 2000` when a local drag operation starts (via `markLocalCardUpdate(cardId)`). Any incoming UPDATE broadcast for a card whose suppression window has not expired is silently dropped. The 2-second window is short enough that legitimate remote updates from *other* users are not affected.
- The hook exposes `markLocalCardUpdate(cardId: string)` which the board's drag-end handler calls immediately upon completing a drag.

### Supabase Storage Cleanup on Card Delete

`actions/delete-card.ts` now cleans up orphaned storage blobs when a card is deleted:

- **Root cause**: Prisma's cascade delete removes `Attachment` rows from the database, but the physical files stored in the `card-attachments` Supabase Storage bucket are not affected by DB-level cascades.
- **Fix**: All `storagePaths` are fetched from the DB **before** the cascade delete runs. A Supabase service-role client then calls `storage.from("card-attachments").remove(storagePaths)` inside the `after()` async callback. Storage cleanup is best-effort — failures are logged to Sentry but do not fail the card deletion.

### Share Link Data Exposure Protection

`app/shared/[token]/page.tsx` and `actions/board-share-actions.ts` now use explicit Prisma `select` whitelists instead of `include`:

- **Root cause**: The shared-board page is accessible to unauthenticated users (no Clerk session). Using `include: { lists: { include: { cards: true } } }` returned every column on every model — including `orgId`, `createdById`, `imageId`, and any future sensitive columns added to the schema.
- **Fix**: An explicit `select` at every nesting level returns only display fields: board title and cover images; list id, title, order; card id, title, description, priority, dueDate, order; assignee name and avatar; label name and color. Any column not in the whitelist is never sent to the unauthenticated client.

### Dependency Cycle Detection

`actions/dependency-actions.ts` prevents circular dependency deadlocks before they are created:

- A `wouldCreateCycle(sourceId, targetId, type)` function performs a BFS across the existing dependency graph starting from `targetId`.
- `MAX_VISITED = 500` caps the traversal to prevent O(n²) DB calls on pathologically large graphs — any graph exceeding this threshold is treated conservatively as "cycle detected".
- Cross-organization edges are filtered out before BFS begins — a card in a different org can never form a cycle with cards in this org.
- The action returns a structured error `"This dependency would create a circular chain"` rather than allowing the `BLOCKING` relationship to be saved.

---

## Performance Optimizations

| Optimization | Implementation |
|---|---|
| **Turbopack** | Dev server uses Turbopack for fast HMR |
| **React Compiler** | `babel-plugin-react-compiler` auto-memoizes all client components |
| **Server Components** | Data-heavy pages render on server with zero client JS |
| **Hydration-safe CSS** | All Tailwind classes use explicit bracket values (`gap-[5px]`, `h-[30px]`, `bg-gradient-to-br`) — eliminates class mismatch hydration errors between server and cached client bundles |
| **Image optimization** | AVIF + WebP formats, 1-hour minimum cache TTL |
| **Virtual scrolling** | `components/virtual-scroll.tsx` renders only visible items |
| **Lazy loading** | `components/lazy-load.tsx` uses Intersection Observer |
| **LexoRank** | Card/list reorder updates exactly 1 DB row regardless of list size |
| **React `cache()`** | `getTenantContext()` deduplicated to 1 DB call per request |
| **Optimistic updates** | Card mutations apply to UI before server responds |
| **Bundle analysis** | `npm run analyze` via `@next/bundle-analyzer` |
| **Tree-shaking** | `optimizePackageImports` for lucide-react, framer-motion, TipTap, Radix, @dnd-kit, Recharts |
| **Static caching** | `/_next/static/*` cached 1 year (immutable) |
| **API no-cache** | `/api/*` routes set `Cache-Control: no-store, no-cache, must-revalidate` |
| **Parallel compilation** | Enabled in `next.config.ts` |
| **PgBouncer** | Connection pooling via port 6543 for all app queries |

---

## Deployment

### Vercel (Recommended)

```bash
# Install CLI
npm i -g vercel

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Production Setup Checklist

```bash
# 1. Run database migrations
npx prisma migrate deploy

# 2. Set environment variables in Vercel Dashboard
#    Project > Settings > Environment Variables
#    (All NEXT_PUBLIC_ vars are exposed to the browser)

# 3. Configure Stripe webhook
#    Endpoint: https://your-domain.com/api/webhook/stripe
#    Events: checkout.session.completed, invoice.payment_succeeded,
#            invoice.payment_failed, customer.subscription.updated,
#            customer.subscription.deleted

# 4. Update Clerk redirect URLs to production domain

# 5. Set CRON_SECRET for cron job authentication
```

**Vercel cron job** (configured in `vercel.json`):
```json
{ "crons": [{ "path": "/api/cron/daily-reports", "schedule": "0 9 * * *" }] }
```

### Pre-Deploy Checklist

- [ ] All required environment variables set in Vercel
- [ ] `npx prisma migrate deploy` run against production DB
- [ ] Stripe webhook endpoint configured for production URL
- [ ] Clerk redirect URLs updated to production domain
- [ ] `CRON_SECRET` set
- [ ] Custom domain configured (if applicable)
- [ ] Sentry DSN set (recommended)
- [ ] Supabase storage buckets configured (`npm run setup:storage`)

---

## CI/CD Pipeline

> End-to-end automation from `git push` to live production — every stage is explained below the diagram.

---

### Pipeline Architecture Diagram

```mermaid
flowchart TD
    A["👨‍💻 Developer\nlocal machine"] -->|git push| B["GitHub\norigin/feature-branch"]

    B --> C["Vercel Bot\ndetects push to non-main branch"]
    C --> D["Preview Build Pipeline"]

    subgraph preview ["🔵 Preview Build (every push)"]
        D --> D1["Install deps\nnpm ci"]
        D1 --> D2["Type check\nnpx tsc --noEmit"]
        D2 --> D3["Lint\nnpx eslint ."]
        D3 --> D4["Next.js Build\nnext build (Turbopack)"]
        D4 --> D5["Static generation\n39 pages pre-rendered"]
        D5 --> D6["✅ Preview URL\nhttps://nexus-abc123.vercel.app"]
    end

    D6 --> E["👀 Team Review\nCode review + QA on preview URL"]
    E -->|PR approved + merged to main| F["GitHub main branch"]

    F --> G["Vercel Production Pipeline"]

    subgraph prod ["🟢 Production Build (main branch only)"]
        G --> G1["Install deps\nnpm ci"]
        G1 --> G2["Type check\nnpx tsc --noEmit"]
        G2 --> G3["Lint\nnpx eslint ."]
        G3 --> G4["Next.js Build\nnext build (Turbopack)"]
        G4 --> G5["Edge runtime bundle\nMiddleware + API routes"]
        G5 --> G6["🚀 Production deploy\nhttps://nexus.yourdomain.com"]
    end

    G6 --> H["🗄️ Database Migration\nnpx prisma migrate deploy\n(manual — run before deploy)"]
    H --> I["✅ Production Live"]

    I --> J1["📊 Sentry\nError & performance monitoring"]
    I --> J2["⏰ Vercel Cron\n/api/cron/daily-reports\n09:00 UTC daily"]
    I --> J3["🔄 Supabase Realtime\nWebSocket connections active"]
    I --> J4["💳 Stripe Webhooks\n/api/webhook/stripe\nlive events flowing"]

    style preview fill:#1e3a5f,stroke:#3b82f6,color:#e2e8f0
    style prod   fill:#14532d,stroke:#22c55e,color:#e2e8f0
```

---

### Stage-by-Stage Breakdown

#### Stage 1 — Local Development

The developer works on a feature branch. The recommended local workflow is:

```bash
# 1. Start dev server with Turbopack hot-reload
npm run dev

# 2. Run type-check in watch mode (separate terminal)
npx tsc --noEmit --watch

# 3. Lint on demand
npm run lint

# 4. Run unit tests
npm run test:unit

# 5. Run integration tests (requires running dev server)
npm run test:integration
```

Key safety nets active locally:
- **TypeScript strict mode** — catches type mismatches before the push
- **ESLint** with custom rules — enforces project conventions
- **Zod schemas** — validates action inputs at the boundary
- **React Compiler** — prevents stale closure bugs without manual memoisation

---

#### Stage 2 — Preview Build (every `git push`)

Vercel automatically detects every push on any branch and runs a full preview build:

| Step | Command | What it validates |
|------|---------|-------------------|
| Dependency install | `npm ci` | Lockfile integrity, no phantom packages |
| TypeScript check | `tsc --noEmit` | Zero type errors in strict mode |
| Lint check | `eslint .` | Code style, no banned patterns |
| Build | `next build` | All 39 pages compile and pre-render |
| Edge bundle | automatic | Middleware fits within Vercel Edge 1 MB limit |

**Output:** A unique preview URL (e.g. `nexus-pr-42-xyz.vercel.app`) is posted as a PR comment. The full production-config environment (real Clerk, real Stripe test-mode, real Supabase) is active on the preview, so reviewers test against live services.

---

#### Stage 3 — Code Review & QA

Before merging to `main`, the PR requires:

- At minimum one approving review
- All Vercel preview build checks green
- Manual smoke-test on the preview URL covering: sign-in, board create/drag-drop, real-time sync across two browser tabs, billing portal

---

#### Stage 4 — Production Build (merge to `main`)

Merging to `main` triggers an identical build pipeline, but targeting production infrastructure:

```
main branch push
  → npm ci
  → tsc --noEmit
  → eslint .
  → next build (Turbopack)
  → Static pre-rendering (39 pages)
  → Edge function bundle
  → Zero-downtime deploy via Vercel's blue/green routing
```

**Zero-downtime strategy:** Vercel keeps the previous build live and only cuts traffic over once the new build passes all health checks. A failed build never affects the live site.

---

#### Stage 5 — Database Migration (manual gate)

Prisma migrations are intentionally **not** run automatically during deploy. This is a deliberate safety gate — schema changes are applied manually just before a deploy:

```bash
# Run from your local machine or CI with direct DB access
npx prisma migrate deploy
```

Rationale: automatic migration on deploy can cause irreversible data loss if the migration contains a destructive change and the new code is rolled back. The manual step forces explicit sign-off.

---

#### Stage 6 — Post-Deploy Services

Once production is live, four background services activate immediately:

| Service | Trigger | Purpose |
|---------|---------|---------|
| **Sentry** | First request | Captures exceptions, performance traces, and Web Vitals |
| **Vercel Cron** | `0 9 * * *` (09:00 UTC daily) | Runs `/api/cron/daily-reports` — generates digest emails for active orgs |
| **Supabase Realtime** | Client connects | `postgres_changes` broadcasts to board subscribers (drag-drop, card updates, presence) |
| **Stripe Webhooks** | Payment events | `/api/webhook/stripe` — processes subscription changes, updates org plan in Prisma |

---

### Testing Pipeline

```mermaid
flowchart LR
    A["npm run test:ci"] --> B["Jest: Unit Tests\n__tests__/unit/**"]
    A --> C["Jest: Integration Tests\n__tests__/integration/**"]
    B --> D["Coverage report\ncoverage/lcov-report/"]
    C --> D
    D --> E["Playwright: E2E\ne2e/*.spec.ts\n(requires running dev server)"]
    E --> F["All green → PR ready to merge"]
```

Test priorities (in order of importance):
1. **Security & auth** — `tenant-context`, RBAC matrix, rate limiting, API key auth
2. **Billing** — Stripe webhook handlers, checkout session creation, plan sync
3. **Core algorithms** — LexoRank insert/midpoint/rebalance
4. **Critical actions** — card CRUD, drag ordering, board member mutations
5. **Zod schemas** — valid and invalid inputs for every action schema

Coverage targets are secondary to test quality — a brittle high-coverage suite is worse than a robust low-coverage one.

---

### Branch Strategy

```
main          ← production; never commit directly
  └─ feature/* ← all new work; opens PR → triggers preview build
  └─ fix/*     ← hotfixes; same pipeline as feature branches
  └─ chore/*   ← dependency updates, config — still go through PR review
```

Direct pushes to `main` are blocked. Every change to production goes through a reviewed PR with a passing Vercel build.

---

### Environment Variables per Stage

| Variable group | Local (`.env.local`) | Preview (Vercel) | Production (Vercel) |
|---------------|----------------------|------------------|---------------------|
| `DATABASE_URL` | Local Supabase / Docker | Preview Supabase project | Production Supabase project |
| `CLERK_SECRET_KEY` | Dev Clerk app | Dev Clerk app | Production Clerk app |
| `STRIPE_SECRET_KEY` | Test mode key | Test mode key | Live mode key |
| `STRIPE_WEBHOOK_SECRET` | `stripe listen` CLI | Preview webhook | Production webhook |
| `CRON_SECRET` | Any random string | Set in Vercel | Set in Vercel |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3001` | Preview URL | `https://yourdomain.com` |

> Never commit `.env.local` — it is gitignored. All production secrets live in Vercel's encrypted environment variable store.

---

## Workflow Diagrams

> These diagrams show the step-by-step paths that data and users follow through the application. Each one is explained in plain English below the diagram.

---

### 1. User Onboarding Flow

**What this diagram shows:** The path a brand new user takes from first visiting the site to seeing their first board.

**Step by step:**
- User opens the Nexus URL for the first time
- If they don't have an account, they click **Sign Up** — Clerk handles the registration form, email verification, and session creation
- If they already have an account, they click **Sign In** — Clerk validates credentials and issues a signed JWT
- After sign-in, the app calls `getTenantContext()` — this function reads the Clerk JWT, finds the user's internal database record, and creates it automatically if this is their very first sign-in (the "healing" path)
- If the user has no organization yet, they are shown a prompt to create one or request to join an existing one
- Once inside an organization, if no boards exist, they see a prompt to create the first board (or pick from a template)
- After board creation, they land on the full Kanban view

```mermaid
flowchart TD
    A["User visits Nexus"] --> B{"Has account?"}
    B -->|No| C["Sign Up via Clerk"]
    B -->|Yes| D["Sign In via Clerk"]
    C --> E["Clerk creates user + sends email verification"]
    E --> F["getTenantContext() healing path:<br/>Creates User row + OrganizationUser row in DB"]
    F --> G["Redirect to Dashboard"]
    D --> G
    G --> H{"Has organization?"}
    H -->|No| I["Create organization OR request to join one"]
    H -->|Yes| J{"Has boards?"}
    I --> J
    J -->|No| K["Create first board (blank or from template)"]
    J -->|Yes| L["Show board list on Dashboard"]
    K --> L
    L --> M["Click a board → Full Kanban view"]
```

---

### 2. Card Lifecycle

**What this diagram shows:** The full journey of a work item (card) from creation to completion.

**Step by step:**
- A card is created inside a list (column) — either by clicking "Add card" or via AI suggestions
- A team member is assigned to own the work
- Labels (e.g. "Bug", "Feature") and a priority level (Low / Medium / High / Urgent) are set
- Time tracking begins — members log hours spent on the card
- As work progresses, the card is dragged between lists (e.g. from "In Progress" to "Review")
- Throughout the entire lifecycle, teammates can add comments, upload files, tick off checklist items, and link dependencies to other cards
- When work is done, the card is moved to the final "Done" list
- Completed cards can be archived — they disappear from normal view but remain in the database for reporting

```mermaid
flowchart LR
    Create["Create Card in a List"] --> Assign["Assign to a Team Member"]
    Assign --> Meta["Set Labels, Priority & Due Date"]
    Meta --> Sprint["Add to Sprint / Epic"]
    Sprint --> Track["Log Time & Update Checklists"]
    Track --> Move["Drag Between Lists as Work Progresses"]
    Move --> Review["Move to Review / QA List"]
    Review --> Done["Move to Done List"]
    Done --> Archive["Archive Card"]

    subgraph "Happens at any point during lifecycle"
        Comment["Add Rich-Text Comments"]
        Attach["Upload Files & Screenshots"]
        Deps["Link Dependencies (Blocks / Blocked By)"]
        AI["Generate AI Description or Checklist Items"]
        Reactions["React to Comments with Emoji"]
    end
```

---

### 3. Drag & Drop Card Reordering Flow

**What this diagram shows:** Exactly what happens in the system when a user picks up a card and drops it somewhere else — including how the UI stays fast and how other users see the update.

**Step by step:**
- User grabs a card — `@dnd-kit` starts tracking the drag; a ghost copy (`DragOverlay`) follows the cursor
- The UI updates **immediately** (optimistic update) — the card appears in its new position before any server call is made. This makes the app feel instant.
- When the user drops the card, `LexoRank` calculates the new `order` string based on the cards above and below the drop position
- A server action (`update-card-order`) fires — it validates the input, checks the user has at least the `MEMBER` org role, guards against LexoRank DoS (order strings capped at 64 chars), then batch-updates the affected card rows in the database
- The event bus fires — it checks if any automation rules match (e.g. "when a card is moved to Done, assign the owner") and sends outbound webhooks
- Supabase detects the database change via `postgres_changes` and broadcasts it over the WebSocket channel for this board
- Every other user who has this board open receives the event and their UI updates in real time — they see the card move without refreshing
- If the server action fails, the optimistic update is rolled back and the card snaps back to its original position

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant DND as @dnd-kit
    participant OptUI as Optimistic UI
    participant SA as Server Action
    participant DB as PostgreSQL
    participant EB as Event Bus
    participant RT as Supabase Realtime
    participant Other as Other Users

    U->>DND: Starts dragging card
    DND->>OptUI: Show DragOverlay ghost
    U->>DND: Drops card in new position
    DND->>OptUI: Update local state immediately (0ms delay)
    DND->>SA: Call update-card-order(cardId, newOrder)
    SA->>SA: Validate input + LexoRank order length guard
    SA->>SA: getTenantContext() + requireRole("MEMBER")
    SA->>DB: UPDATE card SET order = newLexoRank WHERE id = cardId
    DB-->>SA: Success
    SA->>EB: emitCardEvent(CARD_MOVED)
    par
        EB->>EB: runAutomations()
        EB->>EB: fireWebhooks() (HMAC-signed)
    end
    DB->>RT: postgres_changes fires on card row update
    RT->>Other: Broadcast card move event
    Other->>Other: UI updates — card appears in new position
    Note over U,OptUI: If SA fails → OptUI rolls back to original position
```

---

### 4. Server Action Execution Flow

**What this diagram shows:** The exact lifecycle every server action follows — from the user clicking a button to the database being updated and other users being notified. This is the same pattern used by all 42 server actions in the codebase.

**Step by step:**
- User does something in the UI (e.g. creates a card, adds a label, invites a member)
- The browser calls a Next.js Server Action directly — no `fetch()` to a REST endpoint needed
- `createSafeAction` (the shared wrapper) validates the input using a Zod schema — if validation fails, field errors are returned immediately with no DB involvement. If a `TenantError` is thrown later, the wrapper maps it to a safe, generic client message (never leaking internal IDs or stack traces).
- Inside the handler, `getTenantContext()` runs — it calls `auth()` to read the Clerk JWT for `userId` and `orgId`, then verifies the user is an active organization member. If this fails, a `TenantError` is thrown.
- The handler calls `createDAL(ctx)` — this sets the PostgreSQL session variable `app.current_org_id` for Row-Level Security, then returns a data-access layer scoped to the tenant
- The RBAC permission check runs — the specific permission needed for this action (e.g. `CARD_EDIT`, `BOARD_DELETE`) is checked via `requireBoardPermission()` against the user's board role and any custom permission scheme
- Prisma runs the database mutation, scoped to `orgId` — every query includes the `orgId` filter at the application level, and RLS policies provide a database-level safety net
- `emitCardEvent()` fires asynchronously via `after()` — automations and outbound webhooks run in parallel without slowing down the response
- Audit logging is performed by the handler (either via `dal.auditLogs.create()` or `createAuditLog()`) — it writes an immutable record of what happened
- The result is returned to the browser — on success the UI confirms; on failure the error is user-safe

```mermaid
sequenceDiagram
    participant Client as Browser
    participant CSA as createSafeAction wrapper
    participant ZOD as Zod Schema
    participant Handler as Action Handler
    participant TC as getTenantContext()
    participant DAL as createDAL()
    participant RBAC as requireBoardPermission()
    participant DB as PostgreSQL (Prisma + RLS)
    participant EB as Event Bus
    participant RT as Supabase Realtime

    Client->>CSA: User triggers action (e.g. createCard)
    CSA->>ZOD: Validate input shape and types
    alt Validation fails
        ZOD-->>Client: Return fieldErrors immediately
    end
    ZOD-->>CSA: Input is valid
    CSA->>Handler: Call handler with validated data
    Handler->>TC: getTenantContext() — calls auth() internally
    TC-->>Handler: { userId, orgId, role } OR throws TenantError
    alt TenantError thrown
        CSA-->>Client: Safe generic error message (never leaks internals)
    end
    Handler->>DAL: createDAL(ctx) — sets app.current_org_id for RLS
    Handler->>RBAC: Check permission (e.g. CARD_CREATE)
    alt Permission denied
        RBAC-->>Client: 403 Forbidden
    end
    RBAC-->>Handler: Allowed
    Handler->>DB: Execute mutation scoped to orgId (WHERE clause + RLS)
    DB-->>Handler: Saved record
    Handler->>Handler: Audit log via dal.auditLogs.create()
    Handler->>Handler: after(() => emitCardEvent())
    Handler-->>Client: { data: result }
    Note over Handler,EB: after() callback runs asynchronously post-response
    Handler->>EB: emitCardEvent()
    par Runs in parallel, does not block response
        EB->>EB: runAutomations()
        EB->>EB: fireWebhooks() with HMAC-SHA256 signature
    end
    DB->>RT: postgres_changes broadcast to all board subscribers
```

---

### 5. Authentication & Tenant Isolation Flow

**What this diagram shows:** How every single request is authenticated and isolated to the correct tenant — ensuring one organization can never accidentally access another's data.

**Step by step:**
- Every request (whether a page load, server action, or API call) starts by calling `getTenantContext()` — this internally calls `auth()` from Clerk to read the signed session cookie
- Clerk returns the `userId` and `orgId` extracted from the JWT — these are cryptographically signed and cannot be faked or tampered with by the client
- `getTenantContext()` queries the database:
  - Looks up the internal `User` record by `clerkUserId` — creates it if not found (first sign-in)
  - Looks up the `OrganizationUser` membership record — creates it if not found (first time joining an org)
  - If the membership exists but `isActive = false` or `status = SUSPENDED`, the request is rejected
- The handler then calls `createDAL(ctx)` — this sets the PostgreSQL session variable `app.current_org_id` via `setCurrentOrgId()`, enabling Row-Level Security policies at the database level
- All subsequent Prisma queries are scoped by `orgId` both in the application WHERE clauses AND at the database engine level via RLS (double protection)

```mermaid
sequenceDiagram
    participant Browser
    participant NextJS as Next.js Server
    participant Clerk as Clerk Auth
    participant TC as getTenantContext()
    participant DAL as createDAL()
    participant PG as PostgreSQL + RLS

    Browser->>NextJS: Any request (page / action / API)
    NextJS->>TC: getTenantContext() — takes no parameters
    TC->>Clerk: auth() — read signed session cookie
    Clerk-->>TC: { userId, orgId } from JWT claims
    Note over TC: orgId is NEVER read from query params or request body
    TC->>PG: SELECT User WHERE clerkUserId = userId
    alt User not found (first sign-in)
        TC->>PG: INSERT User (healing path)
    end
    TC->>PG: SELECT OrganizationUser WHERE userId + orgId
    alt Membership not found
        TC->>PG: INSERT OrganizationUser (auto-join)
    end
    alt isActive = false OR status = SUSPENDED
        TC-->>Browser: TenantError → 403 Forbidden
    end
    TC-->>NextJS: TenantContext { userId, orgId, role }
    NextJS->>DAL: createDAL(ctx)
    DAL->>PG: SET app.current_org_id = orgId (RLS session variable)
    Note over PG: All subsequent queries filtered by RLS policies at DB engine level
    NextJS->>PG: Execute business logic query (scoped by orgId in WHERE + RLS)
    PG-->>NextJS: Data for this org only
    NextJS-->>Browser: Response
```

---

## Use Case Diagram

> This section describes **who can do what** in Nexus. There are two separate layers of access control — Organization level and Board level. A user must pass both gates to interact with a board.

### How the Two-Gate System Works

- **Gate 1 — Organization Membership:** The user must be an active member of the organization. Their role at this level is `OWNER`, `ADMIN`, `MEMBER`, or `GUEST`.
- **Gate 2 — Board Membership:** Even if the user is an org OWNER, they still need an explicit `BoardMember` record to access a specific board. Without it, the board is completely invisible to them.
- **Role inheritance:** Being an org OWNER does not automatically make you a board OWNER — the two roles are independent.

---

### Role Permissions — Plain English

#### Guest (accessed via public share link — no account needed)
- Can view the board they were given a link to
- Can view all cards on that board
- Can optionally leave comments if the share link allows it
- Cannot create, edit, move, or delete any cards
- Cannot see any other boards in the organization
- Cannot see member information beyond public names
- Their session is time-limited and can be password-protected by the board owner

#### Board Viewer (has an account, added to the board as Viewer role)
- Everything a Guest can do, plus:
- Can see card details including attachments, checklists, time logs, and comments
- Can see who is online on the board via presence avatars
- Can add comments, edit their own comments, and delete their own comments
- Can view board analytics
- Cannot create, edit, move, or delete any cards

#### Board Member (the standard working role for contributors)
- Everything a Viewer can do, plus:
- Can create new cards in any list
- Can edit card titles, descriptions, due dates, labels, and priorities
- Can drag and drop cards between lists and reorder them
- Can add rich-text comments and react to other comments with emoji
- Can upload files and attachments to cards (up to 100 MB per file)
- Can log time spent working on a card
- Can tick off checklist items
- Can link card dependencies (marks one card as blocking another)
- Can assign themselves or others to cards (if they have org membership)
- Can use AI to generate descriptions and checklist items
- Cannot delete cards (deletion requires Admin or above)
- Cannot change board settings or manage who has access

#### Board Admin (trusted team lead role)
- Everything a Member can do, plus:
- Can delete any card on the board
- Can edit board settings (title, background image, description)
- Can invite members to the board and remove them
- Can change any member's board role (Member ↔ Viewer)
- Can configure custom permission schemes for the board or individual members
- Can create a public share link with optional password and expiry date
- Can archive or unarchive any card
- Can create, start, and complete sprints
- Can view and manage automation rules on the board
- Can view board analytics and export reports
- Cannot delete the board itself
- Cannot manage organization-level settings

#### Org Owner (highest privilege — typically the account creator or designated admin)
- Everything a Board Admin can do on any board, plus:
- Can create new boards (and set them as public or private)
- Can delete boards permanently
- Can manage all organization members — invite, remove, change org roles, suspend members
- Can manage Stripe billing — upgrade to PRO, view invoices, cancel subscription
- Can view organization-wide analytics across all boards
- Can export any data to CSV, JSON, or PDF
- Can configure automation rules ("when X happens, do Y")
- Can manage outbound webhooks (register endpoints, view delivery logs)
- Can create and revoke API keys for the public REST API
- Can configure third-party integrations (GitHub, Slack)
- Can access GDPR tools — export user data, process deletion requests
- Can view the full audit log across all boards and all members

---

### Full Use Case Diagram

```mermaid
graph TB
    subgraph Roles
        Guest["Guest\n(shared link, no account)"]
        Viewer["Board Viewer\n(read-only account holder)"]
        Member["Board Member\n(standard contributor)"]
        Admin["Board Admin\n(team lead)"]
        Owner["Org Owner\n(full organization control)"]
    end

    subgraph Card Actions
        ViewCards["View Cards & Details"]
        CreateCard["Create Cards"]
        EditCard["Edit Card Content"]
        MoveCard["Drag & Drop Cards"]
        DeleteCard["Delete Cards"]
        Comment["Add Comments & Reactions"]
        Attach["Upload File Attachments"]
        Track["Log Time"]
        Checklist["Update Checklists"]
        Deps["Link Dependencies"]
        AICard["Use AI on Cards"]
    end

    subgraph Board Management
        ViewBoard["View Board"]
        EditSettings["Edit Board Settings"]
        ManageMembers["Manage Board Members"]
        ConfigPerms["Set Custom Permissions"]
        ShareBoard["Create Public Share Link"]
        CreateBoard["Create Boards"]
        DeleteBoard["Delete Boards"]
        ManageSprints["Manage Sprints"]
    end

    subgraph Organisation Management
        ManageOrg["Manage Org Members"]
        ManageBilling["Manage Stripe Billing"]
        ViewAnalytics["View Analytics"]
        ExportData["Export Data (CSV/JSON/PDF)"]
        ConfigAuto["Configure Automations"]
        ManageWebhooks["Manage Webhooks"]
        ManageAPIKeys["Manage API Keys"]
        Integrations["Set Up GitHub + Slack"]
        GDPR["GDPR Data Export & Deletion"]
        AuditLog["View Full Audit Log"]
    end

    Guest --> ViewBoard
    Guest --> ViewCards

    Viewer --> ViewBoard
    Viewer --> ViewCards
    Viewer --> Comment
    Viewer --> ViewAnalytics

    Member --> ViewBoard
    Member --> ViewCards
    Member --> CreateCard
    Member --> EditCard
    Member --> MoveCard
    Member --> Comment
    Member --> Attach
    Member --> Track
    Member --> Checklist
    Member --> Deps
    Member --> AICard

    Admin --> ViewBoard
    Admin --> ViewCards
    Admin --> CreateCard
    Admin --> EditCard
    Admin --> MoveCard
    Admin --> DeleteCard
    Admin --> Comment
    Admin --> Attach
    Admin --> Track
    Admin --> Checklist
    Admin --> Deps
    Admin --> AICard
    Admin --> EditSettings
    Admin --> ManageMembers
    Admin --> ConfigPerms
    Admin --> ShareBoard
    Admin --> ManageSprints
    Admin --> ViewAnalytics

    Owner --> CreateBoard
    Owner --> DeleteBoard
    Owner --> EditSettings
    Owner --> ManageMembers
    Owner --> ManageOrg
    Owner --> ManageBilling
    Owner --> ViewAnalytics
    Owner --> ExportData
    Owner --> ConfigAuto
    Owner --> ManageWebhooks
    Owner --> ManageAPIKeys
    Owner --> Integrations
    Owner --> GDPR
    Owner --> AuditLog
```

---

### Permission Matrix Summary

| Action | Guest | Viewer | Member | Admin | Owner |
|---|:---:|:---:|:---:|:---:|:---:|
| View board | ✓ | ✓ | ✓ | ✓ | ✓ |
| View card details | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create cards | — | — | ✓ | ✓ | ✓ |
| Edit card content | — | — | ✓ | ✓ | ✓ |
| Drag & drop cards | — | — | ✓ | ✓ | ✓ |
| Delete cards | — | — | — | ✓ | ✓ |
| Add comments | — | ✓ | ✓ | ✓ | ✓ |
| Upload attachments | — | — | ✓ | ✓ | ✓ |
| Log time | — | — | ✓ | ✓ | ✓ |
| Use AI features | — | — | ✓ | ✓ | ✓ |
| View analytics | — | ✓ | ✓ | ✓ | ✓ |
| Edit board settings | — | — | — | ✓ | ✓ |
| Manage board members | — | — | — | ✓ | ✓ |
| Create public share link | — | — | — | ✓ | ✓ |
| Manage sprints | — | — | — | ✓ | ✓ |
| Configure automations | — | — | — | ✓ | ✓ |
| Create new boards | — | — | — | — | ✓ |
| Delete boards | — | — | — | — | ✓ |
| Manage org members | — | — | — | — | ✓ |
| Manage billing | — | — | — | — | ✓ |
| Manage webhooks | — | — | — | — | ✓ |
| Manage API keys | — | — | — | — | ✓ |
| View audit log | — | — | — | — | ✓ |
| GDPR tools | — | — | — | — | ✓ |

---

## Scalability

### Current Design

- **Stateless API** — All state lives in PostgreSQL. Any Vercel serverless function can handle any request
- **PgBouncer** — Pools DB connections on port 6543. Prisma connects through the pooler; direct connection on port 5432 for migrations only
- **O(1) ordering** — LexoRank insertions touch exactly one DB row regardless of list size
- **Request deduplication** — `getTenantContext()` wrapped in `cache()` — one auth + DB call per request maximum
- **Edge network** — Vercel global edge for all static assets cached with 1-year immutable headers
- **Event fan-out** — `emitCardEvent()` uses `Promise.allSettled()` — automations and webhooks run in parallel without blocking the HTTP response
- **Horizontal database sharding** — `lib/shard-router.ts` uses FNV-1a 32-bit consistent hashing to map each `orgId` to a dedicated PostgreSQL shard; per-shard PrismaClient pool; 30 s health cache with automatic failover to the next healthy shard; fail-open to shard 0 on total outage; zero overhead in single-shard mode (no `SHARD_N_DATABASE_URL` env vars needed)

### Scaling Considerations

| Concern | Current | Production Scale Path |
|---|---|---|
| Rate limiting | Upstash Redis (distributed) with in-memory fallback — `lib/rate-limit.ts` | Add `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` env vars to enable distributed mode |
| DB connections | Supabase free tier limits | Scale Supabase plan, monitor PgBouncer utilization |
| Horizontal DB sharding | **Implemented** — `lib/shard-router.ts` FNV-1a router, health cache, automatic failover | Add `SHARD_1_DATABASE_URL`, `SHARD_2_DATABASE_URL`, etc.; run `scripts/migrate-org-to-shard.ts` to copy existing org data; update env vars to cut over |
| Realtime connections | Per-project Supabase limits | Shard by organization at high concurrency |
| File storage | Supabase Storage | Add CDN in front of storage bucket |
| Automation engine | Max depth 3, synchronous | Move to background job queue (e.g., BullMQ + Redis) |
| AI quota | Per-org daily counter | Already implemented — extend with per-user limits |
| Destructive action security | **Implemented** — `createStepUpAction` biometric/TOTP gate | Extend level map with custom freshness windows per action |

---

## Known Limitations & Roadmap

### Current Limitations

- **Rate limiting** — Distributed Upstash Redis when env vars are set; falls back to single-instance in-memory Map when running without Upstash credentials (e.g. local dev or deployments that haven't configured Upstash yet)
- **Test coverage is ~19.5%** — Core paths (auth, billing, RBAC) are covered; UI components are not. E2E golden-path suite (`e2e/golden-path.spec.ts`) covers the five critical user journeys end-to-end
- **No offline support** — Service Worker handles push notifications only; no IndexedDB write-ahead buffer. Cards dragged during a 2-second connectivity drop will fail to sync
- **No native mobile app** — Web UI is responsive, but no iOS/Android app exists
- **No SSO/SAML** — Enterprise single sign-on not yet implemented; custom Clerk JWT templates can partially cover this use case today
- **Supabase Realtime RLS** — requires manual one-time SQL execution in Supabase Dashboard (`supabase-realtime-rls.sql`) and Clerk JWT template configuration
- **Prisma cold starts on Vercel** — first request after a cold function start incurs a ~1–3 s connection overhead; mitigated by `instrumentation.ts` pre-warm and pgBouncer pooling on `DATABASE_URL` (port 6543)
- **LexoRank string growth** — addressed by the weekly `/api/cron/lexorank-rebalance` job; lists where any card order string exceeds 20 characters are fully re-normalised to single-character keys automatically
- **Shard 0 is the catalog shard** — `User` rows are not org-scoped and cannot be distributed across shards. They live on the primary `DATABASE_URL` (shard 0). If shard 0 is unavailable, `getTenantContext()` fails for **all** users — not just those in shard 0 orgs — because user resolution always executes against shard 0. In single-shard mode this is identical to today's failure surface. In multi-shard deployments, treat shard 0 as a globally-critical dependency and provision it with high-availability replicas or promote the `users` table to a dedicated catalog database (CockroachDB / PlanetScale)

### Potential Roadmap Items

- **SSO / SAML** — Okta, Azure AD, and Google Workspace integration for enterprise teams (most-requested enterprise blocker)
- **Offline-first support** — IndexedDB write-ahead buffer with background sync so card moves survive connectivity drops
- **Native mobile application** — React Native or enhanced PWA
- **Google Calendar and Outlook integration** — sync due dates bidirectionally
- **AI-powered task prioritisation and workload balancing**
- **Board activity heatmaps and historical analytics**
- **Granular notification controls** — per-board, per-event-type email / push preferences
- **Catalog DB HA** — promote the `users` table to a separate globally-replicated database (CockroachDB or PlanetScale) so shard 0 downtime no longer affects authentication for users whose orgs live on other shards

---

## Changelog

### Latest Updates

| Date | Commit | Change |
|---|---|---|
| 2026-03-02 | `9f0aa1e` | Fix(deps): `@tiptap/y-tiptap@3.0.2` + `y-protocols@^1.0.1` installed — TipTap 3.20+ extracted the Yjs bridge into these new peer packages; installed `--legacy-peer-deps` to skip unrelated Zod v4 conflict; build clean; **1,449/1,449 tests passing** |
| 2026-03-02 | `df93374` | Test(chaos): Chaos Engineering suite — 40 new tests across 3 unit files + 1 E2E spec; **SK1-SK16** (`__tests__/unit/chaos/shard-kill-switch.test.ts`): FNV-1a determinism, getShardCount, dead single-shard two-ERROR sequence, multi-shard WARN failover, 30 s TTL cache invalidation/recovery; **AO1-AO12** (`__tests__/unit/chaos/audit-axiom-outage.test.ts`): AbortSignal 5 s timeout, 429/503 graceful degradation, three consecutive captures, Postgres guard holds when Axiom is dark, dev no-op vs prod warn, Sentry severity tags; **NP1-NP10** (`__tests__/unit/chaos/step-up-network-partition.test.ts`): `has()` throws mid-check, billing handler isolation, concurrent partition independence; **CE-1-CE-6** (`e2e/chaos.spec.ts`): `/api/health` shape, `/api/health/shards` 401 guard, 5 s Supabase latency injection, offline/reconnect status indicator, network recovery, step-up cancel leaves board intact |
| 2026-03-02 | `8b2367d` | Security(step-up): `lib/step-up-action.ts` (NEW) — `createStepUpAction(schema, handler, level)` factory for mandatory re-verification on destructive actions; Gate 1: `auth.protect()` propagates unauthenticated error; Gate 2: Clerk `has({ reverification: level })` → returns `reverificationError(level)` if session stale; Gate 3: Zod validation → handler in try/catch for `TenantError` mapping; four levels: `strict` (10 min), `moderate` (1 hr), `lax` (24 hr), `strict_mfa` (10 min + 2FA); client `useReverification()` detects Clerk magic error object → shows biometric/TOTP modal → auto-retries action |
| 2026-03-02 | `HEAD` | Feat: `lib/yjs-supabase-provider.ts` (NEW) — custom Yjs transport over Supabase Realtime broadcast; `encodeUpdate/decodeUpdate` safe binary↔base64 roundtrip; sync handshake (sync-request/sync-state) on subscribe; origin='remote' tag prevents re-broadcast loops; `destroy()` unsubscribes channel + removes Y.Doc observer |
| 2026-03-02 | `HEAD` | Feat: `components/collaborative-rich-text-editor.tsx` (NEW) — drop-in `RichTextEditor` replacement with Yjs CRDT sync; `StarterKit.configure()` (history removed in TipTap v3), `Collaboration.configure({ document: ydoc })`; 400 ms peer-sync grace window before seeding from DB HTML; same debounced Prisma onSave interface preserved |
| 2026-03-02 | `HEAD` | Feat: `components/modals/card-modal/index.tsx` — `RichTextEditor` swapped to `CollaborativeRichTextEditor` with `key={id}` for per-card Y.Doc isolation, `orgId` and `cardId` passed for channel namespacing; `lib/realtime-channels.ts` — `cardYjsChannel(orgId, cardId)` added with same `:` delimiter validation as board channels; `__tests__/unit/crdt/yjs-provider.test.ts` (NEW, 20 tests) — C1-C17 provider + CRDT convergence + idempotency; C18-C20 channel validation; 1,449/1,449 tests passing |
| 2026-03-02 | `5394b76` | Feat: `lib/audit-sink.ts` (NEW) — immutable append-only audit log sink; streams every audit event to Axiom via `after()` (non-blocking, post-response); Axiom ingest token is Ingest-Only scoped so a leaked key can append but never delete; graceful no-op when unconfigured, production `logger.warn` + Sentry capture on sink failure |
| 2026-03-02 | `5394b76` | Security: `lib/create-audit-log.ts` — dual-write: Prisma shard write (existing) + `streamToAuditSink()` via `after()` so forensic copy is always attempted without delaying the parent server action |
| 2026-03-02 | `5394b76` | Security: `supabase-audit-immutability.sql` (NEW) — `BEFORE DELETE OR UPDATE` Postgres trigger `enforce_audit_log_immutability` on `audit_logs`; fires for all DB roles including `service_role`; raises SQLSTATE `restrict_violation` (23001); idempotent (`CREATE OR REPLACE` + `DROP TRIGGER IF EXISTS`) |
| 2026-03-02 | `5394b76` | Test: `__tests__/unit/audit/audit-forensic-integrity.test.ts` (NEW, 13 cases) — covers: isAuditSinkConfigured, silent dev skip, production warn, correct HTTP request, `_time` ISO serialisation, change-delta forwarding, HTTP 4xx/network-error graceful handling, Sentry capture, DB trigger error simulation for DELETE and UPDATE |
| 2026-03-02 | `5394b76` | Feat: dual-write migration script (`scripts/migrate-org-to-shard.ts`) + PgBouncer guard (`lib/shard-router.ts` `verifyAllShardConnectionStrings`) + README master-shard catalog docs |
| 2026-03-02 | `88dd67e` | Feat: `lib/shard-router.ts` — FNV-1a 32-bit consistent-hashing shard router with per-shard PrismaClient pool, 30 s health cache, automatic failover to next healthy shard, fail-open to shard 0 on total outage; `getDbForOrg(orgId)` is the public API |
| 2026-03-02 | `88dd67e` | Feat: `app/api/health/shards/route.ts` — `GET /api/health/shards` endpoint (Bearer `CRON_SECRET`); returns per-shard health map with HTTP 200 (all healthy), 207 (partial), or 503 (all down) |
| 2026-03-02 | `88dd67e` | Feat: `lib/shard-router.ts` `verifyAllShardConnectionStrings()` — PgBouncer guard logs WARN at module-load time if any `SHARD_n_DATABASE_URL` lacks port 6543 or `?pgbouncer=true`; prevents connection-limit exhaustion under serverless load |
| 2026-03-02 | `88dd67e` | Feat: `scripts/migrate-org-to-shard.ts` — dual-write window migration script; copies all 38 org-scoped tables (FK-dependency order, batches of 100 rows, `ON CONFLICT DO NOTHING` idempotent) from source shard to target shard before env-var cutover; dry-run by default, `--execute` to write |
| 2026-03-02 | `88dd67e` | Feat: `scripts/test-shard-failover.ts` — 4-step shard failover test: distribution audit → parallel health probes → per-shard direct queries → failover simulation; runnable with `npm run test:shards` |
| 2026-03-02 | `973751a` | Fix: `hooks/use-realtime-board.ts` — per-card 2-second suppression window (`Map<cardId, suppressUntil>` ref + `markLocalCardUpdate()`) prevents remote Supabase UPDATE broadcasts from snapping dragged cards back to their old position during concurrent drags |
| 2026-03-02 | `973751a` | Fix: `actions/delete-card.ts` — Supabase Storage `remove()` called in `after()` async callback cleans orphaned attachment blobs when a card is deleted; Prisma cascade handles DB rows, this handles the physical files |
| 2026-03-02 | `973751a` | Security: `app/shared/[token]/page.tsx` + `actions/board-share-actions.ts` — explicit Prisma `select` whitelist on all unauthenticated shared-board queries; `orgId`, `createdById`, and all non-display columns structurally excluded (not just hidden) |
| 2026-03-02 | `973751a` | Fix: `hooks/use-ai-cooldown.ts` (new) — 10-second client-side cooldown hook with live countdown; wired into `checklists.tsx` (checklist suggestions), `card-modal/index.tsx` (description generation), `list-item.tsx` (priority suggestion debounce guard); blocks repeat OpenAI calls before the server-side rate limiter fires |
| 2026-03-02 | `973751a` | Note: `actions/dependency-actions.ts` — `wouldCreateCycle()` BFS (MAX_VISITED=500) was already fully implemented; no code change required |
| 2026-03-02 | `c7c72ce` | Feat: `/api/cron/lexorank-rebalance` — weekly cron endpoint normalises all LexoRank order strings before the 64-char DoS limit is reached; `CRON_SECRET` bearer-token auth; full audit trail |
| 2026-03-02 | `c7c72ce` | Feat: `hooks/use-presence.ts` Visibility API integration — presence channel unsubscribes immediately on `document.hidden`, resubscribes on tab focus; throttled sync prevents N² event storms |
| 2026-03-02 | `c7c72ce` | Test: `e2e/board-golden-path.spec.ts` — full Playwright E2E golden path covering sign-up → org → board creation → card drag → checklist → share link → billing upgrade |
| 2026-03-02 | `c7c72ce` | Perf: SSE keepalive (`/api/events` 15 s comment frames) + `lib/db-preheat.ts` (connection establishment on startup) + `next.config.ts` `experimental.instrumentationHook` — eliminates cold-start latency spikes |
| 2026-03-02 | `c7c72ce` | Docs: README non-tutorial table + SSO enterprise roadmap + offline-mode progressive enhancement roadmap entries added |
| 2026-03-02 | `7272611` | Test: All 43 unit test suites fixed — 1,349 / 1,349 tests passing (0 failing); root causes: missing `board-permissions` mock, `jest.resetAllMocks()` stripping `clerkClient` implementation, incorrect `auth` vs `getTenantContext` mock targets, wrong MIME type / file size fixture values |
| 2026-03-02 | `2550b71` | Security: `lib/rate-limit.ts` rewritten async — Upstash Redis sliding-window when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set; in-memory fallback on Redis error (fail-open) |
| 2026-03-02 | `2550b71` | Security: Stripe idempotency — `ProcessedStripeEvent` model + Prisma `P2002` guard before webhook `switch`; duplicate Stripe events silently ack'd without re-processing |
| 2026-03-02 | `2550b71` | Security: `app/api/realtime-auth` — new GET endpoint verifying org membership + `BoardMember` row before any Supabase channel subscription; fail-closed on DB error |
| 2026-03-02 | `2550b71` | Security: `hooks/use-presence.ts` + `hooks/use-card-lock.ts` — pre-flight call to `/api/realtime-auth` before subscribing to any Supabase channel; authenticated Supabase client; org-scoped channel names |
| 2026-03-02 | `2550b71` | Security: `supabase-realtime-rls.sql` — RLS policies for `realtime.messages` + `realtime.subscription` scoped to JWT `org_id` claim |
| 2026-03-02 | `503c1c8` | Security: RBAC desync fixed — `lib/tenant-context.ts` healing path wrapped in `db.$transaction()`, uses real DB `isActive`/`status`, immediately throws `FORBIDDEN` for suspended rows |
| 2026-03-02 | `503c1c8` | Security: Realtime auth — `hooks/use-realtime-analytics.ts` now uses `getAuthenticatedSupabaseClient(token)` with Clerk JWT (was unauthenticated) |
| 2026-03-02 | `503c1c8` | Security: LexoRank DoS guard — `update-card-order.ts` + `update-list-order.ts` reject order strings > 64 chars |
| 2026-03-02 | `503c1c8` | Security: Stripe replay guard (300 s staleness check) + TOCTOU fix (`updateMany` with subscription ID guard) in webhook handler |
| 2026-03-02 | `503c1c8` | Security: AI prompt injection protection — `sanitizeForPrompt()` strips control chars; all 3 OpenAI calls now use `system`/`user` role separation |
| 2026-02 | `9c8591c` | Security: `lib/rate-limit.ts` — new in-memory sliding-window rate limiter; applied to `/api/ai` at 20 req/user/min with 429 + `Retry-After` |
| 2026-02 | `9c8591c` | Security: HSTS + `Cross-Origin-Opener-Policy` + `Cross-Origin-Resource-Policy` + `X-Permitted-Cross-Domain-Policies` added to `next.config.ts` |
| 2026-02 | `9c8591c` | Security: Vercel function `maxDuration` explicit timeouts added to `vercel.json` (upload=60 s, ai=30 s, cron=300 s) |
| 2026-02 | `9c8591c` | Fix: Mass `bg-linear-to-*` → `bg-gradient-to-*` correction across 20+ files (invalid Tailwind v4 class that silently produced no gradients) |
| 2026-02-24 | `ecf5122` | Fix: Mobile view — `sidebar.tsx` + `mobile-nav.tsx` Clerk components (`OrganizationSwitcher`, `UserButton`) loaded via `dynamic({ ssr: false })` with skeleton placeholders; eliminates hydration mismatch and CLS |
| 2026-02-24 | `ecf5122` | Fix: `AriaLiveRegion` hydration mismatch — `mounted` guard added; component returns `null` until after first client render |
| 2026-02-24 | — | Fix: Unsplash `/api/unsplash` 500 → 200 — null-check guard returns `{ photos: [], unconfigured: true }` when key missing; unified `UNSPLASH_ACCESS_KEY` key handling; removed dangerous `NEXT_PUBLIC_` server fallback |
| 2026-02-24 | — | Fix: Board creation flow — `fieldErrors.title` branch added to handler; templates seeded with 8 professional templates |
| 2025-07 | — | Fixed file upload route (`POST /api/upload`) — proper try/catch error handling, `sb_secret_*` key format support |
| 2025-07 | — | Eliminated React hydration mismatch in `board-header.tsx` — replaced all Tailwind v4-only shorthands with bracket equivalents |
| 2025-07 | — | Card modal delete flow wired end-to-end — `handleDeleteCard` connected to both dropdown and sidebar delete buttons |
| 2025-07 | — | Removed render-blocking `@import url(fonts.googleapis.com/...)` from card modal — fonts load globally via `next/font` |
| 2025-07 | — | Fixed board tab icon visibility — added `group` + `group-data-[state=active]:opacity-100` pattern for active state |

---

## Contributing

```bash
# 1. Fork the repository

# 2. Create a feature branch
git checkout -b feature/your-feature-name

# 3. Make your changes and write tests

# 4. Verify everything passes
npx tsc --noEmit        # TypeScript type check
npm run lint            # ESLint
npm test                # Jest

# 5. Commit with conventional format
git commit -m "feat: add your feature description"

# 6. Push and open a Pull Request
git push origin feature/your-feature-name
```

### Commit Convention

| Prefix | Use For |
|---|---|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `chore:` | Maintenance, dependency updates |
| `docs:` | Documentation changes |
| `test:` | Adding or updating tests |
| `refactor:` | Code restructuring, no behavior change |
| `perf:` | Performance improvement |
| `security:` | Security fix or hardening |

---

## License

MIT License — Copyright (c) 2026 Viraj Pankaj Jain

See [LICENSE](LICENSE) for the full license text.

---

## Acknowledgements

- [Next.js](https://nextjs.org) — App Router, Server Components, Server Actions
- [React](https://react.dev) — UI library with React Compiler
- [Prisma](https://prisma.io) — Type-safe ORM and migration tooling
- [Clerk](https://clerk.com) — Multi-organization authentication
- [Stripe](https://stripe.com) — Payment processing and billing
- [Supabase](https://supabase.com) — Realtime WebSockets and PostgreSQL hosting
- [Tailwind CSS](https://tailwindcss.com) — Utility-first CSS
- [shadcn/ui](https://ui.shadcn.com) — Accessible UI primitives
- [@dnd-kit](https://dndkit.com) — Drag-and-drop toolkit
- [TipTap](https://tiptap.dev) — Rich text editor
- [Recharts](https://recharts.org) — Charting library
- [Framer Motion](https://www.framer.com/motion) — Animation library
- [Zod](https://zod.dev) — Schema validation
- [Sentry](https://sentry.io) — Error tracking and performance monitoring
- [Resend](https://resend.com) — Transactional email
- [OpenAI](https://openai.com) — AI features

---

<div align="center">
  <sub>Built with precision. Designed for scale. Documented for clarity.</sub>
</div>