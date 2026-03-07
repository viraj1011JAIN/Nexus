<div align="center">

<img src="Web-screenshort/Dashboard.png" alt="NEXUS Dashboard" width="100%" style="border-radius: 12px;" />

# NEXUS

**Multi-tenant project management SaaS. Real-time collaboration. Production-inspired security architecture.**

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
[![Tests](https://img.shields.io/badge/Tests-1516%20passing-brightgreen)](/__tests__)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

</div>

---

## For Recruiters & Hiring Managers

> **Read this first. Everything else is for engineers.**

**What it is:** A multi-tenant, real-time project management SaaS — Kanban, Gantt, Calendar, Table, and Workload views — with Stripe billing, AI workflows, and a public REST API.

**What makes it go beyond a tutorial clone:**

- **Custom shard router** (`lib/shard-router.ts`) — FNV-1a consistent hashing routes each organization to a dedicated database shard with health probing and automatic failover. Written from scratch; no library does this.
- **Dual-gate RBAC** — Organization owners still need an explicit `BoardMember` row to access a board. Org role alone grants zero board access. This is the correct pattern for multi-tenant SaaS and the most common privilege-escalation gap candidates miss.
- **Immutable forensic audit logs** — Dual-write to Axiom (append-only, no DELETE API) and a Postgres `BEFORE DELETE OR UPDATE` trigger that blocks mutations from *all* roles including `service_role`. An attacker with a fully compromised DB credential cannot erase evidence.
- **Yjs CRDT collaborative editing** — Concurrent card description edits from multiple users merge automatically with no data loss. Not last-write-wins; operationally-consistent.
- **40-test chaos engineering suite** — Tests prove the platform survives shard kill-switches, Axiom outages, step-up network partitions, and 5s Supabase latency injection.
- **WCAG 2.1 AA accessibility CI** — 10 design-system color tokens validated against contrast thresholds on every build; 57-test axe suite; ARIA live region announces every collaborative event to screen readers in real time.

**Scope:** Solo project — architecture, implementation, security, testing, and deployment by one developer.

**👉 [Try the live demo — no sign-up required →](https://nexus-demo.vercel.app/sign-in)**

---

## For Technical Reviewers

> Jump to what you care about:
> [Architecture Decisions](#architecture-decision-records) · [Security Model](#security) · [Testing Strategy](#testing) · [Non-Tutorial Features](#why-nexus-isnt-a-tutorial-clone) · [File Structure](#file-system-structure)

---

## Table of Contents

- [Role & Architecture Ownership](#role--architecture-ownership)
- [Tech Stack](#tech-stack)
- [Why NEXUS Isn't a Tutorial Clone](#why-nexus-isnt-a-tutorial-clone)
- [Screenshots](#screenshots)
- [Demo Mode](#demo-mode)
- [About](#about)
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
- [Architectural Trade-offs & Roadmap](#architectural-trade-offs--roadmap)
- [Changelog](#changelog)
- [Contributing](#contributing)
- [License](#license)

---

## Role & Architecture Ownership

As the sole developer, I was responsible for end-to-end architecture, implementation, and infrastructure.

**Built from scratch** (no library does these):
- `lib/shard-router.ts` — FNV-1a consistent-hashing shard router with health probing and failover
- `lib/lexorank.ts` — LexoRank O(1) string ordering algorithm with auto-rebalancer cron
- `actions/dependency-actions.ts` — BFS dependency cycle detection (MAX_VISITED=500)
- `lib/step-up-action.ts` — `createStepUpAction` factory with four configurable reverification levels
- `lib/audit-sink.ts` — Immutable forensic dual-write to Axiom
- `lib/yjs-supabase-provider.ts` — Custom Yjs CRDT transport over Supabase Realtime broadcast
- `lib/webhook-delivery.ts` — Outbound webhook engine with SSRF blocklist (RFC-1918 + loopback)
- `lib/colors.ts` — WCAG 2.1 relative-luminance math and contrast CI gate

**Integrated & customized** (not used out-of-the-box):
- **Clerk** — JWT issuance customized to enforce strict `orgId` isolation; `getTenantContext()` healing path inside `db.$transaction()` for RBAC atomicity
- **Stripe** — Webhook handler wrapped with `ProcessedStripeEvent` Prisma model and `P2002` idempotency guard; TOCTOU fix via `updateMany` with subscription ID guard
- **Supabase Realtime** — Used exclusively for WebSocket transport (not as a primary DB); adapted to carry Yjs CRDT binary updates and authenticated with Clerk JWT pre-flight

---

## Tech Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Framework | Next.js (App Router) | 16.1.4 | Server Components, Server Actions, Turbopack |
| Runtime | React | 19.2.3 | UI with React Compiler auto-memoization |
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
| State | Zustand | 5.0+ | Client-side modal state and demo mode |
| Rich Text | TipTap | 3.17+ | WYSIWYG editor, Yjs CRDT collaboration |
| CRDT | Yjs | — | Conflict-free replicated data types |
| Charts | Recharts | 3.7+ | Analytics dashboards and metrics |
| Animations | Framer Motion | 12.29+ | Page transitions, micro-interactions |
| Validation | Zod | 4.3+ | Schema validation for actions and API input |
| Email | Resend | 6.9+ | Transactional email delivery |
| AI | OpenAI | 4.104+ | Card suggestions, checklist generation, summaries |
| Push | Web Push (VAPID) | — | Browser push notifications via Service Worker |
| PDF Export | jsPDF + AutoTable | 4.1+ | Board analytics PDF generation |
| Error Tracking | Sentry | 10.36+ | Error capture and performance monitoring |
| Audit Sink | Axiom | — | Append-only forensic audit log |
| Testing | Jest | 30.2+ | Unit and integration tests |
| E2E Testing | Playwright | 1.58+ | End-to-end browser testing |
| Deployment | Vercel | — | Edge network, serverless functions, cron jobs |

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
| **AI Prompt Injection Protection** | `actions/ai-actions.ts` | `sanitizeForPrompt()` strips control characters; all OpenAI calls use `system`/`user` role separation |
| **Rate Limiter (Redis + In-Memory)** | `lib/action-protection.ts` | Sliding-window via Upstash Redis when configured; automatic in-memory fallback so local dev needs no Redis |
| **RLS at Database Level** | `prisma/migrations/rls_policies.sql` | Row-Level Security policies on every tenant-scoped table — application-layer bypasses are blocked at the DB |
| **Full-Board CSV + JSON Export** | `actions/import-export-actions.ts` | Complete board snapshots including checklists, labels, and assignees — not just a title list |
| **Public REST API with Scoped Keys** | `app/api/v1/` | Per-scope API keys (`nxk_` prefix) stored as SHA-256 hashes — never retrievable after creation |
| **Realtime Drag Race Guard** | `hooks/use-realtime-board.ts` | Per-card 2-second suppression window stored in a `Map` ref — remote Supabase broadcasts are silently dropped for cards that were just dragged locally, preventing board snap-back |
| **Storage Cleanup on Card Delete** | `actions/delete-card.ts` | Fetches all attachment `storagePaths` before Prisma cascade delete, then calls Supabase Storage `remove()` in `after()` — orphaned blobs are cleaned even though Prisma cascades only remove DB rows |
| **Share Link Field Whitelist** | `app/shared/[token]/page.tsx` | Unauthenticated shared-board responses use an explicit Prisma `select` — `orgId`, `createdById`, and all non-display columns are structurally excluded, not redacted |
| **AI Frontend Cooldown** | `hooks/use-ai-cooldown.ts` | 10-second client-side cooldown on every AI trigger button with live countdown — prevents OpenAI quota burn before the server-side rate limiter fires |
| **Dependency Cycle Detection (BFS)** | `actions/dependency-actions.ts` | `wouldCreateCycle()` runs a breadth-first search (MAX_VISITED=500) across the full dependency graph before any new edge is saved |
| **Collaborative ARIA Live Announcements** | `hooks/use-realtime-board.ts` + `components/accessibility/aria-live-region.tsx` | Every remote Supabase board event triggers a human-readable screen-reader announcement via a centralized ARIA live region |
| **WCAG 2.1 AA Contrast CI Shield** | `lib/colors.ts` + `__tests__/a11y/accessibility.test.tsx` | 10 design-system tokens run through full WCAG 2.1 relative-luminance math on every build; one failing token fails the entire suite |
| **CRDT Collaborative Editing** | `lib/yjs-supabase-provider.ts` | Card descriptions use Yjs CRDTs over Supabase Realtime broadcast — concurrent edits merge automatically with no data loss |
| **Database Shard Router** | `lib/shard-router.ts` + `app/api/health/shards/` | FNV-1a 32-bit hash routes each `orgId` to a deterministic shard; 30s TTL health cache; automatic failover |
| **Step-Up Authentication** | `lib/step-up-action.ts` | `createStepUpAction(schema, handler, level)` factory wraps any destructive server action with a mandatory biometric/TOTP re-verification challenge; four strictness levels |
| **Service Layer Architecture** | `lib/services/` | Thin orchestrators: auth → validate → rate-limit → delegate. Service modules (`ai-service.ts`, `pdf-service.ts`) are independently testable with zero coupling to Next.js internals |
| **Deterministic Test Contracts** | `__tests__/unit/` | Zod error messages asserted verbatim; Stripe logger first-arg is an exact string; AI DB update asserted with exact payload — every assertion fails for the right reason |
| **Chaos Engineering Suite** | `__tests__/unit/chaos/` + `e2e/chaos.spec.ts` | 40 tests: SK1-SK16 shard kill-switch, AO1-AO12 Axiom outages, NP1-NP10 step-up network partitions, CE-1-CE-6 E2E resilience scenarios |

> The files above are where the non-standard work lives. The `lib/` directory is where bespoke business logic is — not boilerplate.

---

## Screenshots

> All screenshots are in the `Web-screenshort/` folder. The application fully supports **dark mode** (default) and **light mode**.

### Brand Intro Animation (~12s cinematic sequence)

- **0–1s** — 220-star field materialises from black, hex grid fades in
- **1–2s** — 20 data-stream columns rain down with real tech stack names (Next.js, Prisma, Stripe…)
- **2–3s** — 200 physics particles converge from all edges toward center
- **~3s** — **NEXUS** logo explodes into view with white flash, dual shockwave rings, 14 light rays
- **3–5s** — Particles settle into 3 counter-rotating orbit rings with glowing cyan/pink/violet dots
- **5–7s** — Tagline + 4 live metrics (1,345 Tests · 30+ Technologies · Multi-Tenant · Real-time) fade up
- **~6s** — 18 tech badges materialise at viewport edges
- **~7s** — Second shockwave burst with 10 additional light rays
- **~8s** — "Crafted by / Viraj Pankaj Jain" appears in animated gold shimmer with expanding underline

**Visual effects:** Chromatic aberration glitch (cyan + pink split layers) · physics-based particle repulsion from mouse cursor · 3 counter-rotating orbit tracks · connected constellation lines · radial center glow · progress bar gradient · Orbitron glitch text · floating character bob · scan line · "Skip ›" button for recruiters in a hurry

**Tech:** Triple-layered `<canvas>` (stars / particles+connections / shockwaves+rays) at 60 fps, CSS keyframe animations for UI elements, `useSyncExternalStore` for SSR-safe client-only rendering (zero hydration mismatch), `sessionStorage` one-shot gate.

---

### Landing Page

![Landing Page](Web-screenshort/Landing%20Page.png)

- Animated starfield canvas background with drifting orbs and constellation lines at 60 fps
- 3D parallax board showcase — three floating mock browser windows that tilt on mouse movement
- Bento feature grid — 7 cards with animated mini-demos
- Tech stack infinite-scroll marquee

---

### Dashboard

![Dashboard](Web-screenshort/Dashboard.png)

- Board grid with Unsplash thumbnails, member counts, and real-time online presence indicators
- Board limit meter on FREE plan
- Organisation switcher, sidebar navigation, user avatar

---

### Boards & Lists (Kanban)

![Boards and Lists](Web-screenshort/Boards%20and%20List.png)

- Drag-and-drop lists and cards via `@dnd-kit` with LexoRank ordering
- Optimistic UI updates — card appears in new position before the server responds
- Real-time collaboration — other users see moves instantly without page refresh

---

### Cards

![Cards](Web-screenshort/Cards.png)

- Priority, due date, labels, assignee, custom fields, checklists, attachments
- Yjs CRDT collaborative rich-text editor — concurrent edits from multiple users merge automatically
- Threaded comments with @mentions and emoji reactions

---

### Real-Time Activity

![Realtime Activity](Web-screenshort/Realtime%20Activity.png)

- Organisation-wide audit log feed with real-time new entries via Supabase broadcast
- Filterable by action type, board, user, and date range
- Before/after value diffs for every mutation

---

### Real-Time Analytics Dashboard

![Realtime Analytics Dashboard](Web-screenshort/Realtime%20Analytics%20Dashboard.png)

- Live board metrics, card completion rates, assignee workload distribution
- PDF export via jsPDF
- Recharts-powered visualisations

---

### Command Palette (⌘K)

![Command Palette](Web-screenshort/Command%20Pallete%20(ctrl%20%2B%20K).png)

- Global keyboard-driven navigation
- Jump to boards, create cards, switch organisation, access settings

---

### Billing

![Billing](Web-screenshort/Billing.png)

- Current plan (FREE / PRO), usage metrics, and upgrade/downgrade controls
- Stripe Checkout and Customer Portal integration
- Webhook-driven plan sync — no page refresh needed after payment

---

### Settings

![Settings](Web-screenshort/Settings.png)

- Org name, members, API keys, automations, webhooks, GitHub/Slack integrations, GDPR tools

---

### Light Mode

![Light Mode](Web-screenshort/Light%20Mode.png)

- Full light-mode implementation with the same design system — not just a color inversion

---

### Sign In

![Sign In](Web-screenshort/Signin.png)

- Particle network canvas background
- Split layout: branding + feature highlights on left, auth card on right
- Guest Demo Mode button — explore the full app without creating an account

---

### Sign Up

![Sign Up](Web-screenshort/Signup.png)

- Matching dark aesthetic with Clerk `<SignUp />` component
- After registration, automatically triggers the healing path in `getTenantContext()`

---

## Demo Mode

**Try the full application without creating an account.**

> **👉 [Live Demo — click "Guest Demo" on the sign-in page →](https://nexus-demo.vercel.app/sign-in)**

The demo mode is production-grade, not a toy — it's the actual application:

- **Zero database writes** — all state is held in in-memory Zustand stores; no real tenant data is touched
- **Full drag-and-drop Kanban** — powered by the same `@dnd-kit` + LexoRank implementation as production
- **Board limit: 2 boards · Card limit: 10 cards** — enforced server-side via `lib/action-protection.ts`
- **Timed session** — 10-minute interval popups (3 dismissals max), then full-screen freeze with sign-up CTA
- **Session persistence** — timer survives page refreshes via `localStorage`
- **`DemoModeProvider`** orchestrates timers; separate popup variants for guest vs. authenticated users

The in-memory store pattern was chosen deliberately: Zustand stores are reset on session end with no cleanup needed, and the architecture proves the business logic is fully decoupled from persistence.

---

## About

NEXUS is a full-stack, multi-tenant project management platform built for teams that need more than a basic Kanban board.

**5 board views** — Kanban, Calendar, Gantt, Table, Workload

**Dual-gate RBAC** — Organization-level + board-level access control with 28 granular permissions

**Real-time collaboration** — Live board updates, cursor presence, card edit locking via Supabase WebSockets

**CRDT collaborative editing** — Yjs CRDTs over Supabase Realtime broadcast — concurrent card description edits from multiple users merge automatically with no data loss

**AI-powered workflows** — Checklist generation, card suggestions, and content summaries via OpenAI

**Stripe billing** — FREE and PRO plans with full webhook lifecycle management

**Public REST API** — API key authentication with per-scope permissions

**GDPR compliant** — Data export and deletion endpoints built in

**Production-inspired security architecture** — SSRF protection, audit logs, rate limiting, Row-Level Security

**Horizontal database sharding** — FNV-1a consistent hashing routes each org to a dedicated shard with automatic health probing and failover (`lib/shard-router.ts`)

**Immutable audit forensics** — dual-write to Axiom append-only cloud log + Postgres `BEFORE DELETE OR UPDATE` trigger ensures audit evidence survives even a fully compromised database credential

**Step-Up authentication** — `createStepUpAction` factory wraps destructive server actions with mandatory biometric/TOTP re-verification, configurable per-action at four strictness levels

**Chaos Engineering** — 40 dedicated tests (plus 6 E2E scenarios) proving the platform survives shard kill-switches, Axiom outages, step-up network partitions, and 5s Supabase latency injection

**WCAG 2.1 AA accessibility** — centralized ARIA live region broadcasts every remote collaborative event to screen readers in real time; 10 design-system color tokens mathematically validated against WCAG contrast thresholds in the automated CI shield

> Built as a self-hostable alternative to Trello and Jira — with multi-organization support, a public API, and production-inspired security architecture.

**Code quality:**
- TypeScript: **0 errors** across all 104 components, 42 server actions, and 36 lib modules
- ESLint: **0 warnings**
- Hydration: **0 mismatches** — all CSS utilities use bracket syntax for consistency between server and client renders
- Tests: **1,516 passing, 0 failing** across 50 test suites (Jest 30 + ts-jest + Playwright)
- Accessibility: **WCAG 2.1 AA** — 10 design-system color tokens validated by CI; ARIA live region delivers real-time collaborative announcements to screen readers

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

React Server Components render data-heavy pages with zero client-side JS. Server Actions co-locate mutations with UI — type-safe, Zod-validated, no custom API routes needed. Built-in `cache()` deduplicates DB calls within a single request.

**Supabase + Prisma together (not one or the other)**

Prisma handles 100% of all read/write queries with full TypeScript type safety. Supabase is used exclusively for its Realtime engine — `postgres_changes`, `presence`, `broadcast`. The database connection goes through Prisma via PgBouncer (port 6543). The Supabase client never writes to the database directly.

**Clerk over NextAuth**

Built-in multi-organization support with org-scoped JWTs. The `orgId` JWT claim is the foundation of the entire tenant isolation model. Webhook-driven user provisioning with auto-healing on first sign-in.

**LexoRank over integer or fractional ordering**

String-based ordering: O(1) insertions, only one DB row updated per move. No floating-point degradation after many insertions (unlike fractional indexing). Built-in rebalancing when strings grow too long.

**Server vs Client Component split**

Server components handle data fetching, layout shells, board pages, and settings pages. Client components handle drag-and-drop, real-time subscriptions, modals, command palette, and presence. React Compiler provides automatic memoization — no manual `useMemo`/`useCallback` needed.

**Next.js monolith (intentional)**

This is a well-built Next.js monolith. That is deliberately the right call for this scale. The architecture does not imply microservices — the service layer (`lib/services/`) provides logical separation without the operational overhead of distributed services at this stage.

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

Each board can have a custom `PermissionScheme` that overrides the default role-to-permission matrix. Individual `BoardMember` records can also have their own `PermissionScheme` for member-level customization. 28 granular permissions cover every action: `CREATE_CARD`, `DELETE_CARD`, `MOVE_CARD`, `MANAGE_MEMBERS`, `CHANGE_PERMISSIONS`, and more.

### Realtime Channel Isolation

Every Supabase channel name includes `orgId`: `org:{orgId}:board:{boardId}`. `lib/realtime-channels.ts` validates that `orgId` does not contain the `:` delimiter before constructing channel names. This prevents injection attacks and ensures WebSocket events never leak across tenants.

### Database-Level RLS

The Prisma client sets `app.current_org_id` as a PostgreSQL session variable on every connection. Row-Level Security policies filter all queries by this variable at the database engine level. Even if application-level RBAC checks are bypassed, data from other organizations cannot be read. A separate `systemDb` Prisma client bypasses RLS for trusted system operations (Stripe webhooks, cron jobs).

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

- **`proxy.ts` middleware** — Clerk `clerkMiddleware()` runs on every non-static request. Unauthenticated users on protected routes are redirected to `/sign-in`. Security headers (CSP, HSTS, X-Frame-Options, etc.) are injected here.
- **Server Actions** call `getTenantContext()` as the first operation
- **API routes** call `authenticateApiKey()` for public v1 endpoints, or `getTenantContext()` for internal endpoints

---

## Database Architecture

### Overview

Nexus uses **PostgreSQL** hosted on **Supabase**. All database access goes through **Prisma ORM**. The database is never accessed directly from the browser.

- **41 models** — every concept in the app has its own table
- **13 enums** — fixed value sets: `BoardRole`, `BoardPermission`, `Priority`, `ACTION`, `ENTITY_TYPE`, `SprintStatus`, and more
- **All primary keys are CUID strings** — collision-resistant, URL-safe, do not expose creation order to attackers
- **Two database connections:**
  - `DATABASE_URL` → PgBouncer pooler on port **6543** — used by the app for all reads and writes
  - `DIRECT_URL` → direct PostgreSQL on port **5432** — used only by Prisma Migrate
- **Row-Level Security (RLS)** — the app sets `app.current_org_id` as a PostgreSQL session variable; RLS policies filter at the DB engine level
- **Cascade deletes configured carefully** — Deleting a Board cascades to Lists → Cards → all child entities. Deleting an Organization does **not** cascade automatically (intentional safety guard).
- **JSON columns** — automation triggers/conditions/actions, webhook payloads, and audit log before/after snapshots are all stored as JSON
- **Denormalized user fields** — `Comment` and `AuditLog` store `userName` and `userImage` directly so historical records remain accurate even if a user changes their profile

### Core Entity Relationship Diagram

```mermaid
erDiagram
    Organization ||--o{ Board : "has many"
    Organization ||--o{ OrganizationUser : "has members"
    Organization ||--o{ AuditLog : "records activity"
    Organization ||--o{ Label : "defines (via orgId FK)"
    Organization ||--o{ Automation : "configures"
    Organization ||--o{ Webhook : "registers"
    Organization ||--o{ ApiKey : "issues"
    Organization ||--o{ PermissionScheme : "creates"
    Organization ||--o{ Notification : "delivers"
    Organization ||--o{ Epic : "plans"
    Organization ||--o{ Initiative : "tracks"
    Organization ||--o{ BoardTemplate : "provides"
    Organization ||--o{ CustomField : "defines"
    Organization ||--o{ MembershipRequest : "receives"
    Organization ||--o{ BoardShare : "manages"

    Board ||--o{ List : "has columns"
    Board ||--o{ BoardMember : "has members"
    Board ||--o{ Sprint : "has sprints"
    Board ||--o{ BoardShare : "has share links"
    Board ||--o{ Epic : "scopes"
    Board ||--o{ Automation : "triggers"
    Board ||--o{ MembershipRequest : "receives"
    Board ||--|| BoardAnalytics : "has metrics"
    Board }o--o| PermissionScheme : "governed by"

    List ||--o{ Card : "contains"

    Card ||--o{ Comment : "has comments"
    Card ||--o{ Attachment : "has files"
    Card ||--o{ Checklist : "has checklists"
    Card ||--o{ TimeLog : "tracks time"
    Card ||--o{ CardLabelAssignment : "tagged with"
    Card ||--o{ CustomFieldValue : "stores field data"
    Card ||--o{ CardDependency : "blocks / blocked by"
    Card }o--o| User : "assigned to"
    Card }o--o| Sprint : "belongs to"
    Card }o--o| Epic : "linked to"

    Label ||--o{ CardLabelAssignment : "applied via"

    Comment ||--o{ CommentReaction : "has reactions"
    Comment }o--o| Comment : "threaded replies"

    Checklist ||--o{ ChecklistItem : "has items"

    Initiative ||--o{ Epic : "groups"

    User ||--o{ OrganizationUser : "member of"
    User ||--o{ TimeLog : "logs time"
    User ||--o{ ApiKey : "owns"
    User ||--o{ Notification : "receives"
    User ||--|| UserPreference : "has settings"

    BoardMember }o--o| PermissionScheme : "overridden by"

    PermissionScheme ||--o{ PermissionSchemeEntry : "defines grants"
```

---

## Drag & Drop System

The drag-and-drop system uses `@dnd-kit` with LexoRank string ordering and optimistic UI updates.

**LexoRank ordering:**
- O(1) insertions — only 1 DB row is updated per move, regardless of list size
- Strings like `a`, `c`, `b` encode position without integers
- A weekly cron (`/api/cron/lexorank-rebalance`) re-normalises long strings before the 64-char DoS limit is reached
- LexoRank DoS guard: order strings > 64 chars are rejected at the server action level

**Drag Race Guard:**
A `Map<cardId, suppressUntil>` ref prevents remote Supabase broadcasts from snapping a card back to its old position during concurrent drags. The suppression window is 2 seconds — short enough that remote updates from *other* users still arrive promptly.

**Flow:**
1. User picks up a card → `DragOverlay` ghost follows cursor
2. UI updates immediately (optimistic update at 0ms)
3. On drop, LexoRank calculates `newOrder` from neighbours
4. `update-card-order` Server Action validates, checks RBAC, writes to DB
5. `emitCardEvent()` fires automations and HMAC-signed outbound webhooks via `after()`
6. Supabase `postgres_changes` broadcasts to all board subscribers
7. Every other user's UI updates in real time
8. If the server action fails, the optimistic update rolls back

---

## Real-Time System

**Architecture principle:** Supabase Realtime is used **exclusively** as a WebSocket transport layer. All data reads and writes go through Prisma. Supabase never touches the database directly from the application.

**Channel naming:** `org:{orgId}:board:{boardId}` — every channel is tenant-scoped. Channel names are validated for the `:` delimiter before construction to prevent injection.

**Security:** Before subscribing to any channel, `hooks/use-presence.ts` and `hooks/use-card-lock.ts` make a pre-flight call to `/api/realtime-auth`. That endpoint verifies Clerk JWT, checks `OrganizationUser` active membership, and verifies `BoardMember` row — fail-closed on any DB error.

**CRDT Collaborative Editing (`lib/yjs-supabase-provider.ts`):**
- Card descriptions use Yjs CRDTs over a Supabase Realtime broadcast channel
- Concurrent edits from any number of users merge automatically with no data loss
- Replaces last-write-wins debounce with an eventually-consistent operational transform that is idempotent and commutative
- `encodeUpdate/decodeUpdate` safe binary↔base64 roundtrip
- `origin='remote'` tag prevents re-broadcast loops
- `destroy()` unsubscribes channel and removes Y.Doc observer

**Presence:**
- Visibility API integration — presence channel unsubscribes immediately on `document.hidden`, resubscribes on tab focus
- Throttled state sync prevents N² event storms

---

## Payments & Billing

Stripe integration covers the full subscription lifecycle:

**Checkout:** FREE → PRO via Stripe Checkout Session (GBP, `subscription` mode). Webhook-driven plan sync — no page refresh needed after payment.

**Customer Portal:** PRO → self-service changes, cancellation, invoice history via Stripe Customer Portal.

**Webhook hardening:**
- HMAC signature verification via `stripe-signature` header before any processing
- 300-second staleness check rejects replayed events
- `ProcessedStripeEvent` Prisma model + `P2002` unique constraint guard prevents double-processing
- TOCTOU fix: `customer.subscription.deleted` uses `updateMany` with subscription ID guard to prevent stale deletions from overwriting newly-granted PRO status

---

## API Reference

### Base URL

```
https://yourdomain.com/api/v1
```

### Authentication

All v1 endpoints require an API key in the `Authorization` header:

```
Authorization: Bearer nxk_your_api_key_here
```

API keys are created in **Settings → API Keys**. Keys are stored as SHA-256 hashes — the plaintext is shown once at creation and never again.

### Scopes

| Scope | Access |
|---|---|
| `boards:read` | List and view boards |
| `boards:write` | Create and update boards |
| `cards:read` | List and view cards |
| `cards:write` | Create, update, and move cards |
| `members:read` | View organization members |
| `audit:read` | Read audit log entries |

### Endpoints

| Method | Path | Scope | Description |
|---|---|---|---|
| `GET` | `/boards` | `boards:read` | List all boards in the organization |
| `GET` | `/boards/:id` | `boards:read` | Get a board with lists and cards |
| `POST` | `/boards` | `boards:write` | Create a new board |
| `GET` | `/boards/:id/cards` | `cards:read` | List all cards on a board |
| `POST` | `/boards/:id/cards` | `cards:write` | Create a card |
| `PATCH` | `/cards/:id` | `cards:write` | Update a card |
| `DELETE` | `/cards/:id` | `cards:write` | Delete a card |
| `GET` | `/members` | `members:read` | List organization members |
| `GET` | `/audit` | `audit:read` | Get audit log entries |
| `GET` | `/health` | — | Public health check |
| `GET` | `/health/shards` | Bearer `CRON_SECRET` | Per-shard health status map |

---

## Server Actions

All server actions follow the `createSafeAction` pattern:

```typescript
// The pipeline every server action runs through:
// auth → validate → rate-limit → getTenantContext() → requireBoardPermission() → DB mutation → audit log → emitCardEvent()

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await getTenantContext(); // Clerk JWT → orgId (never client input)
  const dal = createDAL(ctx);                          // Sets app.current_org_id for RLS
  await requireBoardPermission(dal, boardId, userId, "CARD_CREATE");
  const result = await dal.cards.create({ ... });
  await createAuditLog({ ... });
  after(() => emitCardEvent(CARD_CREATED, result));    // Non-blocking post-response
  return { data: result };
};

export const createCard = createSafeAction(CreateCardSchema, handler);
```

> **Thin orchestrators:** Server actions are auth → validate → rate-limit → delegate. Heavy logic lives in `lib/services/`. Actions never contain business logic directly.

### Available Actions

**Cards:** `create-card`, `update-card`, `delete-card`, `copy-card`, `update-card-order`, `create-card-from-template`, `bulk-card-operations`

**Lists:** `create-list`, `update-list`, `delete-list`, `copy-list`, `update-list-order`

**Boards:** `create-board`, `delete-board`, `update-board`

**Members:** `create-board-member`, `update-board-member`, `delete-board-member`

**AI:** `generate-card-description`, `suggest-checklists`, `suggest-priority`

**Billing:** `create-checkout-session`, `create-portal-session`

**Webhooks:** `create-webhook`, `update-webhook`, `delete-webhook`, `test-webhook`

**API Keys:** `create-api-key`, `revoke-api-key`

**Automations:** `create-automation`, `update-automation`, `delete-automation`, `toggle-automation`

**Import/Export:** `export-board-csv`, `export-board-json`, `import-board`

---

## Custom Hooks

| Hook | Purpose |
|---|---|
| `use-realtime-board` | Supabase `postgres_changes` subscription; drag race guard; ARIA announcements |
| `use-presence` | Live cursor presence; Visibility API pause/resume; N² storm throttle |
| `use-card-lock` | Mutual exclusion — prevents two users editing the same card simultaneously |
| `use-ai-cooldown` | 10-second client-side cooldown with live countdown for all AI buttons |
| `use-step-up` | Clerk `useReverification()` wrapper — detects magic error object, shows biometric/TOTP modal |
| `use-realtime-analytics` | Live analytics updates via authenticated Supabase client |
| `use-automation-builder` | Local state and validation for the automation rule builder UI |
| `use-board-filter` | Multi-criteria filter state: assignee, label, priority, due date, search |
| `use-lexorank` | Client-side LexoRank midpoint calculation for instant optimistic ordering |

---

## Component Library

Built on **shadcn/ui** (Radix UI primitives) with custom design tokens.

Notable custom components:

- `components/accessibility/aria-live-region.tsx` — Dual-region (polite + assertive) ARIA live announcer; ring-buffer keeps last 5 announcements; SSR-safe with `suppressHydrationWarning`
- `components/collaborative-rich-text-editor.tsx` — TipTap editor with Yjs CRDT sync; per-card Y.Doc isolation via `key={id}`
- `components/board/kanban-board.tsx` — `@dnd-kit` DnD context with `DragOverlay`, multi-list sensors, and suppression window
- `components/modals/card-modal/index.tsx` — Full card editor: Description (CRDT), Activity, Comments, Files, Checklist, Time, Links, Fields tabs
- `components/virtual-scroll.tsx` — Intersection Observer-based virtual scrolling for large card lists
- `components/analytics/realtime-analytics-dashboard.tsx` — Live Recharts dashboard with PDF export

---

## Email Templates

6 Resend transactional email templates in `emails/`:

| Template | Trigger |
|---|---|
| `invite.ts` | New board or org member invitation |
| `assigned.ts` | Card assigned to a user |
| `mention.ts` | User mentioned in a comment |
| `due-soon.ts` | Card due date approaching |
| `digest.ts` | Daily activity summary (cron-triggered) |

All templates share a `_base.ts` layout with consistent NEXUS branding.

---

## File System Structure

```
nexus/
├── app/
│   ├── (platform)/
│   │   ├── dashboard/                  # Protected: board list
│   │   ├── board/[boardId]/            # Protected: dual-gate board view
│   │   │   ├── page.tsx                # Server Component shell
│   │   │   └── settings/              # Board settings
│   │   ├── activity/                   # Org-wide audit log feed
│   │   ├── billing/                    # Stripe checkout + portal
│   │   ├── settings/                   # Org settings hub
│   │   ├── roadmap/                    # Initiatives + Epics
│   │   ├── search/                     # Full-text search
│   │   └── organization/[orgId]/demo-mode/  # Guest demo
│   ├── api/
│   │   ├── v1/                         # Public REST API (scoped API keys)
│   │   ├── webhook/stripe/             # Stripe webhook handler
│   │   ├── realtime-auth/              # Pre-flight Supabase channel auth
│   │   ├── health/                     # Health check + shard status
│   │   ├── ai/                         # OpenAI proxy (rate-limited)
│   │   ├── upload/                     # Supabase Storage upload
│   │   └── cron/
│   │       ├── daily-reports/          # Digest email cron
│   │       └── lexorank-rebalance/     # Weekly LexoRank normalization
│   ├── shared/[token]/                 # Public tokenized board view
│   └── (auth)/
│       ├── sign-in/
│       └── sign-up/
│
├── actions/                            # 42 Server Actions
│   ├── create-card.ts
│   ├── update-card-order.ts
│   ├── dependency-actions.ts          # BFS cycle detection
│   ├── ai-actions.ts                  # prompt injection protection
│   └── ...
│
├── components/
│   ├── accessibility/
│   │   └── aria-live-region.tsx       # WCAG 2.1 AA live announcer
│   ├── board/                         # Kanban, DnD, presence
│   ├── modals/card-modal/             # Full card editor
│   ├── analytics/                     # Recharts dashboards
│   ├── landing/                       # Marketing page components
│   └── ui/                            # shadcn/ui primitives
│
├── lib/
│   ├── shard-router.ts                # FNV-1a shard routing + health cache
│   ├── lexorank.ts                    # String-based O(1) ordering
│   ├── tenant-context.ts              # Multi-tenant auth resolution
│   ├── board-permissions.ts           # 28-permission RBAC resolver
│   ├── step-up-action.ts              # createStepUpAction factory
│   ├── audit-sink.ts                  # Axiom append-only forensic sink
│   ├── create-audit-log.ts            # Dual-write audit trail
│   ├── webhook-delivery.ts            # HMAC-signed outbound webhooks + SSRF
│   ├── yjs-supabase-provider.ts       # Yjs CRDT transport
│   ├── colors.ts                      # WCAG 2.1 contrast math + CI gate
│   ├── rate-limit.ts                  # Upstash Redis + in-memory fallback
│   ├── action-protection.ts           # Per-action sliding-window limits
│   ├── create-safe-action.ts          # Server action wrapper (Zod + TenantError)
│   ├── dal.ts                         # Data access layer (RLS-scoped queries)
│   ├── db.ts                          # Prisma client (db + systemDb)
│   ├── realtime-channels.ts           # Tenant-isolated channel names
│   ├── event-bus.ts                   # Card event emission
│   └── services/
│       ├── ai-service.ts              # OpenAI prompt engineering
│       └── pdf-service.ts             # jsPDF board exports
│
├── prisma/
│   ├── schema.prisma                  # 41 models, 13 enums
│   ├── seed.ts
│   └── migrations/
│
├── __tests__/
│   ├── a11y/                          # 57 axe tests + contrast CI gate
│   ├── integration/
│   └── unit/
│       ├── chaos/                     # 40 chaos engineering tests
│       │   ├── shard-kill-switch.test.ts      # SK1-SK16
│       │   ├── audit-axiom-outage.test.ts     # AO1-AO12
│       │   └── step-up-network-partition.test.ts  # NP1-NP10
│       ├── billing/
│       ├── auth/
│       ├── lexorank/
│       ├── crdt/
│       └── ...
│
├── e2e/                               # 8 Playwright E2E specs
│   ├── golden-path.spec.ts            # Full happy-path user journey
│   ├── tenant-isolation.spec.ts       # Two users, two orgs, zero crossover
│   └── chaos.spec.ts                  # CE-1–CE-6 resilience scenarios
│
├── emails/                            # 6 Resend email templates
├── scripts/
│   ├── migrate-org-to-shard.ts        # Dual-write shard migration
│   ├── seed-demo.ts                   # Demo org data seeding
│   └── test-shard-failover.ts         # 4-step shard failover verification
│
├── supabase-realtime-rls.sql          # RLS for realtime.messages
├── supabase-audit-immutability.sql    # BEFORE DELETE OR UPDATE trigger
└── supabase-performance-indexes.sql   # Performance-critical DB indexes
```

---

## Environment Variables

```bash
# Database
DATABASE_URL=                    # PgBouncer pooler (port 6543)
DIRECT_URL=                      # Direct Postgres for migrations (port 5432)

# Optional: Horizontal sharding (add more as needed)
SHARD_0_DATABASE_URL=            # Shard 0 PgBouncer URL
SHARD_1_DATABASE_URL=            # Shard 1 PgBouncer URL

# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Supabase (Realtime only)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_PRO_MONTHLY_PRICE_ID=

# AI
OPENAI_API_KEY=

# Email
RESEND_API_KEY=

# Error tracking
SENTRY_DSN=

# Audit forensics (optional — app functions without it)
AXIOM_DATASET=
AXIOM_API_KEY=

# Rate limiting (optional — falls back to in-memory)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Cron protection
CRON_SECRET=

# Misc
NEXT_PUBLIC_APP_URL=
UNSPLASH_ACCESS_KEY=
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database (Supabase recommended)
- Clerk account (multi-org features required)
- Stripe account (test mode works for local dev)

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/nexus.git
cd nexus

# 2. Install dependencies
npm install

# 3. Copy environment variables
cp .env.example .env.local
# Fill in all required values

# 4. Run database migrations
npx prisma migrate deploy

# 5. (Optional) Seed the database with demo data
npx tsx scripts/seed-demo.ts

# 6. (Optional) Set up Supabase Storage bucket
npx tsx scripts/setup-storage.ts

# 7. Start the development server
npm run dev
```

### Supabase Setup

Run these SQL files once in your Supabase SQL Editor:

```bash
# 1. Enable Realtime on tables
supabase-enable-realtime.sql

# 2. Enable RLS on Realtime channels
supabase-realtime-rls.sql

# 3. Enable audit log immutability trigger
supabase-audit-immutability.sql

# 4. Add performance indexes
supabase-performance-indexes.sql
```

### Stripe Webhooks (local)

```bash
stripe listen --forward-to localhost:3001/api/webhook/stripe
```

---

## Available Scripts

```bash
npm run dev          # Start dev server with Turbopack
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint
npm run test         # Jest unit + integration tests (watch mode)
npm run test:ci      # Jest with coverage report
npm run test:unit    # Unit tests only
npm run test:integration  # Integration tests only
npx playwright test  # E2E tests (requires running dev server)
npm run analyze      # Bundle size analysis
npx prisma studio    # Prisma database GUI
npm run test:shards  # Shard failover verification
```

---

## Testing

### Test Suite Summary

| Suite | Count | Runner |
|---|---|---|
| Unit tests | ~1,430 | Jest 30 |
| Integration tests | ~30 | Jest 30 |
| Accessibility tests | 83 (57 axe + 26 aria-live) | Jest 30 |
| Chaos engineering | 40 | Jest 30 |
| E2E tests | ~40 | Playwright 1.58 |
| **Total** | **~1,516 passing, 0 failing** | |

> Coverage is intentionally focused on critical business logic — security, auth, billing, and data integrity — rather than chasing UI component snapshot numbers. A brittle high-coverage suite is worse than a robust low-coverage one.

### What Is Tested

**Security & Authentication**
- `tenant-context.test.ts` — Multi-tenant context resolution, healing paths, RBAC atomicity
- `auth/role-permissions.test.ts` — Full RBAC permission matrix
- `security/security-injection.test.ts` — SQL injection, channel name injection prevention
- `api-keys/api-key-auth.test.ts` — SHA-256 hashing and scope validation
- `step-up/step-up-action.test.ts` — `createStepUpAction` factory: unauthenticated rejection, stale-session reverification, TenantError mapping

**Billing**
- `billing/stripe-webhook.test.ts` — All webhook event handlers, replay guard, TOCTOU protection
- `billing/stripe-checkout.test.ts` — Checkout session creation
- `billing/billing-client.test.tsx` — Billing UI component behavior

**Core Algorithms**
- `lexorank/lexorank.test.ts` — String ordering: insertions, midpoints, rebalancing, DoS guard
- `crdt/yjs-provider.test.ts` — CRDT convergence, idempotency, channel validation (C1-C20)

**Chaos Engineering & Resilience**

```
SK1-SK16: Shard kill-switch tests
  FNV-1a determinism, single dead shard (two ERROR log sequence),
  multi-shard failover (WARN + healthy fallback), 30s TTL cache,
  invalidateShardHealthCache recovery

AO1-AO12: Axiom audit outage tests
  AbortSignal 5s timeout, HTTP 429/503 graceful degradation,
  three consecutive captures, Postgres trigger holds when Axiom is dark

NP1-NP10: Step-up network partition tests
  has() throws mid-check, billing handler isolation, concurrent isolation

CE-1-CE-6: E2E chaos scenarios
  /api/health shape, shard 401 guard, 5s Supabase latency injection,
  offline/reconnect indicator, network recovery, step-up cancel leaves board intact
```

> **Exact log contracts:** Every chaos assertion requires the exact forensic string signature of the failure (e.g., `"[SHARD_ROUTER] All shards unhealthy — fail-open to shard 0"`). Any change to the log message immediately surfaces as a test failure — zero false positives.

**Accessibility & WCAG**
- 26-test `aria-live-region` unit suite — hydration safety, polite/assertive delivery, ring-buffer (max 5), SSR guard, collaborative real-time scenarios
- 57-test axe suite — contrast contracts, `AriaLiveRegion` axe audits, WCAG pattern guards, board UI regression guards

**E2E (Playwright)**
- `golden-path.spec.ts` — Full happy-path: sign-up → org → board creation → card drag → checklist → share link → billing upgrade
- `tenant-isolation.spec.ts` — Two users, two orgs; no data crossover
- `chaos.spec.ts` — CE-1–CE-6 resilience scenarios

### Running Tests

```bash
# All tests in watch mode
npm test

# All tests with coverage report
npm run test:ci

# Single file
npx jest --testPathPattern=tenant-context

# E2E tests (requires dev server running)
npx playwright test

# E2E with browser UI
npx playwright test --ui

# Chaos suite only
npx jest --testPathPattern=chaos
```

---

## Security

### Tenant Isolation

- `orgId` is **never** accepted from client input — always extracted from the signed Clerk JWT
- **Row-Level Security (RLS)** — Prisma sets `app.current_org_id` as a PostgreSQL session variable; RLS policies filter at the DB engine level, even if application-layer RBAC checks are bypassed
- **Dual-gate RBAC** — Organization membership and board membership verified independently
- **Realtime channel isolation** — All channels include `orgId`; channel names validated before subscription

### Rate Limiting

**Action-level** (`lib/action-protection.ts`): sliding-window in-memory `Map<string, number[]>` with 60-second windows. Card creation: 60 req/min. Card reorder: 120 req/min. Default: 30 req/min.

**Route-level** (`lib/rate-limit.ts`): Upstash Redis sliding-window when configured; in-memory fallback on Redis error (fail-open). Applied to `/api/ai`: 20 req/user/min; returns 429 + `Retry-After` on breach.

### Webhook Security

- **Inbound (Stripe):** HMAC signature verification before any processing
- **Outbound (user webhooks):** HMAC-SHA256 signing with per-webhook secrets as `X-Nexus-Signature-256`
- **SSRF protection:** Outbound webhooks block private IPv4 ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`), IPv6 private/loopback, and cloud metadata endpoints

### Immutable Audit Forensics

**Layer 1 — Prisma:** In-app Postgres write to the org's shard (powers the activity feed UI)

**Layer 2 — Axiom:** Every audit event streamed to Axiom (append-only cloud log) via `after()` — non-blocking. The ingest token is Ingest-Only scoped: a fully leaked `AXIOM_API_KEY` can only append, never erase.

**Layer 3 — Postgres trigger:** `BEFORE DELETE OR UPDATE` trigger on `audit_logs` raises SQLSTATE `23001` for all DB roles including `service_role`. Only a Postgres superuser with direct server access could disable it.

### Security Headers

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
X-Permitted-Cross-Domain-Policies: none
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload  # HTTPS only
```

### Other Security Measures

- **Step-Up Auth** — Destructive server actions require biometric/TOTP re-verification at four configurable strictness levels
- **LexoRank DoS guard** — Order strings > 64 chars are rejected at the action layer
- **AI Prompt Injection** — `sanitizeForPrompt()` strips control characters; all OpenAI calls use `system`/`user` role separation
- **Stripe TOCTOU fix** — `updateMany` with subscription ID guard prevents stale deletions overwriting new PRO status
- **Share link whitelist** — Explicit Prisma `select` on all unauthenticated shared-board queries; `orgId` and `createdById` structurally excluded
- **Dependency cycle detection** — BFS with MAX_VISITED=500 cap before saving any new dependency edge
- **Realtime drag race guard** — 2-second suppression window prevents remote broadcasts from snapping dragged cards back

---

## Performance Optimizations

| Optimization | Implementation |
|---|---|
| **Turbopack** | Dev server HMR |
| **React Compiler** | `babel-plugin-react-compiler` auto-memoizes all client components |
| **Server Components** | Data-heavy pages render on server with zero client JS |
| **LexoRank** | Card/list reorder updates exactly 1 DB row regardless of list size |
| **React `cache()`** | `getTenantContext()` deduplicated to 1 DB call per request |
| **Optimistic updates** | Card mutations apply to UI before server responds |
| **Virtual scrolling** | `components/virtual-scroll.tsx` renders only visible items |
| **PgBouncer** | Connection pooling via port 6543 for all app queries |
| **Service Worker v2** | 4-strategy caching: cache-first for static/fonts, stale-while-revalidate for images, network-first for HTML, network-only for API/Clerk/Supabase |
| **`experimental.inlineCss`** | Above-the-fold CSS inlined into HTML response, eliminating one render-blocking round-trip |
| **`preconnect` hints** | `img.clerk.com`, Stripe, Unsplash pre-connected to cut avatar and asset load times |
| **Tree-shaking** | `optimizePackageImports` for lucide-react, framer-motion, TipTap, Radix, @dnd-kit, Recharts |
| **Image optimization** | AVIF + WebP formats, 86,400s minimum cache TTL |

---

## Deployment

### Stack

- **Hosting:** Vercel (Edge network, serverless functions)
- **Database:** Supabase (PostgreSQL + Realtime)
- **Auth:** Clerk (hosted)
- **Payments:** Stripe (webhooks via Vercel)
- **Monitoring:** Sentry (error capture + performance)
- **Email:** Resend

### Pipeline

```mermaid
flowchart TD
    A["Feature branch push"] --> B["Vercel Preview Build"]
    B --> B1["npm ci → next build<br/>(TypeScript type-check + ESLint built into Next.js build)"]
    B1 --> B2["Preview URL posted to PR"]
    B2 --> C["Code review + manual smoke test"]
    C -->|"Approved + merged to main"| D["Vercel Production Build"]
    D --> D1["Same pipeline → Zero-downtime deploy"]
    D1 --> E["Manual: npx prisma migrate deploy"]
    E --> F["Production Live"]
    F --> G1["Sentry: error + performance monitoring"]
    F --> G2["Vercel Cron: /api/cron/daily-reports"]
    F --> G3["Vercel Cron: /api/cron/lexorank-rebalance"]
    F --> G4["Supabase Realtime: WebSocket connections"]
    F --> G5["Stripe Webhooks: /api/webhook/stripe"]
```

**Why migrations are manual:** Automatic migration on deploy can cause irreversible data loss if the migration contains a destructive change and the new code is rolled back. The manual step forces explicit sign-off.

**Zero-downtime strategy:** Vercel keeps the previous build live and only cuts traffic over once the new build passes all health checks.

---

## Workflow Diagrams

### 1. Server Action Execution Flow

```mermaid
sequenceDiagram
    participant Client as Browser
    participant CSA as createSafeAction
    participant ZOD as Zod Schema
    participant Handler as Action Handler
    participant TC as getTenantContext()
    participant RL as checkRateLimit()
    participant DAL as createDAL()
    participant RBAC as requireBoardPermission()
    participant DB as PostgreSQL (Prisma + RLS)
    participant EB as Event Bus

    Client->>CSA: User triggers action
    CSA->>ZOD: Validate input shape
    alt Validation fails
        ZOD-->>Client: { fieldErrors } (no DB call made)
    end
    CSA->>Handler: Call handler with validated data
    Handler->>TC: getTenantContext() — reads Clerk JWT via auth()
    TC-->>Handler: TenantContext { userId, orgId, internalUserId, membership }
    Note over TC: On TenantError → createSafeAction catches and returns<br/>{ error: "safe generic message" } (never leaks internals)
    Handler->>RL: checkRateLimit(userId, actionName, limit)
    Note over RL: Window is 60s (hardcoded). Limits per action:<br/>create-card: 60, update-card-order: 120, default: 30
    alt Rate limit exceeded
        RL-->>Client: { error: "Too many requests" }
    end
    Handler->>DAL: createDAL(ctx) — SET app.current_org_id for RLS
    Handler->>RBAC: requireBoardPermission(ctx, boardId, CARD_CREATE)
    alt Permission denied or not a board member
        RBAC-->>Client: { error: "Permission denied" } (via TenantError)
    end
    Handler->>DB: Execute mutation (orgId WHERE clause + RLS double-guard)
    DB-->>Handler: Saved record
    Handler->>Handler: createAuditLog({ previousValues, newValues })
    Handler-->>Client: { data: result }
    Note over Handler,EB: after() runs post-response — never delays the user
    Handler->>EB: after(() => emitCardEvent())
    EB->>EB: Promise.allSettled([runAutomations(), fireWebhooks()])
    Note over EB: Webhooks are HMAC-SHA256 signed with per-webhook secret
```

---

### 2. Authentication & Tenant Isolation Flow

```mermaid
sequenceDiagram
    participant Browser
    participant NextJS as Next.js Server
    participant Clerk as Clerk Auth
    participant TC as getTenantContext()
    participant DAL as createDAL()
    participant PG as PostgreSQL + RLS

    Browser->>NextJS: Any request (page / action / API)
    NextJS->>TC: getTenantContext() — takes no parameters, wrapped in React cache()
    TC->>Clerk: auth() — read signed session cookie
    Clerk-->>TC: { userId, orgId, orgRole } from JWT claims
    Note over TC: orgId is NEVER read from query params or body —<br/>always from the signed Clerk JWT
    TC->>PG: getCachedUserId(clerkUserId) — 60s cross-request cache
    alt User not found (first sign-in)
        TC->>Clerk: clerkClient().users.getUser(userId) — fetch profile
        TC->>PG: INSERT User (healing path — try/catch on unique constraint)
    end
    TC->>PG: getCachedMembership(internalUserId, orgId) — 15s cross-request cache
    alt No membership row (first org access)
        TC->>PG: db.$transaction() — atomic check-then-create OrganizationUser
        Note over TC,PG: Transaction prevents TOCTOU race:<br/>admin could set isActive=false between check and create
    end
    alt isActive = false OR status = SUSPENDED
        TC-->>Browser: TenantError("FORBIDDEN") → safe generic message
    end
    TC-->>NextJS: TenantContext { userId, orgId, internalUserId, membership: { role, status } }
    NextJS->>DAL: createDAL(ctx)
    DAL->>PG: SET app.current_org_id = orgId (enables RLS)
    Note over PG: All subsequent queries filtered at DB engine level —<br/>even if app-layer RBAC is bypassed, data from other orgs is invisible
    PG-->>NextJS: Data for this org only — never another tenant's data
```

---

### 3. Drag & Drop Card Reordering Flow

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant DND as @dnd-kit
    participant OptUI as Optimistic UI
    participant SA as update-card-order Action
    participant DB as PostgreSQL
    participant RT as Supabase Realtime
    participant Other as Other Users

    U->>DND: Starts dragging card
    DND->>OptUI: Show DragOverlay ghost (0ms)
    U->>DND: Drops card in new position
    DND->>OptUI: Update local state immediately (optimistic)
    OptUI->>OptUI: markLocalCardUpdate(cardId) — suppress remote events for 2s
    DND->>SA: update-card-order(cardId, newLexoRankOrder)
    SA->>SA: Zod validation + reject if order > 64 chars (DoS guard)
    SA->>SA: getTenantContext() → orgId from Clerk JWT
    SA->>SA: checkRateLimit(userId, "update-card-order", 120 req / 60s)
    SA->>SA: requireRole("MEMBER") + isDemoContext() guard
    SA->>DB: dal.cards.reorder() — validates card IDs belong to board
    DB-->>SA: Success
    SA->>SA: after(() => emitCardEvent()) — only for cross-list moves
    Note over SA: Same-list reorders skip event emission
    DB->>RT: postgres_changes fires on card row update
    RT->>Other: Broadcast card move event
    Other->>Other: UI updates in real time
    Note over Other: Drag race guard: Map of cardId → suppressUntil timestamp<br/>drops remote events for cards dragged locally within 2s window
    Note over U,OptUI: If SA fails → optimistic update rolls back automatically
```

---

## Use Case Diagram

### How the Two-Gate System Works

- **Gate 1 — Organization Membership:** The user must be an active member of the organization with a role of `OWNER`, `ADMIN`, `MEMBER`, or `GUEST`.
- **Gate 2 — Board Membership:** Even if the user is an org OWNER, they still need an explicit `BoardMember` record. Without it, the board is completely invisible to them.
- **Role independence:** Being an org OWNER does not automatically make you a board OWNER — the two roles are independent.

### Permission Matrix

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
| Create public share links | — | — | — | ✓ | ✓ |
| Manage sprints | — | — | — | ✓ | ✓ |
| Configure automations | — | — | — | ✓ | ✓ |
| Create new boards | — | — | — | — | ✓ |
| Delete boards | — | — | — | — | ✓ |
| Manage org members | — | — | — | — | ✓ |
| Manage billing | — | — | — | — | ✓ |
| Manage API keys | — | — | — | — | ✓ |
| Manage webhooks | — | — | — | — | ✓ |
| Access audit logs | — | — | — | — | ✓ |
| Export org data | — | — | — | — | ✓ |
| GDPR deletion | — | — | — | — | ✓ |

---

## Scalability

### Current Deployment Constraints

Being direct about the current infrastructure limits is the honest answer to "what would you change at scale?":

- **Vercel free tier** — Serverless function cold starts; no persistent connections; 10s function timeout
- **Single Supabase instance** — Single-region; no multi-region WebSocket routing
- **Shard router in app memory** — Health cache is per-instance; in a multi-instance deployment, each instance holds its own cache

### Shard Router Architecture

`lib/shard-router.ts` implements FNV-1a 32-bit consistent hashing to deterministically route each `orgId` to a database shard:

```
orgId → FNV-1a hash → shard index → PrismaClient for that shard
```

- **30-second health cache per shard** — prevents health-check overhead on every query
- **Automatic failover** — on shard failure, routes to next healthy shard
- **Fail-open** — on total outage, routes to shard 0 to keep the app running
- **Health endpoint** `GET /api/health/shards` — returns per-shard status (200/207/503)

### At 10,000 Organisations

The prepared answer for this interview question:

The shard router handles horizontal DB scaling. The immediate limits hit first would be: Vercel function cold-start latency on high-traffic boards (move to reserved/dedicated compute), the single Supabase Realtime instance (move to dedicated WebSocket infrastructure like Ably or self-hosted), and the in-memory rate limiter state not being shared across function instances (already solved via Upstash Redis flag). The catalog DB (`users` table on shard 0) becomes a single point of auth failure — the right fix is promoting it to a globally-replicated database (CockroachDB or PlanetScale).

---

## Architectural Trade-offs & Roadmap

### Deliberate Trade-offs

**Synchronous Automation Engine.** Automations currently run synchronously via `Promise.allSettled()` during the server action's `after()` callback. For slow or unreliable outbound webhooks, this can tie up the Vercel edge function after the response is sent. The correct fix is extracting automations into an asynchronous background worker queue (BullMQ + Redis) to fully decouple automation execution from the request lifecycle.

**Single Supabase Realtime instance.** All WebSocket traffic routes through one Supabase project. This is sufficient for current scale but is a single point of failure for real-time features. At production scale, WebSocket routing should be distributed (Ably, Liveblocks, or self-hosted).

**In-memory LexoRank auto-rebalancer.** The weekly cron job normalises all order strings in a single pass. On a very large dataset, this should be a batched background job with progress tracking rather than a single synchronous endpoint call.

**No multi-region writes.** Data lives in a single Supabase region. Cross-region write latency is accepted as a current trade-off. Multi-region active-active PostgreSQL (CockroachDB) is on the roadmap for when this matters.

**No SLOs/SLIs defined.** The app has Sentry error tracking and Vercel performance monitoring, but no formal service-level objectives or alerting thresholds. These would be the first thing to define before a production launch with paying customers.

### Roadmap

- **SSO / SAML** — Okta, Azure AD, Google Workspace integration (most-requested enterprise capability)
- **Async Automation Engine** — BullMQ + Redis background job queue
- **Offline-first support** — IndexedDB write-ahead buffer with background sync
- **Native mobile application** — React Native or enhanced PWA
- **Google Calendar and Outlook integration** — bidirectional due date sync
- **AI-powered task prioritisation and workload balancing**
- **Board activity heatmaps and historical analytics**
- **Catalog DB high availability** — promote the `users` table to globally-replicated storage so shard 0 downtime no longer affects authentication

---

## Changelog

### Latest Updates

| Date | Commit | Change |
|---|---|---|
| 2026-03-05 | `c7548d0` | Fix: Board creation + template selection — `templateId` validator changed from `z.string().uuid()` to `z.string().min(1)` (Prisma uses CUIDs, not UUIDs); `LIMIT_REACHED` error now opens storage full dialog; `handleCreateBoard` is single source of close/success |
| 2026-03-05 | `c7548d0` | Feat: Advanced `/about` page — ParticleCanvas, animated counters, tech ticker, 8 feature cards with Framer Motion, 6-milestone timeline, security manifesto section |
| 2026-03-04 | `b165520` | Perf: Lighthouse-driven sprint — Service Worker v2 (4-strategy caching, LRU eviction), `preconnect` hints, `experimental.inlineCss`, `minimumCacheTTL` 86,400s, full OpenGraph + Twitter Card metadata |
| 2026-03-03 | `b706486` | Feat(a11y): Collaborative ARIA live announcements + WCAG 2.1 AA contrast CI shield — `lib/colors.ts`, 26-test aria-live-region suite, 57-test axe suite, 10 design token CI gate |
| 2026-03-03 | `HEAD` | Fix: Supabase Storage bucket provisioning — `card-attachments` bucket created via `scripts/setup-storage.ts`; was missing in new environment causing `/api/upload` 500 |
| 2026-03-03 | `HEAD` | Feat: Full attachment system rewrite — multi-file XHR upload with progress bars, drag-and-drop, Ctrl+V paste, in-app lightbox previewer, keyboard navigation, grid view toggle, coloured file-type badge system |
| 2026-03-02 | `df93374` | Test(chaos): Chaos Engineering suite — SK1-SK16, AO1-AO12, NP1-NP10, CE-1-CE-6 |
| 2026-03-02 | `8b2367d` | Security: `lib/step-up-action.ts` — `createStepUpAction` factory with four strictness levels |
| 2026-03-02 | `HEAD` | Feat: `lib/yjs-supabase-provider.ts` + `CollaborativeRichTextEditor` — Yjs CRDT over Supabase broadcast |
| 2026-03-02 | `5394b76` | Security: `lib/audit-sink.ts` + `supabase-audit-immutability.sql` — immutable forensic dual-write |
| 2026-03-02 | `88dd67e` | Feat: `lib/shard-router.ts` — FNV-1a shard router, health cache, failover, health endpoint |
| 2026-03-02 | `973751a` | Fix: Drag race guard, storage cleanup on delete, share link field whitelist, AI cooldown hook |
| 2026-03-02 | `2550b71` | Security: Stripe idempotency guard, realtime-auth endpoint, Supabase Realtime RLS |
| 2026-03-02 | `503c1c8` | Security: RBAC desync fix in `$transaction()`, LexoRank DoS guard, Stripe replay + TOCTOU fix |
| 2026-02 | `9c8591c` | Security: HSTS, CORP, COOP headers; Vercel `maxDuration` explicit timeouts; `bg-gradient-to-*` mass correction |

---

## Contributing

> **Atomic commits policy:** This project enforces atomic commits for all architectural changes. Each commit represents a single logical unit of change, ensuring a clean, peer-review-ready Git history that demonstrates deliberate engineering.

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

[Next.js](https://nextjs.org) · [React](https://react.dev) · [Prisma](https://prisma.io) · [Clerk](https://clerk.com) · [Stripe](https://stripe.com) · [Supabase](https://supabase.com) · [Tailwind CSS](https://tailwindcss.com) · [shadcn/ui](https://ui.shadcn.com) · [@dnd-kit](https://dndkit.com) · [TipTap](https://tiptap.dev) · [Yjs](https://yjs.dev) · [Recharts](https://recharts.org) · [Framer Motion](https://www.framer.com/motion) · [Zod](https://zod.dev) · [Sentry](https://sentry.io) · [Resend](https://resend.com) · [OpenAI](https://openai.com) · [Axiom](https://axiom.co)

---

<div align="center">
  <sub>Built with precision. Documented for clarity. Designed to survive an adversarial code review.</sub>
</div>