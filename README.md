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
- **AI-powered workflows** — Checklist generation, card suggestions, and content summaries via OpenAI
- **Stripe billing** — FREE and PRO plans with full webhook lifecycle management
- **Public REST API** — API key authentication with per-scope permissions
- **GDPR compliant** — Data export and deletion endpoints built in
- **Production-ready security** — SSRF protection, audit logs, rate limiting, Row-Level Security

> Built as a self-hostable alternative to Trello and Jira — with multi-organization support, a public API, and enterprise-grade security architecture out of the box.

**Code quality status:**
- TypeScript: **0 errors** across all 99 components, 40 server actions, and 34 lib modules
- ESLint: **0 warnings** — all Tailwind v4 utilities, a11y rules, and import rules pass cleanly
- Hydration: **0 mismatches** — all CSS utilities use bracket syntax (`gap-[5px]`, `h-[30px]`) for consistency between server and client renders

**What makes the architecture distinct:**
- `orgId` is **always** extracted from the Clerk JWT — never accepted from client parameters
- Even organization owners need an explicit `BoardMember` row to access a board (dual-gate model)
- Supabase is used **exclusively** for WebSocket events — all DB reads/writes go through Prisma
- RLS enforces tenant boundaries at the database level, even if application checks are bypassed

---

## Screenshots

> All screenshots are located in the `Web-screenshort/` folder.  
> The application fully supports **dark mode** (default) and **light mode** with an instant toggle.

---

### Sign In

![Sign In](Web-screenshort/Signin.png)

- Clerk-managed authentication page at `/sign-in`
- Supports email + password login and social OAuth providers (Google, GitHub, etc.)
- "Continue with…" buttons for one-click social sign-in
- Branded with Nexus logo and dark background
- Redirects to Dashboard after successful authentication
- Includes a "Sign up" link for new users
- Fully accessible — keyboard navigable, screen-reader friendly

---

### Sign Up

![Sign Up](Web-screenshort/Signup.png)

- Clerk-managed registration page at `/sign-up`
- Email verification step (magic link or OTP sent via Clerk)
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

- Billing management page at `/billing`
- **Plan overview card:**
  - Current plan badge (FREE or PRO)
  - Board usage meter for FREE plan (`X of 50 boards`)
  - PRO plan benefits listed: unlimited boards, priority support
- **Upgrade to PRO section:**
  - Monthly (£9/month) and yearly (£90/year) plan options
  - "Upgrade" button → creates Stripe Checkout Session → redirects to Stripe-hosted checkout
  - Promotion code input field
- **Active subscription card (PRO users):**
  - Current billing period start/end dates
  - Next billing date
  - "Manage Billing" button → creates Stripe Customer Portal Session → self-service portal
  - Cancel subscription option (handled by Stripe portal)
- **Webhook lifecycle** — all Stripe events processed by `app/api/webhook/stripe/route.ts`:
  - Plan activates immediately on `checkout.session.completed`
  - `invoice.payment_failed` → shows "Past Due" warning banner
  - `customer.subscription.deleted` → resets to FREE silently
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

## Pages Deep-Dive

### `/` — Landing / Home

- Root route — auto-redirects to `/dashboard` for authenticated users (handled in `proxy.ts` middleware before page render)
- Shows a minimal marketing page for unauthenticated visitors with CTA to sign up
- No data fetching; pure static render

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

- Sliding-window rate limiting per action (in-memory)
- Audit logs with IP address and User-Agent forensics
- Before/after value snapshots in audit trail
- SSRF protection on all outbound webhook deliveries
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

There is no `middleware.ts` file. Auth is enforced at the action/route level:

- **Security headers** applied via `next.config.ts` for all routes
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

### Schema Overview

- **34 models** and **13 enums** in `prisma/schema.prisma`
- All primary keys are CUID strings (not integers)
- Connection via PgBouncer pooler on port 6543 for app queries
- Direct connection on port 5432 for migrations only

### Core Entity Relationship Diagram

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

### Key Model Fields

```
Organization
  id                String   (CUID)
  name              String
  slug              String   (unique)
  region            String
  subscriptionPlan  String   (FREE / PRO)
  stripeCustomerId  String?
  stripeSubscriptionId String?
  aiCallsToday      Int

User
  id          String   (CUID)
  clerkUserId String   (unique)
  email       String   (unique)
  name        String
  imageUrl    String

Board
  id                  String   (CUID)
  orgId               String   (FK → Organization)
  title               String
  isPrivate           Boolean
  imageThumbUrl       String?
  permissionSchemeId  String?  (FK → PermissionScheme)

List
  id       String   (CUID)
  boardId  String   (FK → Board)
  title    String
  order    String   (LexoRank)

Card
  id           String    (CUID)
  listId       String    (FK → List)
  assigneeId   String?   (FK → User)
  title        String
  description  String?
  order        String    (LexoRank)
  priority     Priority  (LOW/MEDIUM/HIGH/URGENT)
  dueDate      DateTime?
  storyPoints  Int?
  sprintId     String?   (FK → Sprint)
  epicId       String?   (FK → Epic)

BoardMember
  id                  String    (CUID)
  boardId             String    (FK → Board)
  userId              String    (FK → User)
  orgId               String
  role                BoardRole (OWNER/ADMIN/MEMBER/VIEWER)
  permissionSchemeId  String?   (FK → PermissionScheme)

AuditLog
  id             String  (CUID)
  orgId          String  (FK → Organization)
  boardId        String? (FK → Board)
  action         ACTION  (enum)
  entityType     ENTITY_TYPE (enum)
  entityId       String
  ipAddress      String
  userAgent      String
  previousValues Json
  newValues      Json
```

### Database Design Decisions

- **CUID primary keys** — Avoids integer sequence guessing, safe for distributed systems
- **LexoRank `order` field** — Cards and lists use string ordering (`"m"`, `"n"`, `"o"`) for O(1) reordering
- **Denormalized user fields** — `Comment` and `AuditLog` store `userName`/`userImage` directly to avoid joins and preserve historical accuracy
- **JSON columns** — `Automation.trigger/conditions/actions`, `WebhookDelivery.payload`, `AuditLog.previousValues/newValues`, `BoardAnalytics.weeklyTrends` all use JSON for schema-less flexibility
- **Cascade deletes** — Board deletion cascades to lists → cards → comments/attachments/checklists/members
- **Organization deletion is NOT cascaded** (intentional safety guard)

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
| `use-realtime-board` | Supabase WebSocket subscription — live card/list/comment/reaction updates |
| `use-presence` | Online user tracking on a board — avatar colors, join/leave events |
| `use-card-lock` | Prevents concurrent card edits — broadcasts lock state via presence channel |
| `use-card-modal` | Zustand store — centralized card modal open/close/view/edit mode state |
| `use-keyboard-shortcuts` | Global keyboard listener — modifier key support, ignores input field focus |
| `use-debounce` | Debounces a value or callback — used for auto-save and search inputs |
| `use-optimistic-card` | React `useOptimistic` wrapper for instant label add/remove on cards |
| `use-push-notifications` | Web Push registration via Service Worker and PushManager API |
| `use-realtime-analytics` | Live analytics via Supabase broadcast — card created/completed/deleted events |
| `use-demo-mode` | Guest demo mode detection, read-only enforcement, session tracking |

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
├── hooks/                           # 10 custom React hooks
│   ├── use-realtime-board.ts
│   ├── use-presence.ts
│   ├── use-card-lock.ts
│   ├── use-card-modal.ts
│   ├── use-keyboard-shortcuts.ts
│   ├── use-debounce.ts
│   ├── use-optimistic-card.ts
│   ├── use-push-notifications.ts
│   ├── use-realtime-analytics.ts
│   └── use-demo-mode.ts
│
├── lib/                             # 34 utility modules
│   ├── db.ts                        # Prisma client (db + systemDb)
│   ├── tenant-context.ts            # Multi-tenant auth resolution
│   ├── board-permissions.ts         # RBAC permission matrix
│   ├── action-protection.ts         # Rate limiting + demo guard
│   ├── create-safe-action.ts        # Server action wrapper
│   ├── create-audit-log.ts          # Audit trail
│   ├── event-bus.ts                 # Card event emission
│   ├── automation-engine.ts         # Automation rule evaluation
│   ├── webhook-delivery.ts          # Outbound webhooks + SSRF protection
│   ├── lexorank.ts                  # String-based ordering
│   ├── api-key-auth.ts              # API key validation
│   ├── realtime-channels.ts         # Tenant-isolated channel names
│   ├── stripe.ts                    # Stripe client + config
│   ├── logger.ts                    # Structured logging + Sentry
│   ├── request-context.ts           # IP + User-Agent extraction
│   ├── supabase/client.ts           # Supabase client factory
│   └── ...                          # DAL, email, utils, design tokens, etc.
│
├── prisma/
│   ├── schema.prisma                # 34 models, 13 enums
│   ├── seed.ts
│   └── migrations/
│
├── __tests__/
│   ├── unit/                        # 41 unit test files
│   ├── integration/                 # 1 integration test file
│   └── a11y/                        # 1 accessibility test file
│
├── e2e/                             # 6 Playwright E2E specs
│   ├── auth.setup.ts
│   ├── auth-user-b.setup.ts
│   ├── boards.spec.ts
│   ├── cards.spec.ts
│   ├── tenant-isolation.spec.ts
│   └── user-journeys.spec.ts
│
├── emails/                          # 6 Resend email templates
├── scripts/                         # 4 utility scripts
├── types/                           # TypeScript type definitions
├── public/
│   ├── manifest.json                # PWA manifest
│   ├── sw.js                        # Service Worker
│   ├── icon-192.png
│   └── icon-512.png
│
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
| Components | 99 files |
| Custom Hooks | 10 files |
| Pages | 24 pages |
| API Routes | 31 routes |
| Server Actions | 40 files |
| Lib Modules | 34 files |
| Test Files | 43 files |
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
| `NEXT_PUBLIC_UNSPLASH_ACCESS_KEY` | Unsplash client key | unsplash.com/developers |
| `UNSPLASH_ACCESS_KEY` | Unsplash server key | unsplash.com/developers |
| `RESEND_API_KEY` | Resend email API key | resend.com/api-keys |
| `EMAIL_FROM` | Sender address (must be verified in Resend) | Your domain |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service key for file uploads (`sb_secret_*` format from modern Supabase projects) | Supabase > Settings > API |
| `GIPHY_API_KEY` | Giphy API key | developers.giphy.com |
| `KLIPY_API_KEY` | Alternative GIF provider | klipy.com/developers |
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
| Unit test files | 43 |
| E2E test specs | 6 |
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

**E2E (Playwright)**
- `boards.spec.ts` — Board creation, navigation, management
- `cards.spec.ts` — Card CRUD and interactions
- `tenant-isolation.spec.ts` — Multi-tenant data isolation (two users, two orgs)
- `user-journeys.spec.ts` — Full end-to-end user workflows

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

Implementation in `lib/action-protection.ts`:

- Sliding-window limiter using in-memory `Map<string, number[]>` with 60-second windows
- Per-action limits:
  - Card creation: 60 requests/minute
  - Card reorder: 120 requests/minute
  - Default: 30 requests/minute
- Returns `{ allowed, remaining, retryAfter }` for client-side handling

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

### Security Headers

Configured in `next.config.ts` for all routes:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### Input Validation

- All Server Actions validate input via Zod schemas before any processing
- Prisma uses parameterized queries throughout — SQL injection is not possible
- `TenantError` messages are mapped to generic client-safe strings — internal IDs and stack traces never reach the client

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

## Workflow Diagrams

### User Onboarding Flow

```mermaid
flowchart TD
    A["User visits Nexus"] --> B{"Has account?"}
    B -->|No| C["Sign Up via Clerk"]
    B -->|Yes| D["Sign In via Clerk"]
    C --> E["Clerk creates user"]
    E --> F["getTenantContext() heals:<br/>Creates User + OrganizationUser rows"]
    F --> G["Redirect to Dashboard"]
    D --> G
    G --> H{"Has organization?"}
    H -->|No| I["Create or join organization"]
    H -->|Yes| J{"Has boards?"}
    I --> J
    J -->|No| K["Create first board (or use template)"]
    J -->|Yes| L["Show board list"]
    K --> L
```

### Card Lifecycle

```mermaid
flowchart LR
    Create["Create Card"] --> Assign["Assign Member"]
    Assign --> Labels["Add Labels + Priority"]
    Labels --> Track["Track Time"]
    Track --> Move["Move Between Lists (Drag & Drop)"]
    Move --> Complete["Mark Complete"]
    Complete --> Archive["Archive"]

    subgraph "Throughout Lifecycle"
        Comment["Add Comments"]
        Attach["Upload Files"]
        Checklist["Update Checklists"]
        Deps["Link Dependencies"]
    end
```

### Server Action Execution Flow

```mermaid
sequenceDiagram
    participant Client as Browser
    participant SA as Server Action
    participant CSA as createSafeAction
    participant TC as getTenantContext
    participant DB as PostgreSQL
    participant EB as Event Bus

    Client->>SA: Invoke server action
    SA->>CSA: Validate input (Zod schema)
    alt Validation fails
        CSA-->>Client: { fieldErrors }
    end
    CSA->>TC: getTenantContext()
    TC-->>CSA: { userId, orgId, role }
    CSA->>DB: Execute mutation (scoped by orgId)
    DB-->>CSA: Result
    CSA->>EB: emitCardEvent()
    par Parallel
        EB->>EB: runAutomations()
        EB->>EB: fireWebhooks()
    end
    CSA-->>Client: { data: result }
    Note over Client: Supabase broadcast updates all connected clients
```

---

## Use Case Diagram

```mermaid
graph TB
    subgraph Roles
        Guest["Guest (shared link)"]
        Viewer["Board Viewer"]
        Member["Board Member"]
        Admin["Board Admin"]
        Owner["Org Owner"]
    end

    subgraph Board Interaction
        ViewBoard["View Board"]
        ViewCards["View Cards"]
        CreateCard["Create Cards"]
        EditCard["Edit Cards"]
        DeleteCard["Delete Cards"]
        MoveCard["Drag & Drop Cards"]
        Comment["Add Comments"]
        Attach["Upload Files"]
        Track["Track Time"]
    end

    subgraph Board Management
        CreateBoard["Create Board"]
        EditSettings["Edit Board Settings"]
        ManageMembers["Manage Board Members"]
        ConfigPerms["Configure Permissions"]
        ShareBoard["Share Board (Public Link)"]
        DeleteBoard["Delete Board"]
    end

    subgraph Organisation
        ManageOrg["Manage Org Members"]
        ManageBilling["Manage Billing"]
        ViewAnalytics["View Analytics"]
        ExportData["Export Data / PDF"]
        ConfigAuto["Configure Automations"]
        ManageWebhooks["Manage Webhooks"]
        ManageAPIKeys["Manage API Keys"]
    end

    Guest --> ViewBoard
    Guest --> ViewCards
    Viewer --> ViewBoard
    Viewer --> ViewCards
    Member --> CreateCard
    Member --> EditCard
    Member --> MoveCard
    Member --> Comment
    Member --> Attach
    Member --> Track
    Admin --> DeleteCard
    Admin --> EditSettings
    Admin --> ManageMembers
    Admin --> ConfigPerms
    Admin --> ShareBoard
    Owner --> CreateBoard
    Owner --> DeleteBoard
    Owner --> ManageOrg
    Owner --> ManageBilling
    Owner --> ViewAnalytics
    Owner --> ExportData
    Owner --> ConfigAuto
    Owner --> ManageWebhooks
    Owner --> ManageAPIKeys
```

---

## Scalability

### Current Design

- **Stateless API** — All state lives in PostgreSQL. Any Vercel serverless function can handle any request
- **PgBouncer** — Pools DB connections on port 6543. Prisma connects through the pooler; direct connection on port 5432 for migrations only
- **O(1) ordering** — LexoRank insertions touch exactly one DB row regardless of list size
- **Request deduplication** — `getTenantContext()` wrapped in `cache()` — one auth + DB call per request maximum
- **Edge network** — Vercel global edge for all static assets cached with 1-year immutable headers
- **Event fan-out** — `emitCardEvent()` uses `Promise.allSettled()` — automations and webhooks run in parallel without blocking the HTTP response

### Scaling Considerations

| Concern | Current | Production Scale Path |
|---|---|---|
| Rate limiting | In-memory `Map` (single instance) | Replace with Redis/Upstash for distributed limiting |
| DB connections | Supabase free tier limits | Scale Supabase plan, monitor PgBouncer utilization |
| Realtime connections | Per-project Supabase limits | Shard by organization at high concurrency |
| File storage | Supabase Storage | Add CDN in front of storage bucket |
| Automation engine | Max depth 3, synchronous | Move to background job queue (e.g., BullMQ + Redis) |
| AI quota | Per-org daily counter | Already implemented — extend with per-user limits |

---

## Known Limitations & Roadmap

### Current Limitations

- **Rate limiting is in-memory** — Single-instance only. Multi-instance deployments require Redis
- **Test coverage is ~19.5%** — Core paths (auth, billing, RBAC) are covered; UI components are not
- **No offline support** — Service Worker handles push notifications only, not offline caching
- **No native mobile app** — Web UI is responsive, but no iOS/Android app exists
- **No SSO/SAML** — Enterprise authentication not yet implemented

### Potential Roadmap Items

- Redis-backed distributed rate limiting (Upstash)
- Offline-first support with background sync
- Native mobile application (React Native or enhanced PWA)
- SSO/SAML for enterprise authentication
- Google Calendar and Outlook integration
- AI-powered task prioritization and workload balancing
- Board activity heatmaps
- Advanced historical analytics with trend predictions

---

## Changelog

### Latest Updates

| Date | Change |
|---|---|
| 2025-07 | Fixed file upload route (`POST /api/upload`) — proper try/catch error handling, `sb_secret_*` key format support |
| 2025-07 | Eliminated React hydration mismatch in `board-header.tsx` — replaced all Tailwind v4-only shorthands with bracket equivalents |
| 2025-07 | Mass Tailwind/a11y fix: replaced all `bg-linear-to-*` → `bg-gradient-to-*`, non-standard spacing tokens → bracket values, added missing `aria-label` attributes across 19 files |
| 2025-07 | Card modal delete flow wired end-to-end — `handleDeleteCard` connected to both dropdown and sidebar delete buttons |
| 2025-07 | Removed render-blocking `@import url(fonts.googleapis.com/...)` from card modal — fonts load globally via `next/font` |
| 2025-07 | Fixed board tab icon visibility — added `group` + `group-data-[state=active]:opacity-100` pattern for active state |

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