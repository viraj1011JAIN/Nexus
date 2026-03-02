# NEXUS — GitHub Copilot Instructions
# Model: Claude Opus 4.6

> Place this file at `.github/copilot-instructions.md` in the root of the repository.
> GitHub Copilot will automatically load it as workspace context for every suggestion.

---

## 1. Project Identity

NEXUS is a **production-grade, multi-tenant project management SaaS platform** — a self-hostable
alternative to Trello / Jira — built as a senior-level portfolio project targeting UK developer
roles at £40 000+. Every architectural decision, naming convention, and code pattern must reflect
**principal-engineer quality**: earned complexity, zero shortcuts, and documentation depth that
impresses technical reviewers on first read.

---

## 2. Technology Stack — Non-Negotiable Versions

| Layer            | Library / Tool                     | Version   |
|------------------|------------------------------------|-----------|
| Framework        | Next.js (App Router)               | 16.1.4    |
| Runtime          | React                              | 19.2.3    |
| Language         | TypeScript (strict mode)           | 5         |
| ORM              | Prisma                             | 5.22+     |
| Auth             | Clerk (`@clerk/nextjs`)            | 6.36+     |
| Payments         | Stripe SDK                         | v20       |
| Real-time        | Supabase Realtime                  | 2.91+     |
| Styling          | Tailwind CSS                       | v4        |
| UI primitives    | shadcn/ui (Radix UI)               | latest    |
| Drag & Drop      | @dnd-kit                           | 6.3+      |
| Ordering         | LexoRank (custom `lib/lexorank.ts`)| —         |
| State            | Zustand                            | 5.0+      |
| Rich text        | TipTap                             | 3.17+     |
| Charts           | Recharts                           | 3.7+      |
| Animations       | Framer Motion                      | 12.29+    |
| Validation       | Zod                                | 4.3+      |
| Email            | Resend                             | 6.9+      |
| AI               | OpenAI SDK                         | 4.104+    |
| Error tracking   | Sentry                             | 10.36+    |
| Testing          | Jest 30 + ts-jest + Playwright 1.58|           |
| Deployment       | Vercel (edge network)              |           |

**Never suggest downgrading, replacing, or adding libraries outside this stack without explicitly
flagging the deviation and justifying it.**

---

## 3. Absolute Architectural Rules

### 3.1 Multi-Tenant Isolation — CRITICAL

```typescript
// ✅ CORRECT — orgId always from the signed Clerk JWT
import { getTenantContext } from '@/lib/tenant-context';
const { userId, orgId, role } = await getTenantContext();

// ❌ NEVER — orgId from client input
const orgId = params.orgId;          // forbidden
const orgId = searchParams.get('org'); // forbidden
const orgId = body.orgId;            // forbidden
```

- `orgId` is **only** read from `auth()` → Clerk JWT claims.
- Every Prisma query **must** include `where: { orgId }` even when the item's ID is globally unique.
- The Prisma session variable `app.current_org_id` is set per-connection for RLS — never bypass it
  except through the explicit `systemDb` client (`lib/db.ts`).

### 3.2 Dual-Gate RBAC

Access to any board resource requires **both** gates to pass:

1. **Gate 1** — active `OrganizationUser` row (not `SUSPENDED`, not `PENDING`).
2. **Gate 2** — explicit `BoardMember` row with the required `BoardRole`.

An org `OWNER` without a `BoardMember` row has **zero board access**. Never infer board
permissions from org role alone.

### 3.3 Server Action Pattern (`createSafeAction`)

Every mutation **must** follow this exact pipeline:

```typescript
// actions/your-action.ts
import { z } from 'zod';
import { createSafeAction } from '@/lib/create-safe-action';
import { getTenantContext } from '@/lib/tenant-context';
import { checkPermission } from '@/lib/board-permissions';
import { createAuditLog } from '@/lib/create-audit-log';
import { emitCardEvent } from '@/lib/event-bus';

const InputSchema = z.object({
  boardId: z.string().cuid(),
  title:   z.string().min(1).max(255),
});

const handler = createSafeAction(InputSchema, async (input) => {
  // 1. Auth + tenant
  const { userId, orgId } = await getTenantContext();

  // 2. Permission check
  await checkPermission(userId, input.boardId, 'CREATE_CARD');

  // 3. DB mutation — always scoped to orgId
  const card = await db.card.create({
    data: { ...input, orgId, createdById: userId },
  });

  // 4. Audit log — never skip
  await createAuditLog({
    orgId, userId, action: 'CARD_CREATED',
    entityType: 'CARD', entityId: card.id, entityTitle: card.title,
  });

  // 5. Event bus — automations + webhooks
  await emitCardEvent('CARD_CREATED', card, orgId);

  return { data: card };
});

export const createCard = handler;
```

Never put business logic in API route handlers when a Server Action suffices.

### 3.4 Supabase — Real-Time Only

```typescript
// ✅ Supabase is ONLY for WebSocket / Realtime
const channel = supabase.channel(`org:${orgId}:board:${boardId}`);

// ❌ Never use Supabase client for DB reads or writes
const { data } = await supabase.from('Card').select('*'); // forbidden
```

All reads and writes go through Prisma. Supabase's `postgres_changes` broadcasts are the event
source that other clients subscribe to — they must never be the write path.

### 3.5 LexoRank Ordering

```typescript
import { generateMidpointOrder, generateNextOrder, rebalanceOrders } from '@/lib/lexorank';

// Moving a card: only ONE row updated, regardless of list length
await db.card.update({ where: { id }, data: { order: newLexoRank } });

// ❌ Never use integer positions — they require O(n) updates
await db.card.updateMany({ where: { order: { gte: position } }, data: { order: { increment: 1 } } });
```

---

## 4. TypeScript Rules

- **Strict mode is always on** — zero `any`, zero `@ts-ignore`, zero `as unknown as X`.
- All Prisma query results must be typed via generated Prisma types, not hand-rolled interfaces.
- Zod schemas are the single source of truth for input shapes — derive TypeScript types from them:
  ```typescript
  type Input = z.infer<typeof InputSchema>;
  ```
- All Server Actions return `{ data: T } | { error: string }` — never throw to the client.
- React Server Components props must be fully typed — no implicit `any` from `params` or
  `searchParams`.
- Use `satisfies` over `as` wherever possible.

---

## 5. React / Next.js Patterns

### 5.1 Server vs. Client Split

| Always Server Component                     | Always Client Component                |
|---------------------------------------------|----------------------------------------|
| Page shells, layouts, data-fetching wrappers| Drag-and-drop (`@dnd-kit`)             |
| Settings pages, billing page                | Supabase Realtime subscriptions        |
| Board page shell (initial render)           | Modals, command palette, toast         |
| Auth pages (Clerk managed)                  | Presence indicators, card edit lock    |

Add `'use client'` only when the component requires browser APIs, event handlers, or hooks that
depend on client state. Never add it to a parent just to "fix" a child — extract the interactive
part into a separate file.

### 5.2 React Compiler

`babel-plugin-react-compiler` is enabled. **Do not** add `useMemo`, `useCallback`, or `memo()`
manually — the compiler handles all memoisation. Adding them will conflict and create stale
closures.

### 5.3 Optimistic Updates

```typescript
// Use React's useOptimistic for instant UI feedback
const [optimisticCards, addOptimistic] = useOptimistic(cards, (state, newCard) => [...state, newCard]);
```

Always pair with a server action that confirms asynchronously. On failure, the original state
is automatically restored — do not manually implement rollback.

### 5.4 `cache()` Deduplication

Wrap expensive data-fetching functions with React's `cache()`:

```typescript
import { cache } from 'react';
export const getTenantContext = cache(async () => { ... });
```

This ensures a maximum of one DB call per request regardless of how many components call the
same function in the same render tree.

---

## 6. Tailwind CSS Rules — Hydration Safety

Tailwind v4 introduces shorthand utilities that are **not** in the pre-generated stylesheet and
cause hydration mismatches between SSR and CSR. Always use explicit bracket syntax:

```tsx
// ✅ Correct — bracket syntax, hydration-safe
<div className="gap-[5px] h-[30px] bg-gradient-to-br from-purple-600 to-indigo-700 p-[12px]" />

// ❌ Wrong — Tailwind v4 shorthands break hydration
<div className="bg-linear-to-br gap-5px h-30px" />
```

Never use `bg-linear-to-*` — always `bg-gradient-to-*`. Never use non-standard spacing tokens
without brackets.

Dark mode is class-based (`dark:` prefix). Do not use CSS variables for theme switching — use
Tailwind `dark:` variants throughout.

---

## 7. Database / Prisma Rules

### 7.1 Schema Conventions

- All primary keys are CUID strings — `@default(cuid())`. Never use auto-increment integers.
- All timestamps: `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt`.
- `orgId` is always a non-nullable field on every tenant-scoped model.
- JSON columns (`Json`) for: automation triggers/conditions/actions, webhook payloads, audit
  log before/after snapshots. Do not create extra tables for shape variations.
- Cascade deletes: Board → List → Card → (Comments, Attachments, Checklists, etc.).
  Organization deletion is intentionally NOT cascaded — always guard with a confirmation.

### 7.2 Connection Clients

```typescript
import { db, systemDb } from '@/lib/db';

// db       → PgBouncer port 6543, RLS enforced, all app queries
// systemDb → direct port 5432, RLS bypassed, ONLY for Stripe webhooks / cron jobs
```

Never use `systemDb` in a path that accepts user-controlled input.

### 7.3 Query Patterns

```typescript
// Always include orgId in WHERE — even for globally unique IDs
const board = await db.board.findUnique({
  where: { id: boardId, orgId }, // orgId scope is mandatory
});
if (!board) throw new Error('Board not found');

// Select only what you need — never select *
const cards = await db.card.findMany({
  where: { listId, list: { board: { orgId } } },
  select: { id: true, title: true, order: true, priority: true, dueDate: true },
});
```

---

## 8. Security Patterns

### 8.1 Rate Limiting

```typescript
import { checkRateLimit } from '@/lib/action-protection';

// In every Server Action that mutates data
const { allowed, retryAfter } = await checkRateLimit(userId, 'CREATE_CARD');
if (!allowed) return { error: `Rate limited. Retry in ${retryAfter}s` };
```

### 8.2 Webhook Security

Inbound (Stripe): always verify `stripe-signature` before processing.
Outbound (user webhooks): always sign with HMAC-SHA256 using the per-webhook secret from
`lib/webhook-delivery.ts`. Validate URLs against the SSRF blocklist before sending.

### 8.3 API Key Authentication

```typescript
import { authenticateApiKey } from '@/lib/api-key-auth';

// In every /api/v1/* route
const { orgId, scopes } = await authenticateApiKey(request, 'boards:read');
```

Keys are stored as SHA-256 hashes — never log or return the plaintext key after creation.
Prefix all keys with `nxk_`.

### 8.4 Input Sanitization

AI-generated content and user rich text must be sanitized before rendering:

```typescript
import DOMPurify from 'dompurify';

const SAFE_TAGS = ['h1','h2','h3','p','br','b','i','strong','em','ul','ol','li','a','code','pre'];
const clean = DOMPurify.sanitize(aiContent, { ALLOWED_TAGS: SAFE_TAGS, ALLOWED_ATTR: ['href','rel','class'] });
```

Never render `dangerouslySetInnerHTML` without DOMPurify — especially for AI-generated or
user-submitted content stored in `Card.description`.

### 8.5 Realtime Channel Isolation

```typescript
import { buildBoardChannel } from '@/lib/realtime-channels';

// Always use the validated builder — never concatenate orgId manually
const channel = buildBoardChannel(orgId, boardId); // validates no ':' in orgId
```

---

## 9. Audit Logging — Never Skip

Every mutation that changes user-visible data **must** call `createAuditLog()`:

```typescript
await createAuditLog({
  orgId,
  userId,
  boardId,            // optional — omit for org-level actions
  action: 'CARD_UPDATED',
  entityType: 'CARD',
  entityId: card.id,
  entityTitle: card.title,
  previousValues: { title: oldTitle },
  newValues:      { title: newTitle },
});
```

`previousValues` and `newValues` should include only the fields that changed — not the entire
record. Failures are reported to Sentry via `lib/logger.ts` — never silently swallowed.

---

## 10. Error Handling

```typescript
// Server Actions — return user-safe error messages, never leak internals
try {
  const result = await db.board.create({ data });
  return { data: result };
} catch (error) {
  logger.error('Failed to create board', { error, userId, orgId });
  return { error: 'Failed to create board. Please try again.' };
}

// TenantError — always map to generic messages before returning to client
import { TenantError } from '@/lib/tenant-context';
if (error instanceof TenantError) return { error: 'Access denied.' };
```

Never expose internal error messages, Prisma error codes, stack traces, or entity IDs in
client-facing error strings.

---

## 11. Testing Conventions

### 11.1 What to Test (in priority order)

1. Security & auth — `tenant-context`, `action-protection`, `api-key-auth`, RBAC matrix
2. Billing — Stripe webhook handlers, checkout session creation, plan sync
3. Core algorithms — `lexorank` (insertions, midpoints, rebalancing)
4. Critical Server Actions — card CRUD, drag ordering, permission scheme mutations
5. Zod schemas — valid and invalid inputs for every action schema

**Do not** write tests for shadcn/ui wrappers, pure layout components, or anything that
only tests that React renders a `<div>`. Coverage metrics are secondary to test quality.

### 11.2 Test Structure

```typescript
// __tests__/unit/feature/feature-name.test.ts
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock Prisma at the module level — never hit a real DB in unit tests
jest.mock('@/lib/db', () => ({
  db: { card: { create: jest.fn(), findUnique: jest.fn() } },
}));

describe('createCard action', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects requests from suspended users', async () => {
    // Arrange, Act, Assert pattern
  });
});
```

E2E tests (`e2e/*.spec.ts`) use Playwright and require a running dev server. Always test
tenant isolation with two distinct user accounts and two orgs.

---

## 12. Component Architecture

### 12.1 File Naming

```
components/
  board/          PascalCase.tsx         (board-specific UI)
  modals/         PascalCase.tsx         (modal shells and sub-panels)
  ui/             kebab-case.tsx         (shadcn primitives — do not modify)
  layout/         PascalCase.tsx         (sidebar, nav, notification center)
  editor/         PascalCase.tsx         (TipTap wrappers)
  analytics/      PascalCase.tsx         (Recharts dashboards)

hooks/            use-kebab-case.ts      (all custom hooks)
lib/              kebab-case.ts          (utilities, clients, engines)
actions/          kebab-case.ts          (Server Actions — one concern per file)
```

### 12.2 Prop Interfaces

```typescript
// Always define props with interface, not type alias, for components
interface CardItemProps {
  card: Pick<Card, 'id' | 'title' | 'order' | 'priority' | 'dueDate'>;
  boardId: string;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}
```

Use `Pick<>` and `Partial<>` generics from Prisma-generated types rather than duplicating
field definitions.

### 12.3 Zustand Store Pattern

```typescript
// Only for UI state — NOT for server data
import { create } from 'zustand';

interface CardModalStore {
  isOpen: boolean;
  cardId: string | null;
  onOpen:  (cardId: string) => void;
  onClose: () => void;
}

export const useCardModal = create<CardModalStore>((set) => ({
  isOpen: false,
  cardId: null,
  onOpen:  (cardId) => set({ isOpen: true, cardId }),
  onClose: () => set({ isOpen: false, cardId: null }),
}));
```

Server data (boards, cards, members) lives in RSC props or SWR/TanStack Query — not Zustand.

---

## 13. Design System

### 13.1 Visual Identity

- **Dark mode default**: deep indigo-charcoal `#0D0C14` with purple-tinted glows.
- **Light mode**: warm off-white `#F4F1ED` with soft shadows.
- **Accent gradient**: `from-purple-600 to-indigo-700` (primary CTAs, active states).
- **Priority colours**: Urgent = `red-500`, High = `orange-400`, Medium = `cyan-400`, Low = `green-400`.
- **Typography**: Playfair Display (headings) + DM Sans (body/UI).

### 13.2 Motion

Use Framer Motion for micro-interactions. Keep `duration` between `0.15s` and `0.3s`. Respect
`prefers-reduced-motion` via:

```tsx
import { motion, useReducedMotion } from 'framer-motion';
const shouldReduce = useReducedMotion();
```

---

## 14. Performance — Non-Negotiable

- **Virtual scrolling** via `components/virtual-scroll.tsx` for any list exceeding 50 items.
- **Lazy loading** via `components/lazy-load.tsx` (Intersection Observer) for below-fold panels.
- **`optimizePackageImports`** in `next.config.ts` for: `lucide-react`, `framer-motion`,
  `@tiptap/*`, `@radix-ui/*`, `@dnd-kit/*`, `recharts`.
- **Image optimization**: always use `next/image` with AVIF/WebP formats. Never raw `<img>`.
- **Bundle guard**: run `npm run analyze` before any PR that adds a new library.

---

## 15. Environment Variables

When generating code that needs env vars, reference only the names defined in `.env.example`:

```
DATABASE_URL, DIRECT_URL
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_SIGN_IN_URL, NEXT_PUBLIC_CLERK_SIGN_UP_URL
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL, NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID, STRIPE_PRO_MONTHLY_PRICE_ID, STRIPE_PRO_YEARLY_PRICE_ID
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
CRON_SECRET
```

Never hardcode any secret. Never suggest `process.env` access in a Client Component — prefix
with `NEXT_PUBLIC_` or move to a Server Action / API route.

---

## 16. Commit & PR Conventions

```
feat:     New feature
fix:      Bug fix
chore:    Maintenance, dependency updates
docs:     Documentation only
test:     Adding or updating tests
refactor: Code restructuring, no behaviour change
perf:     Performance improvement
security: Security fix or hardening
```

Scope in parentheses when helpful: `feat(cards): add bulk priority update action`

---

## 17. What Copilot Should NOT Do

- ❌ Suggest `middleware.ts` for auth — auth is enforced at the action/route level.
- ❌ Accept `orgId` from request params, body, or URL segments.
- ❌ Use Supabase client for any database read or write.
- ❌ Add `useMemo` / `useCallback` / `memo()` — React Compiler handles this.
- ❌ Use integer ordering for cards or lists — always LexoRank.
- ❌ Use `@ts-ignore`, `any`, or `as unknown as X`.
- ❌ Use Tailwind v4-only shorthand utilities without bracket syntax.
- ❌ Render AI-generated or user-supplied HTML without DOMPurify sanitisation.
- ❌ Log or return internal error details, stack traces, or Prisma codes to the client.
- ❌ Call `systemDb` from any path that handles user-controlled input.
- ❌ Skip `createAuditLog()` on any mutation that changes user-visible data.

---

## 18. Quick Reference — Key File Locations

| Concern                   | File                                        |
|---------------------------|---------------------------------------------|
| Multi-tenant auth          | `lib/tenant-context.ts`                     |
| RBAC permission matrix     | `lib/board-permissions.ts`                  |
| Server Action wrapper      | `lib/create-safe-action.ts`                 |
| Audit logging              | `lib/create-audit-log.ts`                   |
| LexoRank ordering          | `lib/lexorank.ts`                           |
| Stripe client + config     | `lib/stripe.ts`                             |
| Supabase client factory    | `lib/supabase/client.ts`                    |
| Realtime channel builder   | `lib/realtime-channels.ts`                  |
| API key authentication     | `lib/api-key-auth.ts`                       |
| Rate limiting              | `lib/action-protection.ts`                  |
| Automation engine          | `lib/automation-engine.ts`                  |
| Webhook delivery + SSRF    | `lib/webhook-delivery.ts`                   |
| Event bus                  | `lib/event-bus.ts`                          |
| Prisma clients (db/system) | `lib/db.ts`                                 |
| Structured logger + Sentry | `lib/logger.ts`                             |
| Zod schemas (actions)      | `actions/schema.ts`                         |
| Card modal state (Zustand) | `hooks/use-card-modal.ts`                   |

---

*This file is the single source of truth for all Copilot suggestions in the NEXUS codebase.
When in doubt, choose the pattern that is already established in the files above — consistency
over cleverness.*
