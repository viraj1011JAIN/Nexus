# NEXUS - Production-Level Blueprint (REFACTORED)
## Enterprise-Grade B2B SaaS Task Management Platform

**Version:** 2.0.0 - **Production-Ready Edition**  
**Author:** Senior Full-Stack Developer  
**Review Status:** ✅ Validated by Deloitte Senior Engineer  
**Realistic Timeline:** 8 weeks (achievable by one person)  
**Expected Market Value:** £35,000-45,000 Annual Salary

---

## 🚨 CRITICAL: This Blueprint Has Been Battle-Tested

This is NOT the first draft. This blueprint has been reviewed by a Senior Engineer at Deloitte and refactored to remove **three fatal traps** that would have caused project failure:

### ❌ TRAP #1: Fractional Indexing Math (FIXED)
**Original Problem:** Using `(prevOrder + nextOrder) / 2` breaks after ~50 drags due to JavaScript floating-point precision.  
**Solution:** Implemented **Lexorank** (string-based ordering) used by Jira and Linear.

### ❌ TRAP #2: Unrealistic Testing Pyramid (FIXED)
**Original Problem:** Attempting 80% test coverage with unit tests for every component wastes weeks.  
**Solution:** Focus on **3 critical E2E tests** (auth, drag-drop, payments). Skip unit tests for UI components.

### ❌ TRAP #3: "Microservices" Buzzword Overload (FIXED)
**Original Problem:** Calling a Next.js monolith "microservices-inspired" sounds desperate.  
**Solution:** Honest architecture description—it's a **monolith deployed to the edge**, and that's perfect.

### ✅ CRITICAL ADDITIONS:

**🎯 Guest Demo Mode (Build First!):** Recruiters won't sign up. One-click demo is mandatory.  
**📱 Mobile Touch Support (Essential!):** HTML5 Drag-and-Drop doesn't work on iPhones. Explicit `TouchSensor` configuration required.  
**🔨 Vertical Slice Execution:** Build features end-to-end (Week 1: working board), not layer-by-layer (Week 1: database schema).

---

## 📋 Executive Summary

NEXUS is a **production-ready B2B SaaS platform** that proves you can ship complex features, not just tutorials. This blueprint is **realistic, achievable by one person in 8 weeks**, and designed to make recruiters say "we need to hire this person."

### 🎯 Strategic Objectives (The Honest Version)

**What This Project Actually Proves:**
- You can build a **real product**, not a tutorial clone
- You understand **modern React patterns** (Server Components, Optimistic UI)
- You know **production tools** used by actual companies (Vercel Stack)
- You can **ship features** that work on mobile and desktop
- You care about **details** (audit logs, RBAC, keyboard shortcuts)

**What This Is NOT:**
- ❌ Not a "microservices architecture" (it's a monolith, and that's fine)
- ❌ Not trying to rebuild Linear (it's inspired by, not competing with)
- ❌ Not over-engineered (every feature has a hiring purpose)

**Career Objective:**
Get hired at £35k-45k as a **Mid-to-Senior Full-Stack Developer** by proving you can:
1. Build production features (not just CRUD)
2. Handle complex state (drag-and-drop, real-time, optimistic UI)
3. Ship to production (Vercel, monitoring, error tracking)
4. Write maintainable code (TypeScript, tests for critical paths)

**The One Thing That Matters:**
When a recruiter opens your app, they should think "this person can start contributing to our codebase on day one."

---

## 🏗️ System Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐       │
│  │   Browser (Web App)                                   │       │
│  │   React 19 + React Compiler + Tailwind CSS 4          │       │
│  │   ├─ Server Components (data-heavy pages, zero JS)    │       │
│  │   ├─ Client Components (drag-drop, modals, realtime)  │       │
│  │   └─ Service Worker v2 (4-strategy offline caching)   │       │
│  └──────────────────────────┬───────────────────────────┘       │
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────┐
│                    EDGE NETWORK LAYER                             │
├──────────────────────────────┼───────────────────────────────────┤
│  ┌───────────────────────────▼──────────────────────────┐       │
│  │         Vercel Edge Network (CDN)                     │       │
│  │  ├─ Global Edge Caching + SSL/TLS Termination         │       │
│  │  ├─ proxy.ts (Clerk clerkMiddleware + security headers)│      │
│  │  └─ Static assets cached permanently                  │       │
│  └───────────────────────────┬──────────────────────────┘       │
└──────────────────────────────┼───────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────┐
│                  APPLICATION LAYER                                │
├──────────────────────────────┼───────────────────────────────────┤
│  ┌───────────────────────────▼──────────────────────────┐       │
│  │         Next.js 16 (App Router)                       │       │
│  │  ┌──────────────────────────────────────────────┐    │       │
│  │  │  Server Components (RSC)                     │    │       │
│  │  │  ├─ Data Fetching (React cache() dedup)      │    │       │
│  │  │  ├─ Server Actions (createSafeAction + Zod)  │    │       │
│  │  │  └─ API Routes (/api/v1, webhooks, cron)     │    │       │
│  │  └──────────────────────────────────────────────┘    │       │
│  │  ┌──────────────────────────────────────────────┐    │       │
│  │  │  Client Components                           │    │       │
│  │  │  ├─ @dnd-kit Drag & Drop + LexoRank ordering │    │       │
│  │  │  ├─ Zustand 5 (modal state, demo mode)       │    │       │
│  │  │  ├─ Optimistic Updates (useOptimistic)        │    │       │
│  │  │  ├─ TipTap + Yjs CRDT collaborative editing  │    │       │
│  │  │  └─ Supabase Realtime subscriptions           │    │       │
│  │  └──────────────────────────────────────────────┘    │       │
│  │  ┌──────────────────────────────────────────────┐    │       │
│  │  │  Security Layer (in Server Actions + API)    │    │       │
│  │  │  ├─ getTenantContext() — Clerk JWT → orgId   │    │       │
│  │  │  ├─ createDAL() — SET app.current_org_id RLS │    │       │
│  │  │  ├─ requireBoardPermission() — 28 permissions│    │       │
│  │  │  ├─ checkRateLimit() — sliding window        │    │       │
│  │  │  └─ createStepUpAction() — biometric/TOTP    │    │       │
│  │  └──────────────────────────────────────────────┘    │       │
│  └───────────────────────────┬──────────────────────────┘       │
└──────────────────────────────┼───────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────┐
│                    SERVICE LAYER                                  │
├──────────────────────────────┼───────────────────────────────────┤
│       ┌──────────────────────┴────────┬──────────────────┐      │
│       │                               │                   │      │
│  ┌────▼────────┐  ┌──────────────────▼──┐  ┌────────────▼────┐ │
│  │   Clerk     │  │    Supabase         │  │    Stripe       │ │
│  │   (Auth)    │  │  ┌───────────────┐  │  │   (Payments)    │ │
│  │             │  │  │  PostgreSQL   │  │  │                 │ │
│  │ ├─ JWT+Org │  │  │   Database    │  │  │ ├─ Subscriptions│ │
│  │ ├─ Session │  │  │   (Prisma 5)  │  │  │ ├─ Webhooks     │ │
│  │ └─ Webhooks│  │  └───────┬───────┘  │  │ └─ Checkout     │ │
│  └─────────────┘  │  ┌──────▼───────┐  │  └─────────────────┘ │
│                   │  │  Realtime    │  │                       │
│  ┌─────────────┐  │  │  (WebSocket  │  │  ┌─────────────────┐ │
│  │  Unsplash   │  │  │   only —     │  │  │   Sentry        │ │
│  │   (Images)  │  │  │   transport) │  │  │  (Monitoring)   │ │
│  └─────────────┘  │  └──────────────┘  │  └─────────────────┘ │
│                   │  ┌──────────────┐  │                       │
│  ┌─────────────┐  │  │  Storage     │  │  ┌─────────────────┐ │
│  │  OpenAI     │  │  │  (Attachments│  │  │   Resend        │ │
│  │   (AI)      │  │  │   bucket)    │  │  │  (Email)        │ │
│  └─────────────┘  │  └──────────────┘  │  └─────────────────┘ │
│                   └─────────────────────┘                       │
│  ┌─────────────┐                          ┌─────────────────┐  │
│  │  Axiom      │                          │  Upstash Redis  │  │
│  │ (Audit Sink)│                          │  (Rate Limiting)│  │
│  └─────────────┘                          └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Architecture Principles (The Real Version)

**What This Actually Is:**
This is a **monolithic Next.js 16 application deployed to Vercel's Edge Network**. That's it. It's not microservices. It's not distributed. And that's **exactly what you should build** for a project of this scale.

**Why This Is Good:**
1. **Simple to reason about**: One codebase, one deployment
2. **Fast to ship**: No service orchestration complexity
3. **Edge-optimized**: `proxy.ts` (Clerk middleware) runs globally on the edge
4. **Industry standard**: This is how Vercel, Linear, and Cal.com are built

**The Three Layers:**

**1. Edge Layer (Vercel's Network)**
- Global CDN with 100+ locations
- `proxy.ts` runs Clerk `clerkMiddleware()` + injects security headers (HSTS, CORP, CSP)
- Static assets cached permanently
- Service Worker v2 provides 4-strategy offline caching

**2. Application Layer (Next.js 16 Monolith)**
- **Server Components**: Data fetching with React `cache()` deduplication
- **Client Components**: Drag-and-drop, real-time subscriptions, modals, rich-text editing
- **Server Actions**: Wrapped by `createSafeAction` (Zod validation + TenantError handling)
- **Security**: `getTenantContext()` (Clerk JWT → orgId), `createDAL()` (RLS), `requireBoardPermission()` (28 granular permissions), `checkRateLimit()` (sliding window)

**3. Data Layer (PostgreSQL + Supabase)**
- **Prisma ORM**: Type-safe queries, PgBouncer connection pooling (port 6543)
- **Supabase Realtime**: WebSocket transport only — never writes to DB directly
- **Row-Level Security**: `SET app.current_org_id` per connection; all queries filtered at DB engine level
- **Shard Router**: FNV-1a consistent hashing routes each orgId to a database shard

**Why Not Microservices?**
You're one person building a portfolio. Microservices would require:
- Service discovery
- Inter-service authentication
- Distributed tracing
- Complex deployment orchestration

None of that helps you get hired. A well-built monolith does.

---

## 🛠️ Technology Stack

### Frontend Stack

| Technology | Version | Purpose | Justification |
|-----------|---------|---------|---------------|
| **Next.js** | 16.1.4 | React Framework | • Server Components for optimal performance<br>• Server Actions (type-safe mutations)<br>• App Router with file-based routing<br>• Turbopack for fast HMR |
| **React** | 19.2.3 | UI Library | • React Compiler auto-memoization<br>• Server Components<br>• useOptimistic for optimistic UI |
| **TypeScript** | 5.x | Type System | • Strict-mode type safety<br>• Zero errors across entire codebase |
| **Tailwind CSS** | 4.x | Styling | • Utility-first approach<br>• Class-based dark mode<br>• Consistent design system |
| **shadcn/ui** | Latest | Component Library | • Accessible Radix UI primitives<br>• Copy-paste philosophy<br>• Customizable design tokens |
| **Framer Motion** | 12.29+ | Animations | • Page transitions<br>• Micro-interactions<br>• Layout animations |
| **@dnd-kit** | 6.3+ | Drag & Drop | • Touch + mouse support<br>• Accessibility (ARIA)<br>• Modular architecture |
| **Zustand** | 5.0+ | State Management | • Modal state, demo mode<br>• No providers needed<br>• Minimal boilerplate |
| **TipTap** | 3.17+ | Rich Text Editor | • WYSIWYG editor<br>• Yjs CRDT collaborative editing<br>• @mentions, code blocks, task lists |

### Backend Stack

| Technology | Version | Purpose | Justification |
|-----------|---------|---------|---------------|
| **PostgreSQL** | — | Primary Database | • Supabase-hosted<br>• Row-Level Security (RLS)<br>• PgBouncer connection pooling |
| **Supabase** | 2.91+ | Realtime Only | • WebSocket transport (`postgres_changes`, `presence`, `broadcast`)<br>• Storage (file attachments)<br>• NOT used as primary DB — Prisma handles all reads/writes |
| **Prisma** | 5.22+ | ORM | • Type-safe queries<br>• Database migrations<br>• Connection pooling via PgBouncer |
| **Zod** | 4.3+ | Schema Validation | • Runtime validation in server actions<br>• Type inference<br>• API input validation |
| **Clerk** | 6.36+ | Authentication | • Multi-org JWTs<br>• orgId JWT claim for tenant isolation<br>• Webhook-driven provisioning |
| **Stripe** | v20 | Payments | • Subscriptions (FREE/PRO)<br>• Checkout + Customer Portal<br>• Webhook lifecycle with idempotency |
| **OpenAI** | 4.104+ | AI Features | • Card suggestions, checklist generation<br>• Prompt injection protection |

### DevOps & Infrastructure

| Technology | Version | Purpose | Justification |
|-----------|---------|---------|---------------|
| **Vercel** | — | Hosting Platform | • Edge network, serverless functions<br>• Preview deployments per PR<br>• Cron jobs (/api/cron/) |
| **Sentry** | 10.36+ | Error Tracking | • Real-time error reporting<br>• Performance monitoring<br>• Source maps |
| **Axiom** | — | Audit Sink | • Append-only forensic log (Ingest-Only key)<br>• Dual-write from createAuditLog() |
| **Upstash Redis** | — | Rate Limiting | • Sliding-window rate limiter<br>• In-memory fallback when unavailable |
| **Resend** | 6.9+ | Email | • Transactional emails (invites, digests, due-date reminders) |

### Development Tools

| Tool | Purpose |
|------|---------|
| **ESLint** | Code linting (Next.js config) |
| **Jest** | Unit + integration testing (30.2+) |
| **Playwright** | E2E testing (1.58+) |
| **Prisma Studio** | Database GUI for development |

---

## 🗄️ Database Architecture

> **Note:** The Prisma schema below reflects the **original planning draft**. The actual production schema has evolved significantly — see `nexus/prisma/schema.prisma` for the live implementation (41 models, 13 enums). Key changes from this blueprint: labels are now org-scoped many-to-many (not per-card), billing fields live directly on Organization (no separate Subscription model), full RBAC with BoardMember + PermissionScheme, and 15+ additional models for comments, checklists, sprints, epics, automations, webhooks, API keys, notifications, custom fields, time tracking, and more.

### Entity-Relationship Diagram (Actual Production Schema)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         DATABASE SCHEMA (41 Models)                          │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐       ┌──────────────────────┐
│     Organization     │       │        User          │
├──────────────────────┤       ├──────────────────────┤
│ id (PK, UUID)        │       │ id (PK, UUID)        │
│ name                 │       │ clerkUserId (unique)  │
│ slug (unique)        │       │ email (unique)        │
│ imageUrl?            │       │ name                 │
│ region               │       │ imageUrl?            │
│ deletedAt? (soft del)│       │ pushSubscription?    │
│ subscriptionPlan     │◄──┐   └──────────┬───────────┘
│ stripeCustomerId?    │   │              │
│ stripeSubscriptionId?│   │    ┌─────────▼──────────┐
│ aiCallsToday         │   │    │ OrganizationUser   │
│ createdAt, updatedAt │   │    ├────────────────────┤
└──────────┬───────────┘   │    │ id (PK)            │
           │               │    │ role (OWNER/ADMIN/  │
           │               │    │  MEMBER/GUEST)      │
           │               │    │ status (PENDING/    │
           │               │    │  ACTIVE/SUSPENDED)  │
           │               │    │ isActive (legacy)   │
           │               │    │ userId (FK→User)    │
           │               │    │ organizationId (FK) │
           │               │    └────────────────────┘
           │
    ┌──────┴───────────────────────────────────────────────┐
    │      │           │           │           │           │
    ▼      ▼           ▼           ▼           ▼           ▼
┌───────┐┌──────┐┌──────────┐┌─────────┐┌─────────┐┌──────────┐
│ Board ││Label ││Automation││ Webhook ││ ApiKey  ││ AuditLog │
│       ││(org  ││          ││         ││         ││          │
│       ││scope)││          ││         ││         ││previousV │
│       ││      ││trigger   ││url      ││keyHash  ││newValues │
│       ││      ││conditions││secret   ││scopes[] ││(forensic)│
│       ││      ││actions   ││events[] ││         ││          │
└───┬───┘└──┬───┘└──────────┘└─────────┘└─────────┘└──────────┘
    │       │
    │       └──────── CardLabelAssignment (many-to-many join)
    │
    ├─── BoardMember (userId, boardId, role, permissionSchemeId?)
    │         └── PermissionScheme → PermissionSchemeEntry[]
    ├─── Sprint (name, goal, status, startDate, endDate)
    ├─── BoardShare (token, isActive, passwordHash?, expiresAt?)
    ├─── Epic (title, status, boardId?, initiativeId?)
    ├─── BoardAnalytics (totalCards, completedCards, weeklyTrends)
    ├─── MembershipRequest (type: ORG_MEMBERSHIP | BOARD_ACCESS)
    │
    ▼
┌──────────────────┐
│      List        │
├──────────────────┤
│ id, title        │
│ order (LexoRank) │◄───── String-based O(1) ordering
│ boardId (FK)     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│      Card        │
├──────────────────┤
│ id, title        │
│ order (LexoRank) │
│ description?     │
│ dueDate?         │
│ priority (LOW/   │
│  MEDIUM/HIGH/    │
│  URGENT)         │
│ assigneeId? (FK) │──── User (Assignee)
│ sprintId? (FK)   │──── Sprint
│ epicId? (FK)     │──── Epic
│ coverColor?      │
│ coverImageUrl?   │
│ storyPoints?     │
│ estimatedMinutes?│
└────────┬─────────┘
         │
    ┌────┴─────────────────────────────────────┐
    │        │         │         │         │    │
    ▼        ▼         ▼         ▼         ▼    ▼
Comment  Attachment Checklist  TimeLog  CardDep CustomFieldValue
  │                    │
  ├── replies          └── ChecklistItem
  └── CommentReaction

Additional org-scoped models: Notification, Initiative, SavedView,
  CustomField, BoardTemplate, UserPreference, UserAnalytics,
  ActivitySnapshot, ProcessedStripeEvent (Stripe idempotency)
```

### Database Schema (Prisma)

> **The full production schema lives in `nexus/prisma/schema.prisma` (41 models, 13 enums).** Below is a summary of the core models and key differences from the original blueprint plan.

```prisma
// Key models from the actual production schema (nexus/prisma/schema.prisma)
// Full schema has 41 models — only core models shown here for brevity.

generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL"); directUrl = env("DIRECT_URL") }

// ── RBAC ENUMS ──
enum Role { OWNER ADMIN MEMBER GUEST }
enum BoardRole { OWNER ADMIN MEMBER VIEWER }
enum BoardPermission { BOARD_VIEW BOARD_EDIT_SETTINGS CARD_CREATE CARD_EDIT /* ...28 total */ }
enum MembershipStatus { PENDING ACTIVE SUSPENDED }
enum Priority { LOW MEDIUM HIGH URGENT }
enum ACTION { CREATE UPDATE DELETE MEMBER_INVITED ACCESS_DENIED /* ...20 total */ }
enum ENTITY_TYPE { BOARD LIST CARD ORGANIZATION BOARD_MEMBER /* ...9 total */ }

// ── CORE MODELS ──
model Organization {
  // Billing lives directly on Organization (no separate Subscription model)
  subscriptionPlan String @default("FREE")  // "FREE" or "PRO" (plain string, not enum)
  stripeCustomerId String? @unique
  stripeSubscriptionId String? @unique
  region String @default("eu-west")          // Regional data residency
  deletedAt DateTime?                        // Soft-delete support
  aiCallsToday Int @default(0)               // AI rate limiting
  // Relations: boards, members, auditLogs, webhooks, apiKeys, automations,
  //   labels, epics, initiatives, notifications, savedViews, customFields,
  //   boardShares, permissionSchemes, membershipRequests, templates
}

model Board {
  orgId String                              // Changed from organizationId
  isPrivate Boolean @default(true)          // Boards private by default
  permissionSchemeId String?                // Custom RBAC scheme
  // Relations: lists, members (BoardMember[]), sprints, shares,
  //   epics, automations, analytics, savedViews, customFields, membershipRequests
}

model Card {
  order String @default("m")               // LexoRank string ordering
  assigneeId String?                       // FK → User
  sprintId String?                         // FK → Sprint (Agile)
  epicId String?                           // FK → Epic (Roadmap)
  coverColor String?                       // Card cover customization
  storyPoints Int?                         // Agile estimation
  estimatedMinutes Int?                    // Time tracking
  // Relations: comments, attachments, checklists, timeLogs,
  //   labels (CardLabelAssignment[]), customFieldValues, dependencies
}

// ── RBAC MODELS (not in original blueprint) ──
model BoardMember { boardId, userId, orgId, role: BoardRole, permissionSchemeId? }
model PermissionScheme { orgId, name, isDefault, entries: PermissionSchemeEntry[] }
model PermissionSchemeEntry { schemeId, role: BoardRole, permission: BoardPermission, granted }
model MembershipRequest { orgId, userId, type: ORG_MEMBERSHIP|BOARD_ACCESS, status, boardId? }

// ── COLLABORATION MODELS ──
model Comment { cardId, userId, userName, userImage, parentId? (threading), reactions[], mentions[] }
model CommentReaction { commentId, userId, emoji }
model Checklist { cardId, title, items: ChecklistItem[] }

// ── AUDIT (forensic diffs — not just action labels) ──
model AuditLog {
  // No FK to User — userName/userImage denormalized for immutability
  previousValues Json?   // Before-state for UPDATE/DELETE
  newValues Json?        // After-state for CREATE/UPDATE
  ipAddress String?      // Request context for forensics
  userAgent String?
}

// ── ADDITIONAL MODELS ──
// Sprint, Epic, Initiative, Notification, SavedView, CustomField,
// CustomFieldValue, Automation, AutomationLog, Webhook, WebhookDelivery,
// ApiKey, TimeLog, BoardShare, BoardAnalytics, UserAnalytics,
// ActivitySnapshot, BoardTemplate, TemplateList, TemplateCard,
// CardDependency, Attachment, UserPreference, ProcessedStripeEvent
```

### Database Indexes Strategy

**Performance Optimization:**

```sql
-- High-frequency query indexes
CREATE INDEX idx_boards_org_id ON boards(organization_id);
CREATE INDEX idx_lists_board_id ON lists(board_id);
CREATE INDEX idx_cards_list_id ON cards(list_id);
CREATE INDEX idx_audit_org_id_created ON audit_logs(organization_id, created_at DESC);

-- Composite indexes for common queries
CREATE INDEX idx_cards_list_order ON cards(list_id, order);
CREATE INDEX idx_lists_board_order ON lists(board_id, order);

-- Full-text search (future feature)
CREATE INDEX idx_cards_title_search ON cards USING GIN(to_tsvector('english', title));
```

### Tenant Isolation: Data Access Layer (DAL)

> **Note:** NEXUS does NOT use Supabase `auth.uid()` RLS policies. Supabase is used only for Realtime (WebSocket). Tenant isolation is enforced at the **application layer** via `createDAL()` — a type-safe Data Access Layer that scopes every query to the current org.

**How it works:**

```typescript
// lib/dal.ts — actual production implementation
// 1. createDAL() sets a PostgreSQL session variable via SET:
await db.$executeRaw`SELECT set_config('app.current_org_id', ${orgId}, false)`;
await db.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, false)`;

// 2. Returns a TenantDAL instance locked to this orgId
// 3. Every query method injects orgId automatically:
//    dal.boards.findMany()   → WHERE orgId = <from-JWT>
//    dal.boards.findUnique() → asserts board.orgId === this.orgId
//    dal.cards.findUnique()  → traverses Card→List→Board→orgId chain
//    dal.labels.findMany()   → WHERE orgId = <from-JWT>

// 4. Ownership chain verification (defense in depth):
//    Board   → direct orgId check
//    List    → List → Board → orgId
//    Card    → Card → List → Board → orgId
//    Comment → Comment → Card → List → Board → orgId

// 5. Cross-tenant access returns NOT_FOUND, never FORBIDDEN
//    (NOT_FOUND reveals nothing; FORBIDDEN confirms the resource exists)
```

**Usage in server actions:**

```typescript
// Every action creates a DAL scoped to the JWT-authenticated org
const ctx = await getTenantContext();   // orgId from Clerk JWT
const dal = await createDAL(ctx);       // locked to ctx.orgId

const boards = await dal.boards.findMany();     // auto-scoped
const card   = await dal.cards.findUnique(id);  // ownership verified
await dal.cards.update(id, { title: "..." });   // ownership verified
await dal.cards.reorder(items, boardId);         // every ID validated
```

**Board-level isolation (dual-gate):**
```typescript
// Gate 1: Organization membership (getTenantContext)
// Gate 2: Board membership (DAL verifies BoardMember row)
//   dal.boards.findUnique() → verifyBoardMembership(boardId)
//   dal.boards.findMany()   → WHERE members: { some: { userId } }
// Gate 3: Permission check (requireBoardPermission — 28 granular permissions)
```

---

## 🎨 Feature Specifications

### 🚨 CRITICAL FEATURE: Guest Demo Mode (Build This First!)

> **Blueprint vs Reality:** The code snippets below are from the **original planning phase**. The actual implementation evolved — demo mode is enforced via `isDemoContext(ctx)` in every server action (not via middleware), and org switching uses Clerk's `<OrganizationSwitcher>` component (not a custom `OrgSwitcher`). See `actions/` for actual server action patterns.

**Why This Is #1 Priority:**
Recruiters are lazy. If they have to sign up with Google, 70% will close the tab. You need a **one-click demo** that shows your work instantly.

**Implementation:**

```typescript
// app/(auth)/sign-in/[[...sign-in]]/page.tsx
"use client";

import { SignIn } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function SignInPage() {
  const router = useRouter();
  
  const handleGuestLogin = async () => {
    // Option 1: Pre-seeded guest account (RECOMMENDED)
    // Use Clerk's test account feature
    const guestEmail = "demo@nexus.app";
    const guestPassword = process.env.NEXT_PUBLIC_GUEST_PASSWORD!;
    
    // Auto-fill and submit
    // This navigates to a pre-populated demo organization
    router.push("/organization/demo-org-id");
  };
  
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        {/* The BIG button recruiters will see first */}
        <Button
          onClick={handleGuestLogin}
          size="lg"
          className="w-full text-lg font-semibold"
          variant="default"
        >
          🎯 View Demo (No Signup Required)
        </Button>
        
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or sign in with your account
            </span>
          </div>
        </div>
        
        <SignIn 
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "shadow-none",
            },
          }}
        />
      </div>
    </div>
  );
}
```

**Guest Organization Setup:**

```typescript
// scripts/seed-demo.ts
import { db } from "@/lib/db";

async function seedDemoOrganization() {
  // Create demo organization
  const demoOrg = await db.organization.create({
    data: {
      id: "demo-org-id",
      name: "Demo Company",
      slug: "demo-company",
      imageUrl: "/demo-logo.png",
      plan: "PRO", // Show PRO features
    },
  });
  
  // Create demo board with impressive data
  const board = await db.board.create({
    data: {
      title: "Product Roadmap Q1 2026",
      organizationId: demoOrg.id,
      imageId: "featured-1",
      imageThumbUrl: "https://images.unsplash.com/...",
      imageFullUrl: "https://images.unsplash.com/...",
      imageUserName: "John Doe",
      imageLinkHTML: "<a>Unsplash</a>",
      lists: {
        create: [
          {
            title: "Backlog",
            order: "a",
            cards: {
              create: [
                {
                  title: "Add real-time notifications",
                  order: "a",
                  description: "Implement WebSocket-based notifications",
                  priority: "HIGH",
                  labels: {
                    create: [{ name: "Feature", color: "#10b981" }]
                  }
                },
                {
                  title: "Optimize database queries",
                  order: "b",
                  priority: "MEDIUM",
                  labels: {
                    create: [{ name: "Performance", color: "#f59e0b" }]
                  }
                },
              ],
            },
          },
          {
            title: "In Progress",
            order: "m",
            cards: {
              create: [
                {
                  title: "Build drag-and-drop system",
                  order: "a",
                  description: "Using @dnd-kit with mobile support",
                  priority: "URGENT",
                  labels: {
                    create: [{ name: "Feature", color: "#10b981" }]
                  }
                },
              ],
            },
          },
          {
            title: "Done",
            order: "z",
            cards: {
              create: [
                {
                  title: "Setup CI/CD pipeline",
                  order: "a",
                  priority: "HIGH",
                  labels: {
                    create: [{ name: "DevOps", color: "#8b5cf6" }]
                  }
                },
                {
                  title: "Implement authentication",
                  order: "b",
                  priority: "HIGH",
                },
              ],
            },
          },
        ],
      },
    },
  });
  
  console.log("✅ Demo organization seeded!");
}

seedDemoOrganization();
```

**Why This Works:**
- Recruiter sees impressive data immediately
- No friction (no signup)
- Shows your best features instantly
- They can explore without commitment

**Security Note (Actual Implementation):**
- Demo org is read-only — enforced at the **server action level**, not middleware
- Every mutation action calls `isDemoContext(ctx)` from `lib/tenant-context.ts`
- `protectDemoMode(orgId)` from `lib/action-protection.ts` returns a safe error message
- `DEMO_ORG_ID` is a constant exported from `lib/action-protection.ts`

```typescript
// Actual pattern in every server action:
const ctx = await getTenantContext();
if (isDemoContext(ctx)) {
  return { error: "Demo mode is read-only. Sign up to create your own workspace." };
}
```

---

### Feature 1: Multi-Tenancy Architecture

> **Blueprint vs Reality:** The code below is from the **original planning phase**. The actual implementation uses `getTenantContext()` (from `lib/tenant-context.ts`) which extracts orgId from Clerk's signed JWT — never from function parameters. Organization switching uses Clerk's built-in `<OrganizationSwitcher>` component, not the custom `OrgSwitcher` shown below.

**Description:** Complete organization-based multi-tenancy with workspace switching

**User Stories:**
```
As a user, I want to create multiple workspaces so that I can 
separate personal and professional projects.

Acceptance Criteria:
✓ User can create unlimited organizations (FREE plan: 1, PRO: unlimited)
✓ User can switch between organizations via dropdown
✓ Each organization has isolated data
✓ Organization slug is unique and URL-friendly
✓ Organization logo can be uploaded (max 2MB)
```

**Technical Implementation:**

**1. Organization Creation Flow:**

```typescript
// app/actions/create-organization.ts
"use server";

import { auth } from "@clerk/nextjs";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/create-audit-log";

interface CreateOrganizationInput {
  name: string;
  imageUrl?: string;
}

export async function createOrganization(data: CreateOrganizationInput) {
  const { userId, orgId } = auth();
  
  if (!userId) {
    return { error: "Unauthorized" };
  }
  
  try {
    // Generate unique slug
    const slug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    
    // Check slug uniqueness
    const existing = await db.organization.findUnique({
      where: { slug }
    });
    
    if (existing) {
      return { error: "Organization name already taken" };
    }
    
    // Create organization
    const organization = await db.organization.create({
      data: {
        name: data.name,
        slug,
        imageUrl: data.imageUrl,
        plan: "FREE",
        users: {
          create: {
            userId,
            role: "OWNER"
          }
        }
      }
    });
    
    // Create audit log
    await createAuditLog({
      entityId: organization.id,
      entityType: "ORGANIZATION",
      entityTitle: organization.name,
      action: "CREATE"
    });
    
    revalidatePath("/select-org");
    
    return { data: organization };
  } catch (error) {
    return { error: "Failed to create organization" };
  }
}
```

**2. Organization Switcher Component:**

```typescript
// components/org-switcher.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, PlusCircle } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface OrgSwitcherProps {
  organizations: {
    id: string;
    name: string;
    imageUrl: string | null;
  }[];
  currentOrgId: string;
}

export function OrgSwitcher({ organizations, currentOrgId }: OrgSwitcherProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  
  const currentOrg = organizations.find(org => org.id === currentOrgId);
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-neutral-100 transition">
          {currentOrg?.imageUrl && (
            <img 
              src={currentOrg.imageUrl} 
              alt={currentOrg.name}
              className="w-8 h-8 rounded-md object-cover"
            />
          )}
          <span className="font-semibold truncate">{currentOrg?.name}</span>
          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="Search workspace..." />
          <CommandEmpty>No workspace found.</CommandEmpty>
          <CommandGroup>
            {organizations.map((org) => (
              <CommandItem
                key={org.id}
                onSelect={() => {
                  router.push(`/organization/${org.id}`);
                  setOpen(false);
                }}
                className="cursor-pointer"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    currentOrgId === org.id ? "opacity-100" : "opacity-0"
                  )}
                />
                {org.imageUrl && (
                  <img 
                    src={org.imageUrl} 
                    alt={org.name}
                    className="w-6 h-6 rounded mr-2 object-cover"
                  />
                )}
                {org.name}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup>
            <CommandItem
              onSelect={() => {
                router.push("/select-org");
                setOpen(false);
              }}
              className="cursor-pointer"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Create workspace
            </CommandItem>
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

---

### Feature 2: Advanced Drag-and-Drop System

**Description:** Smooth, physics-based drag-and-drop with **mobile touch support** (this is critical!)

**Why Mobile Matters:**
The HTML5 Drag and Drop API **does not work on touchscreens**. If your drag-and-drop doesn't work on an iPhone, recruiters will think you're a junior who only tests on Chrome desktop.

**Technical Stack:**
- **@dnd-kit/core**: Core drag-and-drop primitives
- **@dnd-kit/sortable**: Sortable lists
- **@dnd-kit/utilities**: Helper functions
- **TouchSensor**: CRITICAL for mobile support
- **PointerSensor**: For desktop mouse
- **Framer Motion**: Smooth animations

**Implementation:**

```typescript
// components/board/board-content.tsx
"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,  // ← CRITICAL: Without this, mobile won't work
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

export function BoardContent({ lists: initialLists, boardId }: BoardContentProps) {
  const [lists, setLists] = useState(initialLists);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  
  // 🚨 MOBILE FIX: Configure both touch and mouse sensors
  const sensors = useSensors(
    // Mouse/trackpad for desktop
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Prevents accidental drags on click
      },
    }),
    // Touch for mobile devices
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,      // 250ms press before drag starts
        tolerance: 5,    // 5px movement tolerance during delay
      },
    })
  );
  
  // TESTING CHECKLIST:
  // ✓ Test on Chrome Desktop (mouse)
  // ✓ Test on Safari iOS (touch)
  // ✓ Test on Chrome Android (touch)
  // ✓ Test with trackpad (pointer)
  
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const card = findCardById(active.id as string);
    setActiveCard(card);
    
    // Mobile UX: Add haptic feedback (if available)
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  };
  
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    
    const activeId = active.id;
    const overId = over.id;
    
    if (activeId === overId) return;
    
    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;
    
    // Moving a card over another card
    if (activeType === "card" && overType === "card") {
      setLists((lists) => {
        const activeList = findListByCardId(activeId as string);
        const overList = findListByCardId(overId as string);
        
        if (!activeList || !overList) return lists;
        
        const activeIndex = activeList.cards.findIndex(c => c.id === activeId);
        const overIndex = overList.cards.findIndex(c => c.id === overId);
        
        // Same list reorder
        if (activeList.id === overList.id) {
          const reordered = arrayMove(activeList.cards, activeIndex, overIndex);
          return lists.map(l => 
            l.id === activeList.id 
              ? { ...l, cards: reordered }
              : l
          );
        }
        
        // Different list move
        const [movedCard] = activeList.cards.splice(activeIndex, 1);
        overList.cards.splice(overIndex, 0, movedCard);
        
        return lists.map(l => {
          if (l.id === activeList.id) return { ...l, cards: activeList.cards };
          if (l.id === overList.id) return { ...l, cards: overList.cards };
          return l;
        });
      });
    }
    
    // Moving a card over a list
    if (activeType === "card" && overType === "list") {
      setLists((lists) => {
        const activeList = findListByCardId(activeId as string);
        const overList = findListById(overId as string);
        
        if (!activeList || !overList) return lists;
        
        const activeIndex = activeList.cards.findIndex(c => c.id === activeId);
        const [movedCard] = activeList.cards.splice(activeIndex, 1);
        overList.cards.push(movedCard);
        
        return lists.map(l => {
          if (l.id === activeList.id) return { ...l, cards: activeList.cards };
          if (l.id === overList.id) return { ...l, cards: overList.cards };
          return l;
        });
      });
    }
  };
  
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveCard(null);
    setActiveList(null);
    
    if (!over) return;
    
    const activeType = active.data.current?.type;
    
    if (activeType === "card") {
      const activeList = findListByCardId(active.id as string);
      const overList = over.data.current?.type === "list" 
        ? findListById(over.id as string)
        : findListByCardId(over.id as string);
      
      if (!activeList || !overList) return;
      
      // Optimistic update already done in handleDragOver
      // Now persist to database
      await updateCardPosition({
        cardId: active.id as string,
        listId: overList.id,
        order: calculateNewOrder(overList.cards, active.id as string),
      });
      
      // Create audit log
      if (activeList.id !== overList.id) {
        await createAuditLog({
          entityId: active.id as string,
          entityType: "CARD",
          entityTitle: activeCard?.title || "",
          action: "MOVE",
          metadata: {
            fromList: activeList.title,
            toList: overList.title,
          },
        });
      }
    }
    
    if (activeType === "list") {
      const activeIndex = lists.findIndex(l => l.id === active.id);
      const overIndex = lists.findIndex(l => l.id === over.id);
      
      if (activeIndex !== overIndex) {
        const reordered = arrayMove(lists, activeIndex, overIndex);
        setLists(reordered);
        
        // Persist new order
        await updateListOrder({
          boardId,
          updates: reordered.map((list, index) => ({
            id: list.id,
            order: index,
          })),
        });
      }
    }
  };
  
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 h-full overflow-x-auto pb-4">
        <SortableContext 
          items={lists.map(l => l.id)}
          strategy={horizontalListSortingStrategy}
        >
          {lists.map((list) => (
            <ListItem key={list.id} list={list} />
          ))}
        </SortableContext>
        
        <AddListButton boardId={boardId} />
      </div>
      
      <DragOverlay>
        {activeCard ? <CardItem card={activeCard} isDragging /> : null}
        {activeList ? <ListItem list={activeList} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

// Helper function for optimal positioning using Lexorank
// This prevents the floating-point precision bug in fractional indexing

function generateLexorank(prevRank?: string, nextRank?: string): string {
  const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
  const BASE = ALPHABET.length;
  
  if (!prevRank && !nextRank) {
    return 'm'; // Middle of alphabet for first item
  }
  
  if (!prevRank) {
    // Insert at beginning
    return decrementRank(nextRank!);
  }
  
  if (!nextRank) {
    // Insert at end
    return incrementRank(prevRank);
  }
  
  // Insert between two ranks
  return midRank(prevRank, nextRank);
}

function midRank(prev: string, next: string): string {
  const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
  let rank = '';
  let i = 0;
  
  while (true) {
    const prevChar = prev[i] || '0';
    const nextChar = next[i] || 'z';
    
    if (prevChar === nextChar) {
      rank += prevChar;
      i++;
      continue;
    }
    
    const prevIndex = ALPHABET.indexOf(prevChar);
    const nextIndex = ALPHABET.indexOf(nextChar);
    const midIndex = Math.floor((prevIndex + nextIndex) / 2);
    
    if (midIndex === prevIndex) {
      rank += prevChar;
      i++;
      continue;
    }
    
    return rank + ALPHABET[midIndex];
  }
}

function incrementRank(rank: string): string {
  const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
  return rank + 'm'; // Simple append for end insertion
}

function decrementRank(rank: string): string {
  const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
  const firstChar = rank[0];
  const index = ALPHABET.indexOf(firstChar);
  
  if (index === 0) {
    return '0' + rank; // Prepend if at start
  }
  
  return ALPHABET[Math.floor(index / 2)];
}

// CRITICAL NOTE FOR PRODUCTION:
// This Lexorank implementation prevents the floating-point precision bug
// that occurs with fractional indexing (prevOrder + nextOrder) / 2.
// After ~50 drag operations, floating-point math breaks down to 0.000000000001
// and causes database constraint errors.
//
// Lexorank uses strings, so it can handle infinite drag operations.
// This is the same system used by Jira and Linear.
```

**Animation Configuration:**

```typescript
// components/board/card-item.tsx
import { motion } from "framer-motion";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export function CardItem({ card, isDragging }: CardItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: card.id,
    data: { type: "card", card },
  });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };
  
  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "bg-white rounded-lg shadow-sm p-3 cursor-pointer",
        "hover:shadow-md transition-shadow",
        "border border-neutral-200",
        isDragging && "shadow-xl rotate-3 scale-105"
      )}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium text-neutral-900">{card.title}</h4>
        {card.priority === "URGENT" && (
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
        )}
      </div>
      
      {card.labels && card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {card.labels.map((label) => (
            <span
              key={label.id}
              className="px-2 py-0.5 rounded text-xs font-medium"
              style={{ backgroundColor: label.color + "20", color: label.color }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}
      
      {card.dueDate && (
        <div className="flex items-center gap-1 mt-2 text-xs text-neutral-600">
          <Calendar className="h-3 w-3" />
          {formatDate(card.dueDate)}
        </div>
      )}
      
      {card.assignee && (
        <div className="flex items-center gap-2 mt-2">
          <img
            src={card.assignee.imageUrl || "/default-avatar.png"}
            alt={card.assignee.name}
            className="w-5 h-5 rounded-full"
          />
        </div>
      )}
    </motion.div>
  );
}
```

---

### Feature 3: Optimistic UI Pattern

**Description:** Zero-latency user experience with automatic rollback on errors

**Implementation Strategy:**

```typescript
// hooks/use-optimistic-action.ts
import { experimental_useOptimistic as useOptimistic } from "react";
import { toast } from "sonner";

interface UseOptimisticActionOptions<T, P> {
  action: (params: P) => Promise<{ data?: T; error?: string }>;
  onSuccess?: (data: T) => void;
  onError?: (error: string) => void;
  reducer: (state: T[], optimisticValue: T) => T[];
}

export function useOptimisticAction<T, P>({
  action,
  onSuccess,
  onError,
  reducer,
}: UseOptimisticActionOptions<T, P>) {
  const [optimisticState, addOptimistic] = useOptimistic<T[], T>(
    [],
    reducer
  );
  
  const execute = async (params: P, optimisticValue: T) => {
    // 1. Immediately update UI
    addOptimistic(optimisticValue);
    
    try {
      // 2. Execute server action
      const result = await action(params);
      
      if (result.error) {
        // 3. Rollback on error
        toast.error(result.error);
        onError?.(result.error);
        return { error: result.error };
      }
      
      // 4. Success - UI already updated
      toast.success("Action completed successfully");
      onSuccess?.(result.data!);
      return { data: result.data };
      
    } catch (error) {
      // 5. Handle unexpected errors
      toast.error("Something went wrong");
      onError?.(error.message);
      return { error: error.message };
    }
  };
  
  return {
    optimisticState,
    execute,
  };
}
```

**Usage Example:**

```typescript
// components/board/add-card-form.tsx
"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useOptimisticAction } from "@/hooks/use-optimistic-action";
import { createCard } from "@/actions/create-card";

export function AddCardForm({ listId }: { listId: string }) {
  const params = useParams();
  const [title, setTitle] = useState("");
  
  const { execute, optimisticState } = useOptimisticAction({
    action: createCard,
    reducer: (state, optimisticCard) => [...state, optimisticCard],
    onSuccess: () => {
      setTitle("");
    },
  });
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) return;
    
    const optimisticCard = {
      id: `temp-${Date.now()}`,
      title,
      listId,
      order: Date.now(),
      createdAt: new Date(),
      // ... other fields
    };
    
    await execute(
      { title, listId, boardId: params.boardId as string },
      optimisticCard
    );
  };
  
  return (
    <form onSubmit={handleSubmit} className="p-2">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Enter card title..."
        className="w-full px-3 py-2 rounded-md border"
        autoFocus
      />
    </form>
  );
}
```

---

### Feature 4: Real-Time Collaboration

**Description:** Live updates across all connected clients via Supabase Realtime

> **Note:** The actual implementation is in `hooks/use-realtime-board.ts` (not `lib/supabase/realtime.ts`). Channel names include orgId for tenant isolation.

**Actual implementation pattern:**

```typescript
// hooks/use-realtime-board.ts (actual production code — simplified)
import { createClient } from "@/lib/supabase/client";

export function useRealtimeBoard(boardId: string, orgId: string) {
  // Channel pattern: org:{orgId}:board:{boardId} (tenant-scoped)
  // UUID guard: validates orgId/boardId before interpolating into filter
  useEffect(() => {
    const supabase = createClient();
    const channelName = `org:${orgId}:board:${boardId}`;

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'cards',
        filter: `board_id=eq.${boardId}`,  // UUID-validated before interpolation
      }, (payload) => {
        // markLocalCardUpdate() prevents echo for own writes
        // Processes INSERT, UPDATE, DELETE events
        // Updates local state optimistically
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [boardId, orgId]);  // orgId in deps — re-subscribe on org switch
}

// Related hooks:
// use-presence.ts — shows who's viewing the board (online indicators)
// use-realtime-analytics.ts — live dashboard updates
// lib/realtime-channels.ts — channel name generation
// lib/yjs-supabase-provider.ts — Y.js CRDT for collaborative rich-text editing
```

---

### Feature 5: Command Palette (⌘K)

**Description:** Keyboard-driven navigation

```typescript
// components/command-palette.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Search, LayoutDashboard, Settings, CreditCard } from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);
  
  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem
            onSelect={() => {
              router.push("/dashboard");
              setOpen(false);
            }}
          >
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              router.push("/settings");
              setOpen(false);
            }}
          >
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Boards">
          {/* Dynamic board list */}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
```

---

## 🔐 Authentication & Authorization

### Authentication Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                        │
│               (proxy.ts — Clerk clerkMiddleware)             │
└──────────────────────────────────────────────────────────────┘

User visits /dashboard
        │
        ▼
┌─────────────────────────┐
│  proxy.ts (Edge)        │◄────── Runs on Vercel Edge Network
│  clerkMiddleware()      │        (was middleware.ts in Next ≤15)
│  ├─ Layer 0: auth()     │        Resolves JWT on every route
│  ├─ Layer 1: Public?    │        Fast-path for /, /sign-in, etc.
│  ├─ Layer 2: userId?    │        No session → redirect or 401
│  ├─ Layer 3a: orgId?    │        No org → redirect /select-org
│  ├─ Layer 3b: PENDING?  │        PENDING → /pending-approval
│  ├─ Layer 4: Headers    │        Inject x-tenant-id, x-user-id
│  └─ Layer 5: Security   │        CSP, X-Frame-Options, HSTS
└────────────┬────────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
Authenticated    Unauthenticated
    │                 │
    │            ┌────┴─────────────┐
    │            │  Page nav:       │
    │            │  → redirectToSignIn()
    │            │  RSC/Action:     │
    │            │  → redirect /sign-in
    │            │  API route:      │
    │            │  → 401 JSON      │
    │            └────┬─────────────┘
    │                 ▼
    │            ┌─────────────────┐
    │            │  Clerk Login    │
    │            │  ├─ Google      │
    │            │  ├─ GitHub      │
    │            │  └─ Email/Pass  │
    │            └────────┬────────┘
    │                     │
    │                     ▼
    │            ┌─────────────────────────────┐
    │            │  User healing path          │
    │            │  getTenantContext() →        │
    │            │  clerkClient().users.getUser │
    │            │  → db.user.create (try/catch │
    │            │    on unique constraint)     │
    │            └────────┬────────────────────┘
    │                     │
    └─────────────────────┘
             │
             ▼
    ┌─────────────────┐
    │  orgId in JWT?  │
    └────────┬────────┘
             │
        ┌────┴────┐
        │         │
        ▼         ▼
    Has Org    No Org
        │         │
        │         ▼
        │    Redirect to /select-org
        │         │
        │         ▼
        │    Create/Select Organization
        │         │
        ├─────────┘
        │
        ▼
    ┌─────────────────────────┐
    │  Membership status?     │
    │  ├─ ACTIVE → Dashboard  │
    │  ├─ PENDING → /pending- │
    │  │   approval            │
    │  └─ SUSPENDED → FORBIDDEN│
    └─────────────────────────┘
```

### Edge Proxy Implementation

> **Note:** Next.js 16 uses `proxy.ts` (was `middleware.ts` in Next.js ≤15). Uses Clerk v6 `clerkMiddleware()` + `createRouteMatcher()` (NOT the deprecated `authMiddleware`).

```typescript
// proxy.ts (actual production code — simplified for readability)
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/", "/about", "/sign-in(.*)", "/sign-up(.*)",
  "/privacy", "/terms", "/shared/(.*)",
  "/api/health", "/api/health/(.*)",
  "/api/webhook/(.*)", "/api/v1/(.*)",  // v1 API uses API key auth, not Clerk
]);

// Security headers — CSP, X-Frame-Options, CORP, Referrer-Policy, Permissions-Policy
// Pre-computed at module load (not per-request) for performance
const SECURITY_HEADER_ENTRIES = [ /* ... */ ] as const;

export default clerkMiddleware(async (auth, req) => {
  const authObj = await auth();  // Resolves JWT on EVERY route (including public)

  // Layer 1: Public routes — fast-path with security headers
  if (isPublicRoute(req)) {
    // Redirect authenticated users from "/" to "/dashboard"
    if (req.nextUrl.pathname === "/" && authObj.userId) {
      return redirect("/dashboard");
    }
    return applySecurityHeaders(NextResponse.next());
  }

  // Layer 2: Authentication — no session → redirect or 401
  if (!authObj.userId) {
    if (req.headers.get("next-action") || req.headers.get("rsc")) {
      return redirect("/sign-in");     // RSC/Server Action → redirect
    }
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return json({ error: "Unauthorized" }, 401);  // API → 401 JSON
    }
    return authObj.redirectToSignIn({ returnBackUrl: req.url });
  }

  // Layer 3a: Organisation gate — no orgId → /select-org
  if (!authObj.orgId && !req.nextUrl.pathname.startsWith("/select-org")) {
    return redirect("/select-org");
  }

  // Layer 3b: PENDING membership gate → /pending-approval
  if (authObj.orgId && metadata?.orgMembershipStatus === "PENDING") {
    return redirect("/pending-approval");
  }

  // Layer 4: Inject verified tenant headers (from signed JWT, not client)
  requestHeaders.set("x-tenant-id", orgId);
  requestHeaders.set("x-user-id", userId);
  requestHeaders.set("x-org-role", orgRole);

  // Layer 5: Security headers
  return applySecurityHeaders(NextResponse.next({ request: { headers } }));
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

### Role-Based Access Control (Dual-Gate RBAC)

> **Note:** NEXUS uses a **dual-gate** RBAC system — NOT a simple role-permission map. The file `lib/rbac.ts` does not exist. RBAC is split across `lib/tenant-context.ts` (Gate 1: Org) and `lib/board-permissions.ts` (Gate 2: Board).

**Gate 1: Organization-level** (`tenant-context.ts`):
```typescript
// Org roles: OWNER > ADMIN > MEMBER > GUEST (hierarchy)
// Membership statuses: ACTIVE, PENDING, SUSPENDED
// requireRole("ADMIN", ctx) — blocks MEMBER/GUEST
// requireActiveStatus(ctx) — blocks PENDING members
```

**Gate 2: Board-level** (`board-permissions.ts`):
```typescript
// Board roles: OWNER, ADMIN, MEMBER, VIEWER
// 28 granular permissions via PermissionScheme:
//   BOARD_VIEW, BOARD_EDIT_SETTINGS, BOARD_DELETE, BOARD_MANAGE_MEMBERS,
//   CARD_CREATE, CARD_EDIT, CARD_DELETE, CARD_MOVE, CARD_ASSIGN,
//   LIST_CREATE, LIST_EDIT, LIST_DELETE, LIST_REORDER,
//   COMMENT_CREATE, COMMENT_EDIT_OWN, COMMENT_DELETE_OWN,
//   LABEL_MANAGE, CHECKLIST_MANAGE, ATTACHMENT_MANAGE,
//   SPRINT_MANAGE, AUTOMATION_MANAGE, WEBHOOK_MANAGE, ...

// requireBoardPermission(boardId, "CARD_CREATE", ctx)
//   1. Verifies user is a BoardMember of this board
//   2. Loads the board's PermissionScheme (or default scheme)
//   3. Checks if the user's BoardRole has the requested permission
//   4. Throws TenantError("FORBIDDEN") if denied
```

**Usage in server actions (actual pattern):**
```typescript
// Every mutation follows this pattern:
const ctx = await getTenantContext();        // Gate 1: orgId from JWT
await requireRole("MEMBER", ctx);            // Minimum org role
await requireBoardPermission(boardId, "CARD_CREATE", ctx); // Gate 2
checkRateLimit(ctx.userId, "create-card", 60);  // Rate limit
if (isDemoContext(ctx)) return { error: "Demo mode is read-only" };

const dal = await createDAL(ctx);            // Tenant-scoped DB access
const card = await dal.cards.create(listId, boardId, data);
```

---

## 🎯 API Design

### Server Actions Architecture

**Why Server Actions over API Routes:**
1. Type-safe by default — validated with Zod schemas
2. Automatic tenant isolation via `getTenantContext()` + `createDAL()`
3. Rate limiting via `checkRateLimit(userId, actionName, limit)`
4. TenantError → safe client messages via `createSafeAction()` wrapper
5. Audit logging with forensic diffs via `createAuditLog()`
6. Event bus triggers automations + webhooks via `emitCardEvent()`

**NEXUS also has a RESTful API** (`/api/v1/`) for external integrations, authenticated via API keys (not Clerk sessions).

### Action Structure Pattern (Actual)

> **Note:** Actions are flat files in `actions/` (not nested `actions/boards/create-board/` subdirectories as originally planned). Each action file contains one or more exported server functions wrapped by `createSafeAction`.

```typescript
// actions/create-board.ts (actual production pattern)
"use server";

import { getTenantContext, requireRole, isDemoContext } from "@/lib/tenant-context";
import { createDAL } from "@/lib/dal";
import { checkRateLimit } from "@/lib/action-protection";
import { createSafeAction } from "@/lib/create-safe-action";
import { createAuditLog } from "@/lib/create-audit-log";
import { CreateBoardSchema } from "./schema";
import { revalidatePath } from "next/cache";

const handler = async (data: z.infer<typeof CreateBoardSchema>) => {
  const ctx = await getTenantContext();         // orgId from Clerk JWT
  await requireRole("MEMBER", ctx);              // Minimum role check
  checkRateLimit(ctx.userId, "create-board", 30); // 30 req / 60s
  if (isDemoContext(ctx)) return { error: "Demo mode is read-only" };

  const dal = await createDAL(ctx);              // Tenant-scoped DB
  // ... board creation logic with dal.boards.create()

  await createAuditLog({
    entityTitle: board.title,
    entityId: board.id,
    entityType: "BOARD",
    action: "CREATE",
    previousValues: undefined,                   // No previous state (CREATE)
    newValues: { title: board.title },           // Forensic diff
  });

  revalidatePath(`/dashboard`);
  return { data: board };
};

export const createBoard = createSafeAction(CreateBoardSchema, handler);
```

### Schema Validation (Zod 4)

```typescript
// actions/schema.ts (shared schemas — single file, not per-action)
import { z } from "zod";

export const CreateBoardSchema = z.object({
  title: z.string().min(3).max(30),
  imageId: z.string(),
  imageThumbUrl: z.string(),
  imageFullUrl: z.string(),
  imageUserName: z.string(),
  imageLinkHTML: z.string(),
});
```

### Safe Action Wrapper (Actual)

```typescript
// lib/create-safe-action.ts (actual production code)
import { z } from "zod";
import { TenantError } from "@/lib/tenant-context";

// Generic messages — NEVER expose internal IDs, entity names, or org details
const TENANT_ERROR_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "You must be signed in to perform this action.",
  FORBIDDEN: "You do not have permission to perform this action.",
  NOT_FOUND: "The requested resource was not found.",
};

export const createSafeAction = <TInput, TOutput>(
  schema: z.Schema<TInput>,
  handler: (validatedData: TInput) => Promise<ActionState<TInput, TOutput>>
) => {
  return async (data: TInput): Promise<ActionState<TInput, TOutput>> => {
    const validationResult = schema.safeParse(data);

    if (!validationResult.success) {
      return {
        fieldErrors: validationResult.error.flatten().fieldErrors,
      };
    }

    try {
      return await handler(validationResult.data);
    } catch (err) {
      // Map TenantErrors to safe, generic client messages
      if (err instanceof TenantError) {
        return { error: TENANT_ERROR_MESSAGES[err.code] ?? "Something went wrong." };
      }
      throw err; // Re-throw unexpected errors — Next.js error boundary handles them
    }
  };
};
```

---

## 🎨 UI/UX Design System

### Design Principles

1. **Clarity Over Cleverness**: Every interface element should have a clear purpose
2. **Consistency**: Maintain consistent patterns across all screens
3. **Feedback**: Every action should provide immediate visual feedback
4. **Accessibility**: WCAG 2.1 AA compliance minimum
5. **Performance**: 60 FPS animations, <100ms interaction response

### Color System

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        // Brand Colors
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
        },
        
        // Semantic Colors
        success: {
          light: '#d1fae5',
          DEFAULT: '#10b981',
          dark: '#047857',
        },
        error: {
          light: '#fee2e2',
          DEFAULT: '#ef4444',
          dark: '#dc2626',
        },
        warning: {
          light: '#fef3c7',
          DEFAULT: '#f59e0b',
          dark: '#d97706',
        },
        
        // Neutral Scale
        neutral: {
          0: '#ffffff',
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#030712',
        },
      },
      
      // Spacing System (8px base)
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
      },
      
      // Typography
      fontSize: {
        '2xs': '0.625rem',   // 10px
        'xs': '0.75rem',     // 12px
        'sm': '0.875rem',    // 14px
        'base': '1rem',      // 16px
        'lg': '1.125rem',    // 18px
        'xl': '1.25rem',     // 20px
        '2xl': '1.5rem',     // 24px
        '3xl': '1.875rem',   // 30px
        '4xl': '2.25rem',    // 36px
        '5xl': '3rem',       // 48px
      },
      
      // Border Radius
      borderRadius: {
        '4xl': '2rem',
      },
      
      // Shadows
      boxShadow: {
        'soft': '0 2px 8px 0 rgba(0, 0, 0, 0.05)',
        'medium': '0 4px 16px 0 rgba(0, 0, 0, 0.08)',
        'strong': '0 8px 24px 0 rgba(0, 0, 0, 0.12)',
      },
    },
  },
};
```

### Component Library Structure

```
components/
├── ui/                    # shadcn/ui primitives
│   ├── button.tsx
│   ├── input.tsx
│   ├── dialog.tsx
│   └── ...
├── shared/                # Reusable components
│   ├── logo.tsx
│   ├── user-avatar.tsx
│   └── form-errors.tsx
├── board/                 # Feature-specific
│   ├── board-navbar.tsx
│   ├── list-container.tsx
│   └── card-modal.tsx
└── modals/                # Global modals
    └── card-modal/
        ├── index.tsx
        ├── header.tsx
        ├── description.tsx
        └── activity.tsx
```

### Accessibility Checklist

```typescript
// Accessibility Requirements

/**
 * WCAG 2.1 AA Compliance Checklist:
 * 
 * ✓ Color Contrast: 
 *   - Normal text: 4.5:1 minimum
 *   - Large text: 3:1 minimum
 * 
 * ✓ Keyboard Navigation:
 *   - All interactive elements must be keyboard accessible
 *   - Focus indicators must be visible
 *   - Tab order must be logical
 * 
 * ✓ Screen Reader Support:
 *   - Proper ARIA labels
 *   - Semantic HTML
 *   - Alt text for images
 * 
 * ✓ Forms:
 *   - Error messages must be descriptive
 *   - Labels must be associated with inputs
 *   - Required fields must be indicated
 * 
 * ✓ Responsive Design:
 *   - Touch targets minimum 44x44px
 *   - Text must be resizable to 200%
 *   - No horizontal scrolling at 320px width
 */

// Example: Accessible Button Component
export const Button = React.forwardRef<
  HTMLButtonElement,
  ButtonProps
>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      // Ensure buttons are keyboard accessible
      tabIndex={0}
      // Provide screen reader context
      role="button"
      aria-label={props['aria-label'] || props.children?.toString()}
      {...props}
    />
  );
});
```

---

## 🧪 Testing Strategy (The Realistic Version)

### The Honest Truth About Testing

**What Most Blueprints Say:**
"Achieve 80% test coverage with unit tests, integration tests, E2E tests, and visual regression tests."

**The Reality:**
You're one person. If you try to test everything, you'll spend 6 weeks writing tests and never finish the features. Recruiters don't check test coverage—they check if the app **works**.

### The Critical Path Strategy

Test **only the 3 things that would be embarrassing if they broke in front of a recruiter:**

**1. Can a user log in?** (E2E Test)
**2. Can a user create and move a card?** (E2E Test)  
**3. Does the payment flow work?** (E2E Test)

That's it. Ignore everything else.

---

### E2E Tests (Playwright) - The Only Tests That Matter

```typescript
// e2e/critical-path.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Critical User Flows', () => {
  
  // TEST 1: Authentication
  test('recruiter can view demo without signup', async ({ page }) => {
    await page.goto('/sign-in');
    
    // The big "View Demo" button should be visible
    const demoButton = page.locator('button:has-text("View Demo")');
    await expect(demoButton).toBeVisible();
    
    // Click and verify redirect to demo org
    await demoButton.click();
    await page.waitForURL(/\/organization\/demo-org-id/);
    
    // Verify demo board loads
    await expect(page.locator('h1')).toContainText('Product Roadmap');
  });
  
  // TEST 2: Drag and Drop (Desktop)
  test('user can drag card between lists', async ({ page }) => {
    // Login to demo org
    await page.goto('/organization/demo-org-id');
    
    // Find first card in "Backlog"
    const card = page.locator('[data-list="backlog"] [data-card]').first();
    const cardTitle = await card.textContent();
    
    // Drag to "In Progress"
    const targetList = page.locator('[data-list="in-progress"]');
    await card.dragTo(targetList);
    
    // Verify card moved
    await expect(
      targetList.locator(`[data-card]:has-text("${cardTitle}")`)
    ).toBeVisible();
    
    // Verify optimistic UI (card disappears from source immediately)
    await expect(
      page.locator('[data-list="backlog"]').locator(`[data-card]:has-text("${cardTitle}")`)
    ).not.toBeVisible();
  });
  
  // TEST 3: Mobile Touch Drag (Critical!)
  test('drag works on mobile', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-only test');
    
    await page.goto('/organization/demo-org-id');
    
    const card = page.locator('[data-card]').first();
    const targetList = page.locator('[data-list="done"]');
    
    // Simulate touch drag
    const cardBox = await card.boundingBox();
    const targetBox = await targetList.boundingBox();
    
    await page.touchscreen.tap(cardBox!.x + 10, cardBox!.y + 10);
    await page.waitForTimeout(300); // Touch activation delay
    await page.touchscreen.tap(targetBox!.x + 10, targetBox!.y + 10);
    
    // Verify card moved
    await expect(targetList.locator('[data-card]').first()).toBeVisible();
  });
  
  // TEST 4: Stripe Checkout
  test('user can upgrade to pro plan', async ({ page }) => {
    await page.goto('/organization/demo-org-id/settings/billing');
    
    // Click upgrade button
    await page.click('button:has-text("Upgrade to Pro")');
    
    // Should redirect to Stripe checkout
    await page.waitForURL(/checkout.stripe.com/);
    
    // In test mode, fill test card
    await page.fill('[name="cardNumber"]', '4242424242424242');
    await page.fill('[name="cardExpiry"]', '12/34');
    await page.fill('[name="cardCvc"]', '123');
    await page.fill('[name="billingName"]', 'Test User');
    
    await page.click('button[type="submit"]');
    
    // Should redirect back to app
    await page.waitForURL(/\/organization\/demo-org-id/);
    
    // Verify plan changed
    await expect(page.locator('text=Pro Plan')).toBeVisible();
  });
});
```

**Configuration:**

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Run sequentially to avoid conflicts
  retries: 2, // Retry flaky tests
  workers: 1, // One at a time
  
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure', // Only save traces for failures
    screenshot: 'only-on-failure',
  },
  
  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 14 Pro'] },
    },
  ],
  
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: true,
  },
});
```

---

### What About Unit Tests?

**Don't write them.** Here's why:

**Junior mistake:**
```typescript
// ❌ Waste of time
test('Button renders with correct text', () => {
  render(<Button>Click me</Button>);
  expect(screen.getByText('Click me')).toBeInTheDocument();
});
```

This tests React, not your code. Recruiters don't care.

**When to write unit tests:**
Only if you have complex business logic that's **separate from UI**:

```typescript
// ✅ Useful test
test('Lexorank generates correct midpoint', () => {
  const result = midRank('a', 'c');
  expect(result).toBe('b');
  
  const result2 = midRank('a', 'b');
  expect(result2).toBe('am'); // Between a and b
});
```

**Rule of thumb:**
- Complex algorithm? Write unit test.
- React component? Skip it, covered by E2E.
- Server action? Skip it, covered by E2E.

---

### Test Coverage Goal

**Target: 40%** (not 80%)

This is enough to prove you know how to test, without wasting weeks.

**What recruiters actually check:**
1. ✅ Does the app work when I click around?
2. ✅ Does drag-and-drop work on my iPhone?
3. ✅ Are there obvious bugs?

They don't run `npm test` and check coverage reports.

---

## 🚀 Performance Optimization

### Performance Budget

| Metric | Target | Maximum |
|--------|--------|---------|
| First Contentful Paint (FCP) | < 1.0s | 1.5s |
| Largest Contentful Paint (LCP) | < 2.0s | 2.5s |
| Time to Interactive (TTI) | < 3.0s | 3.8s |
| Total Blocking Time (TBT) | < 200ms | 300ms |
| Cumulative Layout Shift (CLS) | < 0.1 | 0.25 |
| Bundle Size (Initial) | < 150KB | 200KB |
| Lighthouse Score | > 95 | > 90 |

### Optimization Strategies

**1. Code Splitting**

```typescript
// app/layout.tsx
import dynamic from 'next/dynamic';

// Lazy load heavy components
const CommandPalette = dynamic(() => import('@/components/command-palette'), {
  ssr: false,
  loading: () => <div>Loading...</div>,
});

const CardModal = dynamic(() => import('@/components/modals/card-modal'), {
  ssr: false,
});

export default function RootLayout({ children }: Props) {
  return (
    <html>
      <body>
        {children}
        <CommandPalette />
        <CardModal />
      </body>
    </html>
  );
}
```

**2. Image Optimization**

```typescript
// components/unsplash-image.tsx
import Image from 'next/image';

export function UnsplashImage({ src, alt }: Props) {
  return (
    <Image
      src={src}
      alt={alt}
      width={1920}
      height={1080}
      quality={75}
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,..."
      loading="lazy"
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
    />
  );
}
```

**3. Database Query Optimization**

```typescript
// Avoid N+1 queries
const boards = await db.board.findMany({
  where: { organizationId },
  include: {
    lists: {
      include: {
        cards: {
          include: {
            labels: true,
            assignee: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    },
  },
});

// Use select to fetch only needed fields
const boards = await db.board.findMany({
  where: { organizationId },
  select: {
    id: true,
    title: true,
    imageThumbUrl: true, // Don't fetch full URL if not needed
  },
});
```

**4. React Performance**

```typescript
// Use memo for expensive computations
const sortedCards = useMemo(() => {
  return cards.sort((a, b) => a.order - b.order);
}, [cards]);

// Use callback to prevent re-renders
const handleDragEnd = useCallback((event: DragEndEvent) => {
  // ...
}, []);

// Use React.memo for components
export const CardItem = React.memo(({ card }: Props) => {
  // ...
});
```

**5. Caching Strategy**

```typescript
// app/organization/[orgId]/page.tsx
import { unstable_cache } from 'next/cache';

const getCachedBoards = unstable_cache(
  async (orgId: string) => {
    return db.board.findMany({
      where: { organizationId: orgId },
    });
  },
  ['org-boards'],
  {
    revalidate: 60, // Revalidate every 60 seconds
    tags: ['boards'],
  }
);

export default async function OrgPage({ params }: Props) {
  const boards = await getCachedBoards(params.orgId);
  
  return <BoardsList boards={boards} />;
}

// Revalidate on mutation
import { revalidateTag } from 'next/cache';

export async function createBoard(data: CreateBoardInput) {
  const board = await db.board.create({ data });
  
  revalidateTag('boards');
  
  return { data: board };
}
```

---

## 📊 Monitoring & Analytics

### Error Tracking (Sentry)

```typescript
// lib/sentry.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  
  // Performance Monitoring
  tracesSampleRate: 1.0,
  
  // Error Filtering
  beforeSend(event, hint) {
    // Filter out known errors
    if (event.exception?.values?.[0]?.value?.includes('ResizeObserver')) {
      return null;
    }
    return event;
  },
  
  // Add user context
  beforeSendTransaction(event) {
    // Add organization context
    return event;
  },
});

// Usage in components
try {
  await createBoard(data);
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      component: 'BoardCreation',
      action: 'createBoard',
    },
    extra: {
      boardData: data,
    },
  });
}
```

### Audit Sink (Axiom)

Every `createAuditLog()` call dual-writes: one row to PostgreSQL (queryable) and one append-only event to Axiom (forensic / tamper-evident). The Axiom key is **Ingest-Only** so even a compromised server cannot read or delete past entries.

```typescript
// lib/audit-sink.ts  (actual production code)
import 'server-only';

const AXIOM_DATASET = process.env.AXIOM_DATASET!;
const AXIOM_TOKEN   = process.env.AXIOM_INGEST_TOKEN!;   // Ingest-Only API token
const AXIOM_URL     = `https://api.axiom.co/v1/datasets/${AXIOM_DATASET}/ingest`;

export async function sinkToAxiom(event: {
  action: string;
  entityType: string;
  entityId: string;
  entityTitle: string;
  orgId: string;
  userId: string;
  userName: string;
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  await fetch(AXIOM_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AXIOM_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([{ ...event, _time: new Date().toISOString() }]),
  });
}
```

### Analytics (Board & User)

NEXUS uses **database-driven analytics** — no third-party analytics SDK. Board-level and user-level stats are computed via Prisma aggregations and cached in dedicated models.

```typescript
// Actual models used for analytics (from schema.prisma):
// BoardAnalytics — totalCards, completedCards, overdueCards, weeklyTrends (Json)
// UserAnalytics  — cardsCreated, cardsCompleted, commentsCount
// ActivitySnapshot — dailyActiveUsers, boardsCreated (org-scoped)

// actions/analytics/get-board-analytics.ts
// actions/analytics/get-advanced-analytics.ts
// hooks/use-realtime-analytics.ts
```

---

## 🔧 Development Workflow

### Git Workflow

```
main (production)
  │
  ├── develop (staging)
  │     │
  │     ├── feature/auth-system
  │     ├── feature/board-dnd
  │     └── bugfix/card-modal-z-index
  │
  └── hotfix/critical-security-patch
```

### Commit Convention

```bash
# Format: <type>(<scope>): <subject>

feat(board): add drag and drop functionality
fix(auth): resolve redirect loop on logout
docs(readme): update installation instructions
style(button): improve hover state styling
refactor(api): extract board queries to separate file
test(board): add unit tests for card ordering
chore(deps): upgrade Next.js to 15.0.1
perf(images): implement lazy loading for thumbnails
```

### Quality Gates (Pre-Deploy)

> **Note:** NEXUS does not use Husky or git hooks. Quality checks run via CI (GitHub Actions) and Vercel's build pipeline. Local development relies on IDE-integrated linting (ESLint) and manual type-checks.

```bash
# Manual quality checks (run before pushing)
npm run lint          # ESLint (Next.js config)
npx tsc --noEmit      # TypeScript strict mode — zero errors required
npm test              # Jest unit + integration tests
npx playwright test   # E2E tests (requires running server)
npm run build         # Full production build (type-check + ESLint built-in)
```

---

## 🚢 Deployment Strategy

### CI/CD Pipeline (Vercel + GitHub Actions)

> **Note:** Deployment is handled by **Vercel's native Git integration** (auto-deploys on push to `main`, preview deploys on PRs). GitHub Actions are used only for quality checks — **not** for deployment.

**Actual Workflows (`.github/workflows/`):**

**1. Bundle Size Check** (`bundle-size.yml`) — runs on PRs to `main`/`develop`:
```yaml
# Builds the PR, measures .next/static/chunks/ total size,
# and comments a bundle size report on the PR.
# Budget: 2 MB limit. Flags ❌ Over budget if exceeded.
name: Bundle Size Check
on:
  pull_request:
    branches: [main, develop]
jobs:
  bundle-size:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: nexus/package-lock.json
      - run: npm ci
        working-directory: nexus
      - run: npm run build
        working-directory: nexus
      # Analyzes .next/static/chunks/ and comments bundle size on PR
```

**2. Lighthouse CI** (`lighthouse-ci.yml`) — runs on PRs and pushes to `main`:
```yaml
# Builds production app, starts next server, runs Lighthouse audit,
# and comments Performance/Accessibility/Best Practices/SEO scores on PR.
name: Lighthouse CI
on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci && npm run build
        working-directory: nexus
      - run: npx next start &
        working-directory: nexus
      - uses: treosh/lighthouse-ci-action@v11
        with:
          urls: http://localhost:3000/
          budgetPath: nexus/.lighthouse-budget.json
      # Comments Lighthouse scores table on PR
```

**3. Vercel Deployment** (native, no workflow file):
```
Push to main    → Auto-deploy to production (vercel.com)
Push to PR      → Auto-deploy preview URL (unique per PR)
Cron endpoints  → Configured in vercel.json (lexorank-rebalance, daily-reports)
```

### Environment Variables

```bash
# .env.example

# Database
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/select-org"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/select-org"

# Payments (Stripe)
STRIPE_API_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# External APIs
UNSPLASH_ACCESS_KEY="..."

# Application
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"

# Monitoring
NEXT_PUBLIC_SENTRY_DSN="..."
AXIOM_DATASET="..."
AXIOM_INGEST_TOKEN="..."
```

---

## 📚 Development Roadmap (Vertical Slice Strategy)

### 🚨 CRITICAL: Do NOT Build Layer-by-Layer

**❌ The Wrong Way (How You'll Fail):**
```
Week 1: Setup database schema
Week 2: Build all API endpoints
Week 3: Build all UI components
Week 4: Connect everything
```

**Why this fails:**
- You'll get bored building database tables for features you haven't seen work
- You won't know if your architecture works until Week 4
- When something breaks, you don't know which layer is wrong

**✅ The Right Way (Vertical Slices):**

Build ONE complete feature end-to-end, then move to the next. Each week, you ship something **that works**.

---

### Week 1: The Vertical Slice (Most Important Week)

**Goal:** Get a card to move on screen and save to the database.

**Why start here:**
- This is your most impressive feature (drag-and-drop)
- If you can't make this work, the rest doesn't matter
- You'll understand the full stack immediately

**What to build:**

```
Day 1-2: Minimal Setup
├── Create Next.js project
├── Setup Supabase database
├── Create ONE table: cards (id, title, list_id, order)
└── Hardcode one user (skip auth entirely)

Day 3-4: The Board
├── Fetch 3 hardcoded lists from DB
├── Display cards in lists
├── Get @dnd-kit working (mouse only)
└── Update database on drop

Day 5-7: Polish & Mobile
├── Add TouchSensor for mobile
├── Add optimistic UI (update before DB confirms)
├── Add loading skeletons
└── Deploy to Vercel

🎯 End of Week 1 Deliverable:
A working Kanban board where I can drag cards 
between lists, and it saves to Supabase.
```

**Skip entirely in Week 1:**
- Authentication (hardcode user)
- Organizations (hardcode one org)
- Stripe (not needed yet)
- Tests (you're still figuring it out)

---

### Week 2: The Gates (Auth & Multi-Tenancy)

**Goal:** Add login and organization switching.

**What to build:**

```
Day 1-2: Authentication
├── Install Clerk
├── Add sign-in page with "View Demo" button
├── Create middleware to protect /organization routes
└── Seed demo organization with sample data

Day 3-4: Organizations
├── Create Organization model
├── Add organization creation flow
├── Build organization switcher dropdown
└── Filter boards by current organization

Day 5-7: RBAC
├── Add roles to OrganizationUser table
├── Create permission helper functions
├── Protect admin actions (delete board)
└── Test with multiple users

🎯 End of Week 2 Deliverable:
Multiple users can log in, create workspaces,
and see different data based on permissions.
```

---

### Week 3: The Data Layer (Lists & Cards CRUD)

**Goal:** Full board management with audit logs.

**What to build:**

```
Day 1-2: List Management
├── Create list
├── Rename list
├── Delete list
└── Reorder lists (drag lists, not just cards)

Day 3-4: Card Management
├── Create card
├── Edit card (title, description)
├── Delete card
├── Add labels
└── Add due dates

Day 5-7: Audit Logs
├── Create AuditLog table
├── Log every create/update/delete
├── Display activity feed in sidebar
└── Show activity in card modal

🎯 End of Week 3 Deliverable:
Complete board management with full history tracking.
```

---

### Week 4: The Real-Time Experience

**Goal:** Multiple users see changes instantly.

**What to build:**

```
Day 1-3: Supabase Realtime
├── Setup Realtime subscriptions
├── Listen for card changes
├── Update UI when other users move cards
└── Show "typing" indicators

Day 4-5: Optimistic UI Refinement
├── Handle rollback on errors
├── Add toast notifications
├── Show loading states
└── Handle race conditions

Day 6-7: Command Palette
├── Install cmdk library
├── Add Cmd+K handler
├── Search boards and cards
└── Quick actions (create board, etc.)

🎯 End of Week 4 Deliverable:
Real-time collaboration with instant updates.
```

---

### Week 5: The Money (Stripe Integration)

**Goal:** Working subscription system.

**What to build:**

```
Day 1-3: Stripe Setup
├── Create Stripe account
├── Install Stripe SDK
├── Build checkout flow
├── Create webhook endpoint
└── Update organization plan on payment

Day 4-5: Plan Limits
├── Enforce board limits (Free: 5, Pro: unlimited)
├── Show upgrade prompts
├── Build billing settings page
└── Show current plan badge

Day 6-7: Settings Pages
├── Organization settings
├── Member management
├── Invite users by email
└── Change member roles

🎯 End of Week 5 Deliverable:
Users can upgrade to Pro and invite team members.
```

---

### Week 6: The Polish (Details That Get You Hired)

**Goal:** Make it feel professional.

**What to build:**

```
Day 1-2: UI Polish
├── Add Framer Motion animations
├── Improve hover states
├── Add keyboard shortcuts
├── Better empty states
└── Loading skeletons everywhere

Day 3-4: Mobile Optimization
├── Responsive dashboard
├── Mobile-friendly modals
├── Horizontal scroll for boards
└── Touch-optimized buttons (44x44px)

Day 5-7: Error Handling
├── Setup Sentry
├── Add error boundaries
├── Create 404 page
├── Create 500 page
└── Handle network failures gracefully

🎯 End of Week 6 Deliverable:
Production-ready app with professional UX.
```

---

### Week 7: The Tests (Critical Paths Only)

**Goal:** Prove it works.

**What to build:**

```
Day 1-2: E2E Tests
├── Test: Demo login flow
├── Test: Create and drag card
├── Test: Stripe checkout
└── Test: Mobile touch drag

Day 3-4: Performance
├── Run Lighthouse audit
├── Optimize images
├── Reduce bundle size
└── Add compression

Day 5-7: Documentation
├── Write README
├── Record demo video
├── Take screenshots
└── Write portfolio case study

🎯 End of Week 7 Deliverable:
Tested, documented, portfolio-ready application.
```

---

### Week 8: The Launch (Go Live)

**Goal:** Deploy and market.

**What to build:**

```
Day 1-2: Production Deploy
├── Setup production environment variables
├── Configure Clerk production instance
├── Setup Stripe live mode
├── Deploy to Vercel
└── Test everything in production

Day 3-4: Monitoring
├── Setup Sentry error tracking
├── Configure Axiom audit sink
├── Create Vercel analytics dashboard
└── Setup uptime monitoring

Day 5-7: Portfolio
├── Update GitHub README
├── Add to LinkedIn
├── Update resume
├── Share on Twitter
└── Apply to jobs

🎯 End of Week 8 Deliverable:
Live app, tracked in production, portfolio updated.
```

---

## 🎯 The Weekly Checklist

**Every Friday, ask yourself:**

✅ Can I show this to someone and they'll say "wow"?  
✅ Does this feature work on mobile?  
✅ If this breaks, would it be embarrassing?  
✅ Can I explain why I built it this way?

If yes to all → Move to next week  
If no → Keep polishing

---

## 🚨 What to Do When You Get Stuck

**Stuck for 2+ hours?**
- Ask ChatGPT with specific error
- Check the library docs
- Search GitHub issues
- Post on Discord (Next.js, Supabase)

**Feeling overwhelmed?**
- Go back to Week 1 slice
- Make ONE thing work perfectly
- Then move forward

**Burnout warning signs:**
- Writing tests for UI components
- Refactoring code that works
- Adding features not in the roadmap
- Reading docs instead of coding

**Solution:**
Ship what you have. Get feedback. Iterate.

---

## 🎯 Success Metrics (What Actually Matters)

### Technical Metrics (What Recruiters Check)

| Metric | Target | Reality Check |
|--------|--------|---------------|
| **App Works?** | Yes | Open on mobile + desktop, no crashes |
| **Lighthouse Performance** | >90 | Recruiters check this on mobile |
| **Lighthouse Accessibility** | >90 | Shows you care about users |
| **No Console Errors** | Zero | Open DevTools = instant red flag |
| **Mobile Drag Works?** | Yes | Test on iPhone before sharing |
| **Demo Mode Works?** | Yes | Recruiter must be able to access without signup |
| **Deployed Live?** | Yes | Vercel URL in resume |

**How to measure:**
```bash
# Run Lighthouse in Chrome DevTools
# Mobile emulation, throttled network
# Score should be >90 for Performance and Accessibility
```

---

### Code Quality (What Matters in Interviews)

| What They'll Ask | Your Answer |
|------------------|-------------|
| "Why Next.js?" | "Server Components reduce JS bundle, better SEO, built-in API routes" |
| "How do you handle state?" | "Server state via Server Components, client state via Zustand for UI, optimistic updates for mutations" |
| "How did you prevent race conditions?" | "Optimistic UI with rollback, Supabase RLS for data isolation" |
| "Why Lexorank vs fractional indexing?" | "Fractional breaks after 50 drags due to floating-point precision" |
| "How do you test?" | "E2E tests for critical paths: auth, drag-drop, payments" |

**Proof you know your stuff:**
- ✅ Can explain every technology choice
- ✅ Can demo the app without bugs
- ✅ Can talk about trade-offs (why you chose X over Y)
- ✅ Can explain what you'd do differently at scale

---

### The Only Metric That Actually Gets You Hired

**"Does this look like something a Mid-level engineer built?"**

**Signs of a Mid-level engineer:**
- ✅ Thoughtful architecture (not over-engineered)
- ✅ Handles edge cases (error states, loading states)
- ✅ Works on mobile (most juniors forget this)
- ✅ Good UX details (keyboard shortcuts, optimistic UI)
- ✅ Production-ready (deployed, monitored, tested)

**Signs of a Junior:**
- ❌ Tutorial code with minor tweaks
- ❌ Doesn't work on mobile
- ❌ Crashes when you click around
- ❌ No error handling
- ❌ Only on localhost

---

### 📋 Pre-Launch Checklist (Use This Before Sharing)

```
🎯 Critical Path (If ANY of these fail, don't share yet):
☐ Demo mode login works without signup
☐ Drag-and-drop works on Chrome Desktop
☐ Drag-and-drop works on Safari iPhone
☐ No errors in console (F12 → Console)
☐ Lighthouse score >85 on mobile
☐ App deployed to Vercel with HTTPS
☐ Environment variables configured in Vercel

🎨 Polish (Makes you look professional):
☐ Loading skeletons instead of blank screens
☐ Error messages are helpful (not "Error 500")
☐ Hover states on all buttons
☐ Empty states have helpful messages
☐ Forms validate before submission
☐ Toast notifications for success/error
☐ 404 page exists (not default Next.js page)
☐ Favicon added

📱 Mobile Experience:
☐ Touch targets are 44x44px minimum
☐ Horizontal scroll works on boards
☐ Sidebar becomes hamburger menu
☐ Text is readable without zooming
☐ Forms don't zoom on focus (font-size ≥16px)
☐ Modals don't break viewport

🔒 Security (Basic Checklist):
☐ No API keys in client-side code
☐ RBAC enforced (members can't delete boards)
☐ Demo org is read-only
☐ SQL injection not possible (using Prisma)
☐ XSS not possible (React escapes by default)

📊 Monitoring:
☐ Sentry configured (catches errors in production)
☐ Can see errors in Sentry dashboard
☐ Vercel Analytics shows traffic

📝 Documentation:
☐ README has demo link
☐ README has screenshots
☐ README explains tech stack
☐ GitHub repo is public
☐ Code has helpful comments

🎥 Portfolio:
☐ Demo video recorded (2-3 min max)
☐ LinkedIn project added
☐ Resume updated with project
☐ Screenshots prepared for presentations
```

---

### 🚨 Red Flags Recruiters Look For

**Instant rejection triggers:**
1. ❌ App doesn't load (502 error)
2. ❌ Forces me to sign up without demo
3. ❌ Broken on mobile
4. ❌ Console full of errors
5. ❌ Looks like a tutorial (exact copy of Linear)

**Green flags that get you hired:**
1. ✅ Works immediately (demo mode)
2. ✅ Smooth drag-and-drop on iPhone
3. ✅ Professional UI (animations, loading states)
4. ✅ Unique feature (command palette, audit logs)
5. ✅ Can explain technical decisions

---

### Final Reality Check

**Before you share your portfolio:**

1. **Open in Incognito on mobile**
   - Does it work without login?
   - Is drag-and-drop smooth?
   - Are buttons large enough to tap?

2. **Send to a friend**
   - Can they use it without your help?
   - Do they say "wow this is impressive"?
   - Or do they find bugs immediately?

3. **Watch them use it**
   - Do they know what to click?
   - Do they get confused?
   - Do they try to break it?

**If your friend finds a bug, recruiters will too.**

Fix it before applying.

---

## 📖 Code Quality Standards

### TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "preserve",
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowJs": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "incremental": true,
    
    // Strict Type Checking
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    
    // Additional Checks
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

### ESLint Configuration

```json
// .eslintrc.json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "prettier"
  ],
  "rules": {
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

---

## 🔒 Security Best Practices

### Security Checklist

```typescript
/**
 * SECURITY CHECKLIST
 * 
 * ✓ Input Validation:
 *   - All user inputs validated with Zod
 *   - Server-side validation always enforced
 *   - XSS protection via React's automatic escaping
 * 
 * ✓ Authentication:
 *   - Secure session management (Clerk)
 *   - HTTPS-only cookies
 *   - CSRF protection enabled
 * 
 * ✓ Authorization:
 *   - RBAC implemented
 *   - Route protection via middleware
 *   - API endpoint authorization
 * 
 * ✓ Data Protection:
 *   - SQL injection prevention (Prisma)
 *   - Row-level security (Supabase RLS)
 *   - Sensitive data encryption
 * 
 * ✓ API Security:
 *   - Rate limiting
 *   - Request size limits
 *   - CORS configuration
 * 
 * ✓ Dependencies:
 *   - Regular dependency updates
 *   - Automated vulnerability scanning
 *   - No dependencies with known CVEs
 */
```

### Rate Limiting

> **Note:** NEXUS uses an **in-memory sliding-window** rate limiter (`lib/action-protection.ts`), NOT Upstash Redis. The function signature is designed for a drop-in Redis swap if multi-instance rate limiting is needed.

```typescript
// lib/action-protection.ts (actual production code)
const WINDOW_MS = 60_000;  // Hardcoded 60-second window
const store = new Map<string, number[]>();  // In-memory store (resets on cold-start)

// 3-param signature: checkRateLimit(userId, action, limit)
// windowMs is NOT configurable — always 60 seconds
export function checkRateLimit(
  userId: string,
  action: string,
  limit = 30
): RateLimitResult {
  const key = `${userId}:${action}`;
  const timestamps = (store.get(key) ?? []).filter(t => t > Date.now() - WINDOW_MS);
  if (timestamps.length >= limit) {
    return { allowed: false, remaining: 0, resetInMs: ..., retryAfterSeconds: ... };
  }
  timestamps.push(Date.now());
  store.set(key, timestamps);
  return { allowed: true, remaining: limit - timestamps.length, ... };
}

// Per-action limits (RATE_LIMITS constant):
//   create-board: 10     delete-board: 10
//   create-list: 20      delete-list: 20
//   create-card: 60      delete-card: 40
//   update-card: 120     update-card-order: 120 (high-frequency drag-and-drop)
//   update-list-order: 30
//   create-comment: 60   update-comment: 60   delete-comment: 40
//   add-reaction: 120    remove-reaction: 120
//   create-label: 10     assign-label: 120    assign-user: 120
//   default: 30

// Background cleanup every 5 minutes removes expired keys to cap memory
```

---

## 📈 Scalability Considerations (The Realistic Version)

### The Honest Truth

**What you're building:**
A portfolio project that demonstrates production-grade engineering at scale.

**What NEXUS actually implements (beyond basic CRUD):**
- **Database sharding**: `lib/shard-router.ts` — FNV-1a consistent hashing routes orgId to database shard
- **Connection pooling**: PgBouncer (port 6543) via Supabase
- **Cross-request caching**: `unstable_cache()` for tenant context (60s/15s TTLs)
- **In-memory rate limiting**: sliding-window with background cleanup (swap to Redis for multi-instance)
- **LexoRank rebalancing**: weekly cron job prevents ordering fragmentation
- **Proper indexes**: composite indexes on high-frequency query paths

**What this proves to recruiters:**
- You understand horizontal scaling patterns (sharding, connection pooling)
- You think about data access patterns (caching TTLs, index design)
- You plan for production (rate limiting, rebalancing crons, health checks)

---

### Database Optimization (Actual Useful Stuff)

**1. Indexes That Matter:**

```sql
-- These are already in your Prisma schema, but here's why:

-- Fast board lookup by organization
CREATE INDEX idx_boards_org_id ON boards(organization_id);

-- Fast card lookup by list + sorting
CREATE INDEX idx_cards_list_order ON cards(list_id, order);

-- Fast audit log lookup (most recent first)
CREATE INDEX idx_audit_logs_org_created 
  ON audit_logs(organization_id, created_at DESC);
```

**Why these help:**
- Organization has 50 boards → Index makes lookup instant
- List has 200 cards → Index makes sorting instant
- Audit log has 10,000 entries → Index makes pagination instant

**2. Query Optimization (Avoid N+1):**

```typescript
// ❌ BAD: N+1 query problem
const boards = await db.board.findMany({
  where: { organizationId }
});

for (const board of boards) {
  const lists = await db.list.findMany({
    where: { boardId: board.id }  // Queries DB 50 times!
  });
}

// ✅ GOOD: Single query with includes
const boards = await db.board.findMany({
  where: { organizationId },
  include: {
    lists: {
      include: {
        cards: {
          orderBy: { order: 'asc' }
        }
      },
      orderBy: { order: 'asc' }
    }
  }
});
```

**3. Pagination (When You Actually Need It):**

```typescript
// Don't load all 10,000 audit logs at once
const logs = await db.auditLog.findMany({
  where: { organizationId },
  orderBy: { createdAt: 'desc' },
  take: 20,  // Only 20 logs
  skip: page * 20,  // Pagination
});
```

---

### Caching Strategy (The Simple Version)

```
┌─────────────────────────────────┐
│     What Actually Needs Cache    │
├─────────────────────────────────┤
│                                 │
│  1. Static Assets (Automatic)   │
│     Vercel CDN handles this     │
│                                 │
│  2. Server Component Cache      │
│     Next.js handles this        │
│                                 │
│  3. User Session                │
│     Clerk handles this          │
│                                 │
│  YOU DON'T NEED TO DO ANYTHING  │
│                                 │
└─────────────────────────────────┘
```

**If you REALLY need to cache something:**

```typescript
// Only use this for expensive operations
import { unstable_cache } from 'next/cache';

const getOrgStats = unstable_cache(
  async (orgId: string) => {
    // Expensive aggregation query
    return db.card.groupBy({
      by: ['listId'],
      _count: true,
      where: { list: { board: { organizationId: orgId } } }
    });
  },
  ['org-stats'],
  { revalidate: 60 }  // Cache for 60 seconds
);
```

---

### When You ACTUALLY Need to Scale

**Signs you need to optimize:**
1. Queries take >1 second
2. Pages load slowly
3. Users complain
4. Vercel bill is high

**What to do:**
1. Run `EXPLAIN ANALYZE` on slow queries
2. Add missing indexes
3. Use `select` to fetch only needed fields
4. Consider using Vercel's Edge Config for read-heavy data

**What NOT to do:**
- Don't add Redis "just in case"
- Don't partition tables with 1,000 rows
- Don't build a microservices architecture
- Don't rewrite in Go for "performance"

---

### The Real Bottleneck (Hint: It's Not Your Database)

**Your app will be slow because:**
1. ❌ You forgot to add `loading.tsx` files
2. ❌ You're sending 5MB images instead of optimized thumbnails
3. ❌ You're fetching data in client components
4. ❌ You're not using Server Components

**Not because:**
- ❌ PostgreSQL is slow (it's not)
- ❌ You need Redis (you don't)
- ❌ You need GraphQL (you don't)

**Fix the real issues:**
```typescript
// ✅ Use Next.js Image for optimization
<Image 
  src={imageUrl} 
  width={800} 
  height={600}
  quality={75}  // Good enough
  loading="lazy"
/>

// ✅ Use Server Components for data fetching
async function BoardList({ orgId }: Props) {
  const boards = await db.board.findMany({
    where: { organizationId: orgId },
    select: {  // Only fetch what you need
      id: true,
      title: true,
      imageThumbUrl: true  // Not the full 5MB image
    }
  });
  
  return <div>{/* Render boards */}</div>;
}
```

---

## 🎨 Visual Design Reference

### Landing Page Wireframe

```
┌────────────────────────────────────────────────────────────┐
│  ┌──────┐                      [Features] [Pricing] [Login]│
│  │ LOGO │                                    [Sign Up CTA] │
├────────────────────────────────────────────────────────────┤
│                                                             │
│                  Task Management for Humans                 │
│            Manage projects, organize tasks, and             │
│               build productivity at light speed             │
│                                                             │
│           ┌─────────────────────────────────┐              │
│           │   Get Nexus for Free   [→]     │              │
│           └─────────────────────────────────┘              │
│                                                             │
│                    ┌────────────────┐                       │
│                    │  [Demo Video]  │                       │
│                    │    or Image    │                       │
│                    └────────────────┘                       │
├────────────────────────────────────────────────────────────┤
│                      FEATURES SECTION                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │  [Icon]  │  │  [Icon]  │  │  [Icon]  │                 │
│  │  Feature │  │  Feature │  │  Feature │                 │
│  │    1     │  │    2     │  │    3     │                 │
│  └──────────┘  └──────────┘  └──────────┘                 │
├────────────────────────────────────────────────────────────┤
│                       FOOTER                                │
│  GitHub | Twitter | Privacy | Terms                        │
└────────────────────────────────────────────────────────────┘
```

### Dashboard Layout

```
┌────────────────────────────────────────────────────────────┐
│  [☰] NEXUS          [Search]           [Profile] [⌘K]      │
├──────────┬─────────────────────────────────────────────────┤
│          │                                                  │
│ [Logo]   │  ┌─────────────┐ ┌─────────────┐ ┌──────────┐ │
│          │  │Total Tasks  │ │Assigned to  │ │Completed │ │
│ My Org ▾ │  │    247      │ │   Me: 12    │ │ Week: 34 │ │
│          │  └─────────────┘ └─────────────┘ └──────────┘ │
│ ──────── │                                                  │
│ Boards   │  Recent Activity                                │
│ Members  │  ┌───────────────────────────────────────────┐ │
│ Settings │  │ • Alex moved "Fix bug" to Done  2m ago    │ │
│ Activity │  │ • Sarah created "New feature" 5m ago      │ │
│          │  │ • John commented on "Design" 10m ago      │ │
│ ──────── │  └───────────────────────────────────────────┘ │
│          │                                                  │
│ Boards   │  Your Boards                                    │
│ ▾        │  ┌────────┐ ┌────────┐ ┌────────┐             │
│ Marketing│  │[Image] │ │[Image] │ │[Image] │             │
│ Dev Team │  │Board 1 │ │Board 2 │ │Board 3 │             │
│ Personal │  └────────┘ └────────┘ └────────┘             │
│          │                                                  │
└──────────┴─────────────────────────────────────────────────┘
```

### Board View

```
┌────────────────────────────────────────────────────────────┐
│  ← Back to Org          Marketing Campaign    [Settings]   │
├────────────────────────────────────────────────────────────┤
│  Beautiful Unsplash Background Image                        │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ To Do    │  │In Progress│  │  Review  │  │   Done   │  │
│  ├──────────┤  ├──────────┤  ├──────────┤  ├──────────┤  │
│  │┌────────┐│  │┌────────┐│  │┌────────┐│  │┌────────┐│  │
│  ││ Card 1 ││  ││ Card 4 ││  ││ Card 7 ││  ││ Card 9 ││  │
│  ││ [Label]││  ││ [Label]││  ││ [Label]││  ││ [Label]││  │
│  │└────────┘│  │└────────┘│  │└────────┘│  │└────────┘│  │
│  │┌────────┐│  │┌────────┐│  │          │  │┌────────┐│  │
│  ││ Card 2 ││  ││ Card 5 ││  │          │  ││ Card 10││  │
│  │└────────┘│  │└────────┘│  │          │  │└────────┘│  │
│  │┌────────┐│  │┌────────┐│  │          │  │          │  │
│  ││ Card 3 ││  ││ Card 6 ││  │          │  │          │  │
│  │└────────┘│  │└────────┘│  │          │  │          │  │
│  │          │  │          │  │          │  │          │  │
│  │[+Add]    │  │[+Add]    │  │[+Add]    │  │[+Add]    │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                  [+Add List]│
└────────────────────────────────────────────────────────────┘
```

---

## 📄 File Structure

> **Actual production file structure** — verified against the codebase.

```
nexus/
├── .github/
│   └── workflows/
│       ├── bundle-size.yml          # PR bundle size check (2 MB budget)
│       └── lighthouse-ci.yml        # Lighthouse performance audit
├── app/
│   ├── layout.tsx                   # Root layout (ClerkProvider, Sentry, theme)
│   ├── page.tsx                     # Landing page
│   ├── globals.css                  # Global styles + Tailwind 4
│   ├── editor.css                   # TipTap editor styles
│   ├── error.tsx                    # Error boundary
│   ├── global-error.tsx             # Global error boundary
│   ├── not-found.tsx                # 404 page
│   ├── sitemap.ts                   # Dynamic sitemap
│   ├── robots.ts                    # Robots.txt
│   │
│   ├── (auth)/                      # Auth route group
│   │   ├── sign-in/[[...sign-in]]/  # Clerk sign-in
│   │   └── sign-up/[[...sign-up]]/  # Clerk sign-up
│   │
│   ├── dashboard/                   # Main dashboard
│   ├── board/[boardId]/             # Board view
│   │   ├── settings/                # Board settings
│   │   └── workload/                # Workload view
│   ├── organization/[orgId]/        # Org management
│   ├── billing/                     # Stripe billing
│   ├── activity/                    # Activity feed
│   ├── search/                      # Global search
│   ├── roadmap/                     # Roadmap view
│   ├── select-org/                  # Org selector
│   ├── onboarding/                  # First-time setup
│   ├── pending-approval/            # Pending membership
│   ├── request-board-access/        # Board access request
│   ├── shared/[token]/              # Public board shares
│   │
│   ├── settings/                    # Platform settings
│   │   ├── api-keys/                # API key management
│   │   ├── automations/             # Automation rules
│   │   ├── integrations/            # GitHub, Slack
│   │   ├── webhooks/                # Webhook config
│   │   └── gdpr/                    # GDPR data controls
│   │
│   ├── about/                       # Public pages
│   ├── terms/
│   ├── privacy/
│   │
│   └── api/                         # API routes
│       ├── v1/                      # RESTful API (external)
│       │   ├── boards/              # GET, POST
│       │   │   └── [boardId]/       # GET, PUT, DELETE
│       │   └── cards/               # GET, POST
│       │       └── [cardId]/        # GET, PUT, DELETE
│       ├── boards/                  # Internal board API
│       │   └── requestable/         # Requestable boards
│       ├── cards/search/            # Full-text card search
│       ├── members/                 # Org members list
│       ├── audit-logs/              # Audit log queries
│       ├── attachment/              # File uploads
│       ├── membership-requests/     # Membership CRUD
│       │   └── mine/                # User's own requests
│       ├── stripe/                  # Billing
│       │   ├── checkout/            # Stripe Checkout
│       │   └── portal/             # Customer Portal
│       ├── webhook/
│       │   └── stripe/              # Stripe webhook (HMAC verified)
│       ├── integrations/
│       │   ├── github/              # GitHub integration
│       │   └── slack/               # Slack integration
│       ├── realtime-auth/           # Supabase Realtime token
│       ├── push/                    # Push notifications
│       │   ├── send/
│       │   └── subscribe/
│       ├── ai/                      # OpenAI proxy
│       ├── tenor/                   # GIF search
│       │   ├── featured/
│       │   └── search/
│       ├── unsplash/                # Cover images
│       ├── upload/                  # File upload
│       ├── export/[boardId]/        # Board export
│       ├── import/                  # Board import
│       ├── gdpr/                    # GDPR endpoints
│       │   ├── export/
│       │   └── delete-request/
│       ├── admin/seed-templates/    # Template seeding
│       ├── cron/                    # Scheduled jobs
│       │   ├── daily-reports/       # Email digests
│       │   └── lexorank-rebalance/  # LexoRank maintenance
│       └── health/                  # Health checks
│           └── shards/              # Shard health
│
├── actions/                         # Server Actions (42 files)
│   ├── create-board.ts              # Board CRUD
│   ├── update-board.ts
│   ├── delete-board.ts
│   ├── create-list.ts               # List CRUD
│   ├── update-list.ts
│   ├── delete-list.ts
│   ├── update-list-order.ts         # LexoRank reorder
│   ├── create-card.ts               # Card CRUD
│   ├── update-card.ts
│   ├── delete-card.ts
│   ├── get-card.ts
│   ├── update-card-order.ts         # LexoRank reorder (120 req/60s limit)
│   ├── bulk-card-actions.ts         # Bulk operations
│   ├── label-actions.ts             # Labels (org-scoped)
│   ├── assignee-actions.ts          # Card assignment
│   ├── attachment-actions.ts        # File attachments
│   ├── checklist-actions.ts         # Checklists + items
│   ├── ai-checklist-actions.ts      # AI-generated checklists
│   ├── dependency-actions.ts        # Card dependencies
│   ├── custom-field-actions.ts      # Custom fields
│   ├── sprint-actions.ts            # Agile sprints
│   ├── time-tracking-actions.ts     # Time logs
│   ├── board-member-actions.ts      # Board membership
│   ├── board-share-actions.ts       # Public board shares
│   ├── permission-scheme-actions.ts # RBAC schemes (28 permissions)
│   ├── automation-actions.ts        # Automation rules
│   ├── ai-actions.ts                # AI card suggestions
│   ├── api-key-actions.ts           # API key management
│   ├── membership-request-actions.ts# Org/board access requests
│   ├── notification-actions.ts      # Notification CRUD
│   ├── roadmap-actions.ts           # Epics + initiatives
│   ├── saved-view-actions.ts        # Saved board views
│   ├── template-actions.ts          # Board templates
│   ├── webhook-actions.ts           # Webhook CRUD
│   ├── import-export-actions.ts     # Board import/export
│   ├── user-preferences.ts          # User settings
│   ├── billing-step-up.ts           # Stripe step-up auth
│   ├── get-audit-logs.ts            # Audit log queries
│   ├── phase3-actions.ts            # Legacy admin actions
│   ├── schema.ts                    # Shared Zod schemas
│   └── analytics/
│       ├── get-board-analytics.ts   # Board-level stats
│       └── get-advanced-analytics.ts# Org-wide analytics
│
├── components/                      # React Components (109 files)
│   ├── ui/                          # shadcn/ui primitives
│   ├── board/                       # Board view components
│   ├── modals/                      # Modal dialogs
│   │   └── card-modal/              # Card detail modal
│   ├── editor/                      # TipTap rich text editor
│   ├── landing/                     # Landing page sections
│   ├── layout/                      # App layout components
│   ├── settings/                    # Settings pages
│   ├── analytics/                   # Charts + dashboards
│   ├── activity/                    # Activity feed
│   ├── demo/                        # Demo mode components
│   ├── providers/                   # Context providers
│   ├── accessibility/               # A11y utilities
│   └── performance/                 # Performance components
│
├── hooks/                           # Custom React Hooks (13 files)
│   ├── use-realtime-board.ts        # Supabase Realtime board sync
│   ├── use-realtime-analytics.ts    # Live analytics updates
│   ├── use-presence.ts              # User presence indicators
│   ├── use-card-modal.ts            # Card modal state (Zustand)
│   ├── use-card-lock.ts             # Optimistic locking
│   ├── use-optimistic-card.ts       # Optimistic UI updates
│   ├── use-debounce.ts              # Debounced callbacks
│   ├── use-keyboard-shortcuts.ts    # Keyboard shortcuts
│   ├── use-ai-cooldown.ts           # AI rate limit cooldown
│   ├── use-push-notifications.ts    # Web push notifications
│   ├── use-demo-mode.ts             # Demo mode state
│   ├── use-demo-data.ts             # Demo board data
│   └── use-demo-session.ts          # Demo session management
│
├── lib/                             # Core Libraries (35+ files)
│   ├── db.ts                        # Prisma client + setCurrentOrgId()
│   ├── dal.ts                       # Data Access Layer (tenant-scoped)
│   ├── tenant-context.ts            # Clerk JWT → orgId (React cache())
│   ├── create-safe-action.ts        # Server action wrapper (Zod + TenantError)
│   ├── action-protection.ts         # Rate limiting + DEMO_ORG_ID
│   ├── board-permissions.ts         # 28 granular board permissions
│   ├── cross-board-access.ts        # Cross-board card references
│   ├── api-key-auth.ts              # API key authentication
│   ├── api-key-constants.ts         # API key scopes
│   ├── create-audit-log.ts          # Audit logging (+ Sentry capture)
│   ├── audit-sink.ts                # Axiom dual-write
│   ├── event-bus.ts                 # Card event bus (automations + webhooks)
│   ├── automation-engine.ts         # Automation rule engine
│   ├── webhook-delivery.ts          # Webhook HTTP delivery
│   ├── webhook-constants.ts         # Webhook event types
│   ├── lexorank.ts                  # LexoRank ordering (64-char guard)
│   ├── rate-limit.ts                # Upstash Redis rate limiter
│   ├── stripe.ts                    # Stripe SDK v20 client
│   ├── step-up-action.ts            # Billing step-up flows
│   ├── request-context.ts           # Request-scoped context
│   ├── logger.ts                    # Structured logging
│   ├── sentry-helpers.ts            # Sentry error utilities
│   ├── shard-router.ts              # FNV-1a database sharding
│   ├── prefetch.ts                  # Data prefetching
│   ├── realtime-channels.ts         # Supabase channel names
│   ├── yjs-supabase-provider.ts     # Y.js CRDT collaborative editing
│   ├── supabase/
│   │   └── client.ts                # Supabase client (Realtime only)
│   ├── services/
│   │   ├── ai-service.ts            # OpenAI integration
│   │   └── pdf-service.ts           # PDF export
│   ├── email.ts                     # Resend email client
│   ├── env.ts                       # Environment validation
│   ├── utils.ts                     # General utilities
│   ├── colors.ts                    # Color system
│   ├── design-tokens.ts             # Design tokens
│   ├── spacing.ts                   # Spacing scale
│   ├── priority-values.ts           # Priority enum values
│   ├── format-utils.ts              # Formatting helpers
│   ├── legal.ts                     # Legal text
│   ├── settings-defaults.ts         # Default settings
│   ├── bulk-selection-context.tsx    # Bulk selection state
│   └── performance/
│       └── index.ts                 # Performance utilities
│
├── emails/                          # Email Templates (Resend)
│   ├── _base.ts                     # Base template
│   ├── invite.ts                    # Org invitations
│   ├── assigned.ts                  # Card assignment
│   ├── mention.ts                   # @mention notifications
│   ├── due-soon.ts                  # Due date reminders
│   └── digest.ts                    # Daily digest
│
├── prisma/
│   ├── schema.prisma                # 41 models, 13 enums
│   ├── seed.ts                      # Database seeding
│   └── migrations/                  # Migration history
│
├── __tests__/                       # Test Suite (50+ files)
│   ├── unit/                        # Jest unit tests
│   │   ├── action-protection.test.ts
│   │   ├── ai-actions.test.ts
│   │   ├── automation-actions.test.ts
│   │   ├── board-share-actions.test.ts
│   │   ├── attachment-actions.test.ts
│   │   ├── cards/card-operations.test.ts
│   │   ├── audit/audit-forensic-integrity.test.ts
│   │   ├── auth/                    # Auth flow tests
│   │   ├── billing/                 # Stripe billing tests
│   │   ├── api-keys/                # API key tests
│   │   ├── automations/             # Automation engine tests
│   │   └── ai-quota/                # AI quota tests
│   ├── integration/
│   │   └── server-actions.test.ts
│   └── a11y/                        # Accessibility tests
│
├── e2e/                             # Playwright E2E Tests
│   ├── auth.setup.ts                # Auth fixture (User A)
│   ├── auth-user-b.setup.ts         # Auth fixture (User B)
│   ├── golden-path.spec.ts          # Happy path flow
│   ├── boards.spec.ts               # Board CRUD
│   ├── cards.spec.ts                # Card operations
│   ├── tenant-isolation.spec.ts     # Multi-tenant security
│   ├── chaos.spec.ts                # Chaos engineering
│   └── user-journeys.spec.ts        # User journey flows
│
├── __mocks__/                       # Test mocks
├── public/                          # Static assets
│   ├── manifest.json                # PWA manifest
│   ├── sw.js                        # Service Worker
│   ├── icon-192.png                 # App icons
│   └── icon-512.png
│
├── proxy.ts                         # Edge middleware (Clerk + security headers)
├── next.config.ts                   # Next.js 16 config
├── tailwind.config.ts               # Tailwind CSS 4 config
├── postcss.config.mjs               # PostCSS config
├── tsconfig.json                    # TypeScript strict config
├── tsconfig.test.json               # Test TypeScript config
├── jest.config.ts                   # Jest 30.2+ config
├── jest.setup.ts                    # Jest setup
├── playwright.config.ts             # Playwright config
├── .eslintrc.json                   # ESLint config
├── eslint.config.mjs                # ESLint flat config
├── components.json                  # shadcn/ui config
├── vercel.json                      # Vercel deployment config
├── .lighthouse-budget.json          # Lighthouse budgets
├── sentry.client.config.ts          # Sentry browser config
├── sentry.server.config.ts          # Sentry server config
├── sentry.edge.config.ts            # Sentry edge config
├── instrumentation.ts               # OpenTelemetry instrumentation
├── .env.example                     # Environment template
├── .gitignore
└── package.json
```

---

## 🎓 Learning Resources

### Required Reading

1. **Next.js Documentation** - https://nextjs.org/docs
2. **React Server Components** - https://react.dev/blog/2023/03/22/react-labs-what-we-have-been-working-on-march-2023#react-server-components
3. **Prisma Best Practices** - https://www.prisma.io/docs/guides/performance-and-optimization
4. **dnd-kit Documentation** - https://docs.dndkit.com/

### Recommended Videos

1. **Next.js 15 App Router Tutorial** - Vercel
2. **Building Production-Ready Apps** - Theo Browne
3. **Advanced TypeScript Patterns** - Matt Pocock
4. **Real-time with Supabase** - Jon Meyers

---

## 🏆 Portfolio Presentation

### Demo Script

**[00:00-00:30] Introduction**
> "I built NEXUS, an enterprise-grade B2B SaaS platform for team collaboration. This application demonstrates my expertise in full-stack development, focusing on performance, security, and user experience."

**[00:30-01:30] Key Technical Features**
> "The tech stack includes Next.js 15 with Server Components, TypeScript for type safety, and Supabase for real-time data synchronization. The application features optimistic UI updates for zero-latency user experience, comprehensive role-based access control, and Stripe integration for subscription management."

**[01:30-02:30] Live Demo**
> [Show authentication flow]
> [Demonstrate drag-and-drop]
> [Show real-time collaboration]
> [Display command palette]

**[02:30-03:00] Architecture Highlights**
> "The architecture follows modern best practices: server-first rendering for SEO and performance, edge middleware for security, and a multi-layered caching strategy. The application achieves a Lighthouse score of 95+ with full WCAG accessibility compliance."

**[03:00-03:30] Production Readiness**
> "This isn't a tutorial project—it's production-ready with 80% test coverage, comprehensive error tracking via Sentry, CI/CD pipeline, and proper monitoring. The codebase demonstrates enterprise-level patterns that scale."

### GitHub README Template

```markdown
# NEXUS - Enterprise Task Management Platform

A production-ready B2B SaaS platform built with Next.js 15, TypeScript, and Supabase.

## 🚀 Live Demo
[View Live Demo](https://nexus.example.com)

## ✨ Features
- 🔐 Secure authentication with organization support
- 🎯 Real-time collaborative Kanban boards
- ⚡ Optimistic UI for instant interactions
- 🎨 Drag-and-drop with physics-based animations
- 💳 Stripe subscription integration
- 🔍 Command palette (⌘K)
- 📊 Activity audit logs
- 👥 Role-based access control

## 🛠️ Tech Stack
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL (Supabase)
- **ORM:** Prisma
- **Auth:** Clerk
- **Payments:** Stripe
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui
- **Animations:** Framer Motion
- **Deployment:** Vercel

## 📊 Performance
- Lighthouse Score: 95+
- Test Coverage: 80%
- Bundle Size: <200KB

## 🏃 Getting Started
[Installation instructions]

## 📝 License
MIT
```

---

## 🎯 Interview Talking Points (How to Answer the Hard Questions)

### Technical Depth Questions

**Q: "Why did you choose Next.js over Create React App?"**

**A:** "Next.js provides Server Components, which let me fetch data on the server and send only the HTML to the client. This reduces the JavaScript bundle size and improves Time to First Byte. It also has built-in API routes through Server Actions, so I don't need a separate Express server. For a project like this, it's the industry standard—companies like Vercel, Linear, and Cal.com use it."

---

**Q: "How did you handle real-time updates?"**

**A:** "I used Supabase Realtime, which creates WebSocket connections to the database. When User A moves a card, the database sends a notification to all connected clients, and User B sees the update instantly. I combined this with optimistic UI—the local state updates immediately, and if the server request fails, it rolls back with a toast notification."

---

**Q: "Explain your approach to state management."**

**A:** "I used a layered approach:
- **Server state**: Fetched in Server Components and passed as props
- **Client state**: Zustand for UI state like sidebar open/closed
- **Optimistic state**: React's `useOptimistic` for temporary updates before server confirms

This keeps concerns separated—Server Components handle data, client components handle interactivity."

---

**Q: "How did you ensure security?"**

**A:** "Multiple layers:
1. **Authentication**: Clerk manages sessions with secure HTTP-only cookies
2. **Authorization**: Middleware checks user role before allowing actions
3. **Database**: Supabase Row-Level Security ensures users can only access their organization's data
4. **Input validation**: Zod validates all inputs on the server before touching the database
5. **RBAC**: Role-based permissions prevent members from deleting boards"

---

**Q: "Why did you use Lexorank for card ordering instead of simple integers?"**

**A (The Honest Answer):** "Initially, I used fractional indexing—calculating `(prevOrder + nextOrder) / 2`. But I learned that after about 50 drag operations, JavaScript's floating-point precision breaks down. The numbers become so small (like 0.0000000001) that they start causing issues. Lexorank uses string-based ordering, which avoids this problem entirely. It's the same system Jira and Linear use."

**Why this answer is gold:** You identified a real problem, researched the solution, and implemented it. This shows you don't just copy code—you understand trade-offs.

---

**Q: "How did you test this?"**

**A (The Honest Answer):** "I focused on critical paths rather than trying to test everything. I wrote E2E tests for the three things that would be embarrassing if they broke: login, drag-and-drop, and payments. I didn't write unit tests for UI components because those are already tested by React. Testing the full user flow gives me more confidence than testing individual functions in isolation."

**Why this is smart:** Shows you understand ROI on testing. Seniors know when NOT to test.

---

**Q: "What was the most challenging technical problem?"**

**A:** "The drag-and-drop system. It needed to:
1. Work on mobile touchscreens (HTML5 Drag API doesn't support touch)
2. Handle reordering within lists AND moving between lists
3. Update optimistically without waiting for the server
4. Prevent the Lexorank ordering bug

The solution was using `@dnd-kit` with both `PointerSensor` (desktop) and `TouchSensor` (mobile), combined with optimistic UI that rolls back on errors. The hardest part was ensuring the order calculation didn't break after many drags."

---

**Q: "Is this a microservices architecture?"**

**A (The Honest Answer):** "No, it's a monolith deployed to Vercel's Edge Network. I chose this because:
1. I'm one person—microservices would add complexity without benefits
2. Monoliths are easier to reason about and debug
3. Edge deployment gives me global performance
4. This is how most modern Next.js apps are built (Linear, Cal.com)

If this needed to scale to millions of users, I'd consider extracting the real-time service or payment processing, but for this use case, a monolith is the right choice."

**Why recruiters love this:** You're honest about trade-offs and understand that "more complex" ≠ "better."

---

**Q: "How would you scale this to 1 million users?"**

**A:** 
"Current architecture handles ~10,000 users easily. For 1M:
1. **Database**: Add read replicas, partition audit logs by month
2. **Caching**: Add Redis for frequently accessed data (org stats, user sessions)
3. **Real-time**: Consider dedicated WebSocket servers instead of Supabase
4. **CDN**: Already handled by Vercel Edge
5. **Monitoring**: Setup alerts for slow queries (>1s)

But honestly, the biggest bottleneck would be the real-time connections—I'd move to a dedicated pub/sub service like Pusher or Ably."

---

### Questions to Ask the Interviewer (Shows You're Senior)

1. **"What does your current tech stack look like?"**
   - Shows you care about fitting into their team

2. **"How do you handle database migrations in production?"**
   - Shows you think about operations, not just features

3. **"What's your approach to testing?"**
   - Helps you understand their quality standards

4. **"How do you balance tech debt with shipping features?"**
   - Shows you understand real-world engineering

---

### Red Flag Answers to Avoid

❌ "I used Redux because everyone uses Redux"
→ Shows you don't think critically

❌ "I tested everything to get 100% coverage"
→ Shows you don't understand testing ROI

❌ "This is basically production-ready for a startup"
→ Overconfident without real production experience

❌ "I could build this in a weekend"
→ Underestimates complexity, will miss deadlines

✅ "I made trade-offs to ship in 8 weeks while maintaining quality"
→ Honest, realistic, understands constraints

---

### The Ultimate Answer Framework

**When asked about ANY technical decision:**

```
1. State the choice: "I used X"
2. Explain the why: "Because it solves Y problem"
3. Acknowledge alternatives: "I considered Z but..."
4. Show awareness of trade-offs: "The downside is..."
5. Prove it works: "In production, this handles..."
```

**Example:**

"I used Next.js Server Components for data fetching because they reduce the JavaScript sent to the client and improve SEO. I considered using client-side React Query, but that would increase the bundle size and require more loading states. The trade-off is that Server Components require server-side rendering, which can be slower for highly dynamic data. But for a board app where data changes infrequently per user, it's the right choice. In production, this gives me Lighthouse scores over 90."

---

## 📋 Final Checklist

### Pre-Launch Verification

```
Production Readiness:
☐ All environment variables configured in Vercel
☐ Database migrations run successfully
☐ Clerk production instance configured
☐ Stripe production keys active
☐ Webhook endpoints verified
☐ DNS records configured
☐ SSL certificate active
☐ Error tracking (Sentry) live
☐ Audit sink (Axiom) receiving events

Code Quality:
☐ ESLint passes with no errors
☐ TypeScript builds without errors
☐ Test coverage > 80%
☐ All E2E tests passing
☐ No console.log statements
☐ Lighthouse score > 95
☐ Bundle size < 200KB
☐ Accessibility audit passed

Security:
☐ No exposed API keys
☐ CORS properly configured
☐ Rate limiting active
☐ Input validation on all endpoints
☐ RBAC enforced
☐ HTTPS-only cookies
☐ Content Security Policy set

Documentation:
☐ README complete
☐ API documentation written
☐ Code comments added
☐ Environment variables documented
☐ Deployment guide created
☐ Demo video recorded

Portfolio:
☐ Live demo accessible
☐ GitHub repo public
☐ Professional screenshots captured
☐ Case study written
☐ Resume updated
☐ LinkedIn project added
```

---

## 🎉 Conclusion: This Blueprint Gets You Hired

### What Makes This Different From Other Blueprints

**Most project plans say:**
- "Build a microservices architecture"
- "Achieve 80% test coverage"
- "Use the latest technologies"
- "Scale to millions of users"

**This blueprint says:**
- ✅ Build a **monolith** (it's honest and appropriate)
- ✅ Test the **critical paths** (login, drag-drop, payments)
- ✅ Use **proven tools** (Next.js, Supabase, Clerk)
- ✅ Build for **100 users** and explain how you'd scale

### The Honest Truth About Getting Hired

**What recruiters actually check:**

1. **Does it work?** (Open on mobile, no crashes)
2. **Is there a demo?** (One-click access without signup)
3. **Does it look professional?** (Loading states, animations, polish)
4. **Can you explain it?** (Why did you use X over Y?)

**What recruiters DON'T check:**

- ❌ Test coverage percentage
- ❌ Number of microservices
- ❌ Lines of code
- ❌ GitHub stars

### The Three Things That Actually Matter

**1. The Demo Works**
- Guest mode login (no signup required)
- Smooth drag-and-drop on iPhone
- Professional UI with loading states
- No errors in console

**2. You Can Explain It**
- Why Next.js? (Server Components reduce bundle size)
- Why Lexorank? (Fractional indexing breaks after 50 drags)
- Why monolith? (Appropriate for this scale)
- What would you change? (Extract real-time service at 1M users)

**3. It Shows Growth**
- From junior ("I used Redux because everyone does")
- To mid-level ("I used Zustand because it's simpler for UI state")
- To senior ("I evaluated Redux, Zustand, and Jotai. Here's why I chose X...")

---

## 🎯 Final Reality Check

**Before you start building:**

Ask yourself:
- Can I commit 2-3 hours per day for 8 weeks?
- Do I have a friend who can test the mobile version?
- Am I building to learn, or building to copy?

**If you answered "yes" to all three, you're ready.**

**If you answered "no" to any:**
- Don't start yet. You'll quit halfway.
- Watch YouTube tutorials first.
- Build a simpler project (todo app, blog).

---

## 📚 What You'll Actually Learn

By building this, you'll master:

**Week 1:** Full-stack development (Next.js + Supabase)  
**Week 2:** Authentication & authorization (Clerk + RBAC)  
**Week 3:** Complex state management (drag-and-drop + optimistic UI)  
**Week 4:** Real-time systems (WebSocket + conflict resolution)  
**Week 5:** Payment integration (Stripe + webhooks)  
**Week 6:** Production polish (animations + error handling)  
**Week 7:** Testing strategy (E2E + critical paths)  
**Week 8:** Deployment & monitoring (Vercel + Sentry)

**Total:** You'll go from "I can build a React app" to "I can ship a production SaaS product."

---

## 🚀 The Only Metric That Matters

**Success = Recruiter says "When can you start?"**

**Not:**
- ❌ "Impressive for a junior"
- ❌ "Nice tutorial project"
- ❌ "Have you built anything production?"

**But:**
- ✅ "This looks production-ready"
- ✅ "How did you handle [complex problem]?"
- ✅ "We'd love to have you on the team"

---

## 🎓 One Last Thing

**This blueprint is realistic.**

It won't take 3 weeks. It won't be perfect. You'll hit roadblocks.

**But here's what you'll have at the end:**

- A working SaaS app deployed to production
- The knowledge to build the next one faster
- A portfolio piece worth £35k-45k salary
- Confidence to interview at top companies

**And that's what actually matters.**

---

## 📞 When You Get Stuck

**You WILL get stuck. Here's what to do:**

**Stuck for 30 minutes?**
- Search the error on Google
- Check the library documentation
- Ask ChatGPT with the full error message

**Stuck for 2 hours?**
- Post on the Next.js Discord
- Ask on Stack Overflow
- Check GitHub issues for the library

**Stuck for 1 day?**
- Simplify the feature
- Build a simpler version first
- Skip it and come back later

**Feeling overwhelmed?**
- Go back to Week 1
- Make ONE thing work perfectly
- Remember: every senior was once stuck on `useState`

---

## 🏆 Your Next Steps

**Right Now:**
1. Star this repository
2. Setup your development environment
3. Create a GitHub repo for your project

**This Week:**
1. Setup Next.js + Supabase
2. Get a card to display on screen
3. Make drag-and-drop work (mouse only)

**Next Week:**
1. Add Clerk authentication
2. Add Guest demo mode
3. Test on mobile

**8 Weeks From Now:**
1. Launch on Twitter/LinkedIn
2. Add to your resume
3. Start applying to jobs

---

**Now go build something that gets you hired. 🚀**


