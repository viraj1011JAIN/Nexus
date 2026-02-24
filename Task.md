# NEXUS — Complete Product Roadmap
# Principal Engineer Level: Ship a World-Class Product

**Target:** Jira + Linear + Trello quality in one platform  
**Stack:** Next.js 16 · Clerk · Prisma · PostgreSQL · Supabase · Stripe · Vercel  
**Principle:** Every feature ships production-ready or not at all. No stubs. No "coming soon."

---

## HOW TO READ THIS DOCUMENT

Each task contains:
- **What** — exact feature definition
- **Why** — the user/product value
- **Schema** — Prisma model changes required
- **Implementation** — files to create/change, step by step
- **Acceptance** — what "done" means, testable criteria
- **Priority** — P0 (ship-blocker), P1 (core product), P2 (differentiator), P3 (polish)

Tasks are ordered by dependency chain, not priority. Build foundations first.

---

## PHASE 0 — QUICK WINS (Do These First, < 1 Day Total)

---

### TASK-001 · PWA Icons
**Priority:** P0 | **Effort:** 30 min

**What:** Add the two missing PNG icons that `manifest.json` references. Without them, Chrome DevTools shows a PWA install error and Android install produces a broken icon.

**Implementation:**
1. Go to [realfavicongenerator.net](https://realfavicongenerator.net), upload your NEXUS logo (square SVG preferred)
2. Download the package, extract `android-chrome-192x192.png` and `android-chrome-512x512.png`
3. Rename to `icon-192.png` and `icon-512.png`, place in `/public/`
4. Update `manifest.json`:
```json
{
  "name": "NEXUS",
  "short_name": "NEXUS",
  "description": "Team task management",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#0f0f0f",
  "theme_color": "#7c3aed",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ],
  "shortcuts": [
    { "name": "Dashboard", "url": "/dashboard", "icons": [{ "src": "/icon-192.png", "sizes": "192x192" }] },
    { "name": "New Board", "url": "/dashboard?new=true", "icons": [{ "src": "/icon-192.png", "sizes": "192x192" }] }
  ]
}
```
5. Add to `app/layout.tsx` metadata:
```tsx
export const metadata: Metadata = {
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "NEXUS" },
  icons: {
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    icon: [{ url: "/icon-192.png" }, { url: "/icon-512.png" }],
  },
};
```

**Acceptance:** Chrome DevTools → Application → Manifest shows zero errors. "Add to Home Screen" produces a correct NEXUS icon.

---

### TASK-002 · GitHub Actions CI/CD
**Priority:** P0 | **Effort:** 45 min

**What:** Automated pipeline that runs on every push and PR: TypeScript check → ESLint → Jest → Next.js build. Blocks merges to `main` if any step fails.

**Implementation:**

Create `.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  typecheck:
    name: TypeScript
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx tsc --noEmit

  lint:
    name: ESLint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx eslint . --max-warnings 0

  test:
    name: Jest
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx jest --coverage --ci
      - uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [typecheck, lint, test]
    env:
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY }}
      CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
      NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
      STRIPE_API_KEY: ${{ secrets.STRIPE_API_KEY }}
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run build
```

Create `.github/workflows/preview.yml` for Vercel preview deployments:
```yaml
name: Preview Deployment
on:
  pull_request:
    types: [opened, synchronize]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

Add secrets in GitHub → Settings → Secrets. Enable branch protection rule on `main`: require CI to pass before merge.

**Acceptance:** A PR with a TypeScript error fails CI and cannot be merged. A clean PR shows green checks and a Vercel preview URL in the PR comment.

---

### TASK-003 · Board Backgrounds — Render + Unsplash Picker
**Priority:** P0 | **Effort:** 4 hours

**What:** The schema has 5 image fields fully designed. `createBoard` accepts `title` only. Board cards in the dashboard look blank. Board pages have no hero image. This is the most visually noticeable gap.

**Implementation — Part A: Render existing images (1 hour):**

In `components/board-list.tsx`, update each board card to render `imageThumbUrl`:
```tsx
<div className="relative h-32 rounded-t-lg overflow-hidden bg-gradient-to-br from-violet-600 to-purple-800">
  {board.imageThumbUrl && (
    <Image
      src={board.imageThumbUrl}
      alt={board.title}
      fill
      className="object-cover"
      sizes="(max-width: 768px) 100vw, 33vw"
    />
  )}
  <div className="absolute inset-0 bg-black/30" />
  <h3 className="absolute bottom-3 left-3 text-white font-semibold text-sm">{board.title}</h3>
</div>
```

In `app/board/[boardId]/page.tsx`, render `imageFullUrl` as the board header background.

**Implementation — Part B: Unsplash picker (3 hours):**

1. Register at unsplash.com/developers, get access key. Add `UNSPLASH_ACCESS_KEY` to `.env`.

2. Create `/app/api/unsplash/route.ts`:
```typescript
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query") ?? "productivity workspace";
  const page = searchParams.get("page") ?? "1";
  
  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${query}&page=${page}&per_page=12&orientation=landscape`,
    {
      headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` },
      next: { revalidate: 3600 }, // Cache for 1 hour
    }
  );
  
  if (!res.ok) return Response.json({ results: [] });
  const data = await res.json();
  return Response.json(data);
}
```

3. Create `components/board-image-picker.tsx` — a modal step in board creation with:
   - Search input with debounce
   - 12-image grid of thumbnails
   - Selected state with checkmark overlay
   - Pagination (Load more)
   - Attribution text per Unsplash license terms
   - Fallback gradient color picker (6 options) if Unsplash API unavailable

4. Update `CreateBoardSchema` in `actions/schema.ts`:
```typescript
export const CreateBoardSchema = z.object({
  title: z.string().min(1).max(50),
  imageId: z.string().optional(),
  imageThumbUrl: z.string().url().optional(),
  imageFullUrl: z.string().url().optional(),
  imageUserName: z.string().optional(),
  imageLinkHTML: z.string().optional(),
});
```

5. Update `actions/create-board.ts` to pass all 5 image fields to `dal.boards.create()`.

6. Render the Unsplash attribution link `imageLinkHTML` in the board header (required by Unsplash license).

**Acceptance:** Creating a board shows an image picker. Selected board has a thumbnail on the dashboard card and a full hero image on the board page. Attribution link renders correctly.

---

## PHASE 1 — CORE MISSING FEATURES (1–2 Weeks)

---

### TASK-004 · Security-Critical Test Suite
**Priority:** P1 | **Effort:** 6 hours

**What:** Tests for the two most important functions in the codebase: `getTenantContext` and `checkRateLimit`. These are untested at 0.75% statement coverage. This is the biggest credibility gap for a senior role.

**Implementation:**

Create `__tests__/unit/tenant-context.test.ts` — test these exact scenarios:
- Throws `UNAUTHENTICATED` when `userId` is null
- Throws `UNAUTHENTICATED` when `orgId` is null (user has no active org)
- Throws `FORBIDDEN` when `membership.isActive === false`
- Returns full `TenantContext` for valid active member
- Creates `User` row on first login (self-healing path)
- Creates `OrganizationUser` row on first org join (self-healing path)
- Race condition: concurrent first requests don't throw on the re-fetch path

Create `__tests__/unit/rate-limit.test.ts` — test:
- Allows requests within limit, returns correct `remaining` count
- Blocks at exactly the limit (not limit-1, not limit+1)
- Returns `allowed: false` and `remaining: 0` when blocked
- Resets correctly after 60-second window (use `jest.useFakeTimers()`)
- Isolates per-user (User A exhausted does not affect User B)
- Isolates per-action (create-card exhausted does not affect create-list)
- The 22 named limits all resolve without throwing

Create `__tests__/unit/dal.test.ts` — test:
- `dal.boards.findMany()` never returns boards from another org
- `dal.boards.findUnique()` throws `NOT_FOUND` for a board from another org
- `dal.cards.delete()` throws `NOT_FOUND` for a card from another org
- Reorder validates IDs against DB whitelist (injected foreign IDs rejected)
- Labels: `assign()` verifies both card and label belong to same org

**Acceptance:** `npx jest --coverage` shows `lib/tenant-context.ts`, `lib/action-protection.ts`, and `lib/dal.ts` each with >80% statement coverage. All 34 + new tests green.

---

### TASK-005 · E2E Tests with Playwright
**Priority:** P1 | **Effort:** 1 day

**What:** Three critical user journey tests. Not "does the button render" — behavioral end-to-end flows.

**Implementation:**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

Create `playwright.config.ts`:
```typescript
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // Auth state must be sequential
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
```

Create `e2e/auth.setup.ts` — signs in as test user, saves auth state to `playwright/.auth/user.json`.

**Flow 1** — `e2e/board-lifecycle.spec.ts`:
```
Sign in → dashboard loads →
Create board "E2E Test Board" → board card appears →
Navigate to board → create list "To Do" → create card "Test Card" →
Open card modal → set priority URGENT → add description → close →
Drag card to new list "Done" → verify LexoRank order persisted via API →
Delete card → delete board → assert dashboard is empty
```

**Flow 2** — `e2e/real-time.spec.ts` (two browser contexts):
```
User A signs in → opens board →
User B signs in (same org, same board) in second context →
User B creates card → User A sees card appear without refresh →
User A opens card modal → User B sees "locked by [User A]" banner →
User A closes modal → lock released
```

**Flow 3** — `e2e/tenant-isolation.spec.ts` (the most important test):
```
User A (Org A) signs in → creates board → note boardId →
Sign out → User B (Org B) signs in →
Navigate to /board/{orgABoardId} →
Assert: redirected to /dashboard or receives 404, NOT the board content →
Assert: no cards, lists, or org A data visible anywhere
```

Add to `.github/workflows/ci.yml`:
```yaml
e2e:
  name: E2E Tests
  runs-on: ubuntu-latest
  needs: [build]
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: 20, cache: npm }
    - run: npm ci
    - run: npx playwright install --with-deps chromium
    - run: npx playwright test
    - uses: actions/upload-artifact@v4
      if: failure()
      with:
        name: playwright-report
        path: playwright-report/
```

**Acceptance:** 3 flows pass in CI. Tenant isolation test fails if the security system is broken — it's the canary.

---

### TASK-006 · @Mention UI + In-App Notifications
**Priority:** P1 | **Effort:** 8 hours

**What:** `@tiptap/extension-mention` is installed. `mentions String[]` exists on `Comment`. Nothing is wired. Users can't @mention teammates. No notification center exists anywhere in the app.

**Schema additions:**
```prisma
model Notification {
  id          String           @id @default(cuid())
  orgId       String
  userId      String           // recipient
  type        NotificationType
  title       String
  body        String?
  entityType  String?          // CARD | BOARD | COMMENT
  entityId    String?
  entityTitle String?
  actorId     String           // who triggered it
  actorName   String
  actorImage  String?
  isRead      Boolean          @default(false)
  createdAt   DateTime         @default(now())

  organization Organization @relation(fields: [orgId], references: [id])
  user         User         @relation("NotificationRecipient", fields: [userId], references: [id])
  actor        User         @relation("NotificationActor", fields: [actorId], references: [id])

  @@index([userId, isRead, createdAt])
  @@index([orgId])
}

enum NotificationType {
  MENTIONED
  ASSIGNED
  CARD_DUE_SOON
  CARD_OVERDUE
  COMMENT_ON_ASSIGNED_CARD
  BOARD_SHARED
}
```

**Implementation:**

1. **MentionList component** (`components/mention-list.tsx`): Floating dropdown triggered by `@` in TipTap. Shows org member avatars + names filtered by typed query. Keyboard navigable (arrow keys + enter). Max 5 results.

2. **Configure Mention extension** in `components/rich-text-editor.tsx`:
```typescript
Mention.configure({
  HTMLAttributes: { class: "mention bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded px-1 font-medium" },
  suggestion: {
    items: async ({ query }) => {
      const members = await getOrganizationMembers();
      return members.filter(m => m.name.toLowerCase().includes(query.toLowerCase())).slice(0, 5);
    },
    render: () => {
      let component: ReactRenderer;
      let popup: ReturnType<typeof tippy>;
      return {
        onStart: (props) => { component = new ReactRenderer(MentionList, { props, editor: props.editor }); /* tippy setup */ },
        onUpdate: (props) => component.updateProps(props),
        onExit: () => { popup?.[0]?.destroy(); component?.destroy(); },
        onKeyDown: ({ event }) => component.ref?.onKeyDown(event),
      };
    },
  },
})
```

3. **createNotification action** (`actions/notification-actions.ts`): Called after `createComment` when mentions exist. Parses TipTap output for mention node attrs, creates one `Notification` row per mentioned user.

4. **Notification center** (`components/layout/notification-center.tsx`): Bell icon in sidebar with unread count badge. Popover showing last 20 notifications. Mark as read on click. "Mark all read" button. Links to the card/entity.

5. **Real-time delivery**: Subscribe to `org:{orgId}:notifications:{userId}` Supabase channel. On new notification row insert, trigger toast + increment badge without refresh.

6. **Notification actions**: `getNotifications()`, `markAsRead(id)`, `markAllRead()` — all tenant-scoped via DAL.

**Acceptance:** Typing `@` in comment editor shows member dropdown. Submitting comment with @mention creates notification row. Bell badge increments in real-time. Clicking notification navigates to the card.

---

### TASK-007 · Email Delivery (Resend + React Email)
**Priority:** P1 | **Effort:** 6 hours

**What:** Cron generates data. No email is sent. Notification preferences exist. No delivery mechanism.

**Implementation:**

```bash
npm install resend @react-email/components @react-email/render
```

Add `RESEND_API_KEY` and `EMAIL_FROM` to env vars.

Create `lib/email.ts`:
```typescript
import { Resend } from "resend";
export const resend = new Resend(process.env.RESEND_API_KEY);
export const FROM = process.env.EMAIL_FROM ?? "NEXUS <noreply@your-domain.com>";
```

Create email templates in `emails/` directory as React components:

- `emails/mention.tsx` — "@username mentioned you in [card title]" with card preview
- `emails/assigned.tsx` — "You were assigned to [card title]"  
- `emails/due-soon.tsx` — "3 cards due tomorrow" digest format
- `emails/daily-digest.tsx` — Daily report with org activity summary
- `emails/board-invite.tsx` — Invitation to join NEXUS org

Each template: NEXUS branding, clear CTA button, unsubscribe link, plain text fallback.

Update `actions/notification-actions.ts`: After creating `Notification` row, check recipient's `UserPreference.emailNotifications`. If enabled, send via `resend.emails.send()`. Fire-and-forget — don't await in the server action (use background job pattern via Vercel's `waitUntil` or a queue).

Update `/api/cron/daily-reports/route.ts`: Actually send the daily digest email using `emails/daily-digest.tsx`.

Create `actions/email-actions.ts`: `sendBoardInvite()` — sends invite email when an admin adds a member to the org before they've joined.

**Acceptance:** Mentioning a user sends an email within 30 seconds. Daily cron at 09:00 UTC sends digest. Email renders correctly in Gmail, Outlook, Apple Mail (test via Resend's preview).

---

### TASK-008 · File Attachments
**Priority:** P1 | **Effort:** 1 day

**What:** Cards have no attachment capability. This is a baseline feature of every task management tool. Users need to upload screenshots, specs, designs to cards.

**Schema:**
```prisma
model Attachment {
  id         String   @id @default(cuid())
  cardId     String
  uploadedBy String
  name       String
  url        String
  size       Int      // bytes
  mimeType   String
  createdAt  DateTime @default(now())

  card Card @relation(fields: [cardId], references: [id], onDelete: Cascade)
  user User @relation(fields: [uploadedBy], references: [id])

  @@index([cardId])
}
```

**Implementation:**

1. **Storage:** Enable Supabase Storage. Create bucket `nexus-attachments` with RLS policy: files in `{orgId}/` prefix readable only by org members.

2. **Upload action** (`actions/attachment-actions.ts`):
```typescript
export async function uploadAttachment(cardId: string, file: File) {
  const ctx = await getTenantContext();
  await requireRole("MEMBER", ctx);
  const dal = createDAL(ctx);
  await dal.cards.findUnique(cardId); // ownership check
  
  const path = `${ctx.orgId}/${cardId}/${Date.now()}-${file.name}`;
  const { data, error } = await supabase.storage
    .from("nexus-attachments")
    .upload(path, file, { contentType: file.type });
  
  const url = supabase.storage.from("nexus-attachments").getPublicUrl(path).data.publicUrl;
  return dal.attachments.create({ cardId, name: file.name, url, size: file.size, mimeType: file.type });
}
```

3. **Attachments tab** in card modal (`modals/card-modal/attachments.tsx`):
   - Drag-and-drop upload zone (react-dropzone)
   - File type icons (image, PDF, doc, etc.)
   - Image preview thumbnails (lightbox on click)
   - File size display
   - Delete button (owner or ADMIN only)
   - Progress bar during upload

4. **Limits:** FREE plan = 10 attachments per card, 100MB total per org. PRO = unlimited. Enforce in upload action.

5. **Security:** Never expose Supabase service key client-side. All uploads go through the server action which constructs the path with `orgId` prefix. RLS on the bucket enforces org isolation.

**Acceptance:** Dragging a PNG onto the attachments tab uploads it, shows thumbnail, persists across page refresh. PDF shows as file icon. Deleting removes from both DB and storage. A user from another org cannot access the URL.

---

### TASK-009 · Card Checklists
**Priority:** P1 | **Effort:** 8 hours

**What:** Checklists are a core Trello/Jira feature. Breaking a card into subtasks with progress tracking.

**Schema:**
```prisma
model Checklist {
  id        String          @id @default(cuid())
  cardId    String
  title     String          @default("Checklist")
  order     String          // LexoRank
  items     ChecklistItem[]
  createdAt DateTime        @default(now())

  card Card @relation(fields: [cardId], references: [id], onDelete: Cascade)
}

model ChecklistItem {
  id          String    @id @default(cuid())
  checklistId String
  title       String
  isComplete  Boolean   @default(false)
  order       String    // LexoRank
  assigneeId  String?
  dueDate     DateTime?
  createdAt   DateTime  @default(now())
  completedAt DateTime?

  checklist Checklist @relation(fields: [checklistId], references: [id], onDelete: Cascade)
  assignee  User?     @relation(fields: [assigneeId], references: [id])
}
```

**Implementation:**

1. **Checklist tab** in card modal: "Add checklist" button creates a new `Checklist` row. Multiple checklists per card supported.

2. **ChecklistItem component**: Inline text input on creation. Checkbox to toggle `isComplete`. Hover reveals: assign user, set due date, convert to card, delete. Drag-to-reorder within checklist.

3. **Progress bar**: `completed / total` shown on checklist header AND as a thin bar on the card tile in the board view (so users can see progress without opening the card).

4. **Convert to card**: ChecklistItem "Convert to Card" creates a new `Card` in the same list, copies title, marks checklist item as complete.

5. **Server actions** (`actions/checklist-actions.ts`): `createChecklist`, `deleteChecklist`, `createChecklistItem`, `updateChecklistItem`, `deleteChecklistItem`, `reorderChecklistItems` — all DAL-scoped.

**Acceptance:** Creating a checklist and checking items shows progress bar on board card tile. Reordering items persists. Convert-to-card creates a real card.

---

### TASK-010 · Card Cover Images
**Priority:** P1 | **Effort:** 3 hours

**What:** Cards should support a visual color or image cover displayed at the top of the card tile and in the card modal header. Trello's most recognizable visual feature.

**Schema — add to Card:**
```prisma
model Card {
  // ... existing fields
  coverColor  String?  // hex color e.g. "#7c3aed"
  coverImageUrl String? // Unsplash URL
}
```

**Implementation:**

1. **Cover picker** in card modal: Color palette (12 colors) + Unsplash search (reuse TASK-003 API route). "Remove cover" option.

2. **Render on card tile** (`components/board/card-item.tsx`): If `coverColor`, render a 40px colored bar at top. If `coverImageUrl`, render a 100px image with gradient overlay. Title and labels display below/over the cover.

3. **Server action**: `updateCardCover(cardId, { coverColor?, coverImageUrl? })` — clears the other field when one is set.

**Acceptance:** Setting a purple cover on a card renders correctly on the board. Cover survives page refresh. Removing cover restores default card appearance.

---

## PHASE 2 — POWER FEATURES (2–4 Weeks)

---

### TASK-011 · Multiple Board Views
**Priority:** P1 | **Effort:** 2 weeks total (split across sub-tasks)

**What:** Kanban is view #1. Real product teams need Table, Timeline (Gantt), and Calendar views. This is the biggest single feature gap vs. Linear and Jira.

**Shared infrastructure first:**

Create `components/board/view-switcher.tsx`: Tabs or segmented control — Kanban / Table / Timeline / Calendar. Persists selected view to `localStorage` per board. Renders the correct view component.

---

#### TASK-011A · Table View
**Effort:** 3 days

Cards displayed as rows in a sortable, filterable table. Think Notion database view or Linear's list view.

**Implementation:**

Create `components/board/table-view.tsx`. Columns: Status (list name), Title, Priority, Assignee, Labels, Due Date, Created At. Each is sortable. Clicking a row opens the card modal. Inline edit for title.

Filter bar above table: filter by assignee, priority, label, due date range. Active filters shown as chips.

"New card" button at bottom of each status section adds a row inline.

Virtual scrolling via existing `VirtualScroll` component for large datasets.

---

#### TASK-011B · Calendar View
**Effort:** 2 days

Cards with due dates displayed on a monthly calendar grid.

**Implementation:**

```bash
npm install @fullcalendar/react @fullcalendar/daygrid @fullcalendar/interaction
```

Create `components/board/calendar-view.tsx`. Month grid showing cards by due date. Click a card to open modal. Drag a card to change its due date (drag-and-drop on calendar cells, update via server action). Cards without due dates shown in a sidebar "Unscheduled" panel. Color-coded by priority.

---

#### TASK-011C · Timeline / Gantt View ✅
**Effort:** 1 week

The most complex view. Horizontal bars showing card duration from creation to due date, grouped by list.

> **Status: COMPLETE** — `components/board/gantt-view.tsx` (398 lines): day/week/month zoom, today indicator, priority-coloured bars, unscheduled strip, click-to-open card modal. Integrated in `board-tabs.tsx` as the Timeline tab (keyboard shortcut `4`).

**Schema — add to Card:**
```prisma
model Card {
  // ...
  startDate DateTime? // when work begins
}
```

**Implementation:**

Build a custom Gantt component (do not use a library — they're all either GPL or $$$). Key elements:
- Left panel: card titles grouped by list
- Right panel: scrollable horizontal timeline (days/weeks/months zoom levels)
- Bars: from `startDate` to `dueDate`. If no `startDate`, default to `createdAt`.
- Drag bar edges to resize (change dates). Drag bar body to move (shift both dates).
- Dependencies lines between cards (see TASK-014)
- Today indicator line
- Zoom controls: Day / Week / Month

Use `date-fns` for all date math. Canvas rendering for performance at large scale. Debounce drag events, batch DB updates.

---

### TASK-012 · Advanced Filtering & Saved Views
**Priority:** P1 | **Effort:** 3 days

**What:** Users need to slice and dice their cards. "Show me all HIGH priority cards assigned to me due this week."

**Schema:**
```prisma
model SavedView {
  id          String   @id @default(cuid())
  orgId       String
  boardId     String?  // null = org-wide view
  userId      String
  name        String
  filters     Json     // FilterConfig object
  viewType    String   // kanban | table | timeline | calendar
  isShared    Boolean  @default(false)
  createdAt   DateTime @default(now())

  organization Organization @relation(fields: [orgId], references: [id])
}
```

**Filter config shape:**
```typescript
type FilterConfig = {
  assignees?: string[];     // userId array
  priorities?: Priority[];
  labels?: string[];        // labelId array
  dueDateRange?: { from?: Date; to?: Date };
  lists?: string[];         // listId array
  hasAttachments?: boolean;
  isOverdue?: boolean;
  search?: string;          // full-text on title + description
};
```

**Implementation:**

1. **Filter bar** above every view: "Filter" button opens a popover with all filter options. Active filters render as dismissible chips.

2. **URL state**: Filters are serialized to URL search params so filtered views are shareable via link.

3. **Saved views**: "Save this filter" button names and persists the current filter + view type. Appears in left sidebar under the board.

4. **Performance**: Filtering happens client-side for small boards (<200 cards). For larger boards, filters are passed as query params to the board data fetch server action.

---

### TASK-013 · Sprints (Agile Mode)
**Priority:** P1 | **Effort:** 1 week

**What:** Linear-style Cycles / Jira-style Sprints. Group cards into a time-boxed iteration with a start/end date, track completion, run retrospectives.

**Schema:**
```prisma
model Sprint {
  id          String       @id @default(cuid())
  boardId     String
  name        String       // "Sprint 1", "Week of Jan 6"
  goal        String?      // Sprint goal statement
  status      SprintStatus @default(PLANNING)
  startDate   DateTime?
  endDate     DateTime?
  completedAt DateTime?
  createdAt   DateTime     @default(now())

  board Board  @relation(fields: [boardId], references: [id], onDelete: Cascade)
  cards Card[] @relation("SprintCards")
}

enum SprintStatus {
  PLANNING
  ACTIVE
  COMPLETED
}

// Add to Card:
model Card {
  // ...
  sprintId    String?
  storyPoints Int?
  sprint      Sprint? @relation("SprintCards", fields: [sprintId], references: [id])
}
```

**Implementation:**

1. **Sprint panel** (collapsible sidebar section on board): Current sprint status, start/end date, progress ring (completed cards / total).

2. **Sprint backlog**: A special "Backlog" column that exists outside all lists. Cards can be moved from backlog into a sprint.

3. **Sprint planning**: Drag cards from backlog into the sprint. Shows total story points selected vs. team velocity (average from last 3 sprints).

4. **Start/Complete sprint actions**: `startSprint()` sets `status: ACTIVE`. `completeSprint()` moves incomplete cards to backlog or next sprint (user chooses in a modal).

5. **Burndown chart**: A line chart in the analytics tab showing remaining story points per day during the sprint. Updated in real-time as cards are completed.

6. **Velocity chart**: Bar chart showing story points completed per sprint over last 8 sprints.

**Acceptance:** Create a sprint, add cards, start it, complete some cards, see burndown update live, complete sprint with remaining cards moved to backlog.

---

### TASK-014 · Card Dependencies
**Priority:** P1 | **Effort:** 3 days

**What:** Cards can block or be blocked by other cards. Essential for project planning.

**Schema:**
```prisma
model CardDependency {
  id         String         @id @default(cuid())
  blockerId  String         // the card that blocks
  blockedId  String         // the card being blocked
  type       DependencyType @default(BLOCKS)
  createdAt  DateTime       @default(now())

  blocker Card @relation("BlockerCard", fields: [blockerId], references: [id], onDelete: Cascade)
  blocked Card @relation("BlockedCard", fields: [blockedId], references: [id], onDelete: Cascade)

  @@unique([blockerId, blockedId])
}

enum DependencyType {
  BLOCKS
  RELATES_TO
  DUPLICATES
}
```

**Implementation:**

1. **Dependencies section** in card modal: "Add dependency" button. Search for cards by title within the org. Shows relationship type dropdown: Blocks / Blocked by / Relates to / Duplicates.

2. **Visual indicator** on card tile: A lock icon if the card is blocked by an unresolved card.

3. **Dependency lines** in Timeline view: SVG arrows between dependent cards.

4. **Circular dependency prevention**: Before saving, check that adding this dependency doesn't create a cycle (DFS traversal on existing dependency graph).

**Acceptance:** Card A "blocks" Card B. Card B shows blocked indicator. Completing Card A removes the block. Creating a circular dependency is rejected with an error.

---

### TASK-015 · Bulk Operations
**Priority:** P1 | **Effort:** 2 days

**What:** Select multiple cards and perform batch operations. Essential for triage sessions.

**Implementation:**

1. Checkbox appears on card hover (or long-press on mobile). Clicking one enters "selection mode" — all cards show checkboxes.

2. Selection toolbar appears at bottom of screen (Linear-style) showing: count selected, action buttons.

3. Actions: Move to list (dropdown), Set priority, Assign to user, Add label, Set due date, Delete. All fire a single server action with an array of cardIds.

4. Server actions (`actions/bulk-card-actions.ts`): `bulkUpdateCards(cardIds: string[], update: Partial<Card>)`. DAL verifies ownership of ALL cardIds before any update (not one by one — single query: `SELECT id FROM cards WHERE id IN (...) AND org = ctx.orgId`, compare result set size to input).

5. "Select all in list" shortcut. Escape to exit selection mode.

**Acceptance:** Selecting 10 cards and setting them all to HIGH priority fires one server action and updates all 10 in the UI optimistically.

---

### TASK-016 · Keyboard Shortcuts (Linear-Style)
**Priority:** P1 | **Effort:** 2 days

**What:** Linear is beloved for being keyboard-first. Power users never touch the mouse.

**Implementation:**

Create `hooks/use-keyboard-shortcuts.ts` with a `useHotkeys`-style implementation (or install `react-hotkeys-hook`).

**Global shortcuts:**
- `N` — New card (in last focused list)
- `B` — New board
- `Cmd+K` — Command palette (existing)
- `G then D` — Go to Dashboard
- `G then A` — Go to Activity
- `G then S` — Go to Settings
- `?` — Show keyboard shortcuts modal

**Card shortcuts (when card modal is open):**
- `P` — Open priority picker
- `A` — Open assignee picker
- `L` — Open label picker
- `D` — Open due date picker
- `Cmd+Enter` — Save description
- `Escape` — Close modal
- `Cmd+Shift+D` — Delete card (with confirmation)

**Board navigation:**
- `→` / `←` — Navigate between lists
- `↑` / `↓` — Navigate between cards in a list
- `Enter` — Open focused card

Create `components/keyboard-shortcuts-modal.tsx`: Press `?` to show a modal with all shortcuts organized by context. Store which shortcuts are enabled in `UserPreference`.

---

### TASK-017 · Workload View
**Priority:** P1 | **Effort:** 3 days

**What:** See what every team member is working on, how many cards they have, if anyone is overloaded. The "manager view."

**Implementation:**

New route: `/board/[boardId]/workload`

Horizontal swimlane layout: one row per org member. Each row shows their assigned cards as tiles, color-coded by priority. Due date badges on overdue cards.

Capacity indicator: a bar showing card count. Configurable "capacity" per user per sprint (stored in `UserAnalytics` or a new `TeamCapacity` model).

Drag a card from one person's row to another to reassign — fires `assignUser` server action.

Filter by: list, priority, label, sprint.

**Acceptance:** Opening workload view shows all members and their cards. Dragging a card to a different member's row reassigns it and persists.

---

### TASK-018 · Custom Fields
**Priority:** P2 | **Effort:** 1 week

**What:** Every team has fields that don't fit the built-in model. A bug tracker needs "Steps to reproduce." A marketing team needs "Campaign." Custom fields unlock NEXUS for any workflow.

**Schema:**
```prisma
model CustomField {
  id           String          @id @default(cuid())
  orgId        String
  boardId      String?         // null = org-wide
  name         String
  type         CustomFieldType
  options      Json?           // for SELECT / MULTI_SELECT: [{ id, label, color }]
  isRequired   Boolean         @default(false)
  order        Int             @default(0)

  organization  Organization        @relation(fields: [orgId], references: [id])
  values        CustomFieldValue[]
}

model CustomFieldValue {
  id            String      @id @default(cuid())
  fieldId       String
  cardId        String
  valueText     String?
  valueNumber   Float?
  valueDate     DateTime?
  valueBoolean  Boolean?
  valueOptions  String[]    // for MULTI_SELECT

  field CustomField @relation(fields: [fieldId], references: [id], onDelete: Cascade)
  card  Card        @relation(fields: [cardId], references: [id], onDelete: Cascade)

  @@unique([fieldId, cardId])
}

enum CustomFieldType {
  TEXT
  NUMBER
  DATE
  CHECKBOX
  SELECT
  MULTI_SELECT
  URL
  EMAIL
  PHONE
}
```

**Implementation:**

1. **Field management**: Board settings panel → "Custom Fields" tab → create, reorder, delete fields.

2. **Card modal**: Custom fields section auto-renders all fields configured for this board. Each renders the appropriate input type.

3. **Table view**: Each custom field becomes a sortable, filterable column.

4. **Filtering**: Saved views can filter by custom field values.

**Acceptance:** Creating a "Story Points" NUMBER field for a board shows it on every card in that board. Saving a value persists and shows in table view.

---

### TASK-019 · Automation Engine
**Priority:** P2 | **Effort:** 2 weeks

**What:** "When X happens, do Y." The feature that turns NEXUS from a board tool into a workflow engine. Trello Power-Ups, Jira Automation, Linear's built-in automations.

**Schema:**
```prisma
model Automation {
  id          String           @id @default(cuid())
  orgId       String
  boardId     String?
  name        String
  isEnabled   Boolean          @default(true)
  trigger     Json             // TriggerConfig
  conditions  Json             // ConditionConfig[]
  actions     Json             // ActionConfig[]
  runCount    Int              @default(0)
  lastRunAt   DateTime?
  createdAt   DateTime         @default(now())

  organization Organization @relation(fields: [orgId], references: [id])
}

model AutomationLog {
  id           String   @id @default(cuid())
  automationId String
  cardId       String?
  success      Boolean
  error        String?
  ranAt        DateTime @default(now())
}
```

**Trigger types:**
- Card created in list [X]
- Card moved to list [X]
- Priority changed to [X]
- Due date is in [N] days
- Label [X] added
- Card assigned to [user]
- Card created (any)

**Condition types:**
- Priority is / is not [X]
- Assignee is / is not [user]
- Label [X] is / is not present
- Due date is before / after [date]

**Action types:**
- Move card to list [X]
- Set priority to [X]
- Assign to [user]
- Add label [X]
- Create audit log entry
- Send notification to [user/assignee]
- Send webhook to [URL]

**Implementation:**

1. **Automation builder UI** (`app/board/[boardId]/settings/automations`): Visual rule builder. Trigger → Conditions → Actions. "Run now" test button.

2. **Automation executor** (`lib/automation-engine.ts`): Called from server actions after the primary operation. `runAutomations(trigger: TriggerEvent, card: Card, ctx: TenantContext)` fetches matching automations and executes their action chains.

3. **Safety**: Max 10 automation executions per card per minute (prevents infinite loops). Max 3 chained automations per trigger. Log all runs in `AutomationLog`.

**Acceptance:** "When card moved to 'Done', set priority to LOW" works. Moving a card to Done sets its priority automatically. Run log shows the execution.

---

### TASK-020 · Webhooks (Outbound)
**Priority:** P2 | **Effort:** 2 days

**What:** Allow external systems to subscribe to NEXUS events. Enables Zapier, Slack integrations, custom workflows.

**Schema:**
```prisma
model Webhook {
  id          String   @id @default(cuid())
  orgId       String
  url         String
  secret      String   // HMAC secret, for receiver to verify
  events      String[] // ["card.created", "card.updated", "board.deleted"]
  isEnabled   Boolean  @default(true)
  createdAt   DateTime @default(now())

  organization Organization @relation(fields: [orgId], references: [id])
  deliveries   WebhookDelivery[]
}

model WebhookDelivery {
  id          String   @id @default(cuid())
  webhookId   String
  event       String
  payload     Json
  statusCode  Int?
  success     Boolean
  attemptedAt DateTime @default(now())
  duration    Int?     // ms

  webhook Webhook @relation(fields: [webhookId], references: [id])
}
```

**Implementation:**

1. **Webhook management** in org settings: Add URL, select events, generate secret, test delivery.

2. **Delivery function** (`lib/webhook-delivery.ts`): Called async (fire-and-forget via Vercel's `waitUntil`) after server actions. Sends POST with HMAC-SHA256 signature in `X-NEXUS-Signature` header. Retries up to 3 times with exponential backoff on failure.

3. **Delivery log**: Last 50 deliveries visible in settings with status code, response time, payload inspector.

**Acceptance:** Configuring a webhook to `https://webhook.site` and creating a card delivers a signed payload within 2 seconds. Failed deliveries show in the log with error details.

---

### TASK-021 · Public REST API + API Keys
**Priority:** P2 | **Effort:** 1 week

**What:** NEXUS as a platform, not just an app. Developers can build on top of it.

**Schema:**
```prisma
model ApiKey {
  id          String    @id @default(cuid())
  orgId       String
  userId      String
  name        String
  keyHash     String    @unique // SHA-256 of the actual key
  keyPrefix   String    // first 8 chars, for display
  scopes      String[]  // ["boards:read", "cards:write"]
  lastUsedAt  DateTime?
  expiresAt   DateTime?
  createdAt   DateTime  @default(now())
  revokedAt   DateTime?

  organization Organization @relation(fields: [orgId], references: [id])
}
```

**API routes** under `/app/api/v1/`:

```
GET    /v1/boards              - list org boards
POST   /v1/boards              - create board
GET    /v1/boards/{id}         - get board with lists
DELETE /v1/boards/{id}         - delete board
GET    /v1/boards/{id}/cards   - list all cards
POST   /v1/cards               - create card
GET    /v1/cards/{id}          - get card
PATCH  /v1/cards/{id}          - update card
DELETE /v1/cards/{id}          - delete card
GET    /v1/members             - list org members
GET    /v1/audit-logs          - list audit logs
```

**Auth**: API key in `Authorization: Bearer nxs_xxxxxxxxxxxx` header. Middleware hashes the key, looks up `ApiKey`, verifies not revoked/expired, injects `orgId` into request context. Same DAL and RLS protections apply — API keys are org-scoped.

**Rate limiting**: 1000 requests/hour per API key (separate from user rate limits).

**Documentation**: Auto-generated OpenAPI spec at `/api/v1/openapi.json`. Interactive docs at `/docs` using Scalar or Redoc.

**Acceptance:** `curl -H "Authorization: Bearer nxs_xxxx" https://nexus.app/api/v1/boards` returns boards. An expired key returns 401. A key from Org A cannot read Org B's data.

---

## PHASE 3 — ENTERPRISE & DIFFERENTIATORS (4–6 Weeks)

---

### TASK-022 · AI Features
**Priority:** P2 | **Effort:** 2 weeks

**What:** The features that make NEXUS genuinely different from Trello and Linear. Not AI for AI's sake — specific, useful, well-integrated.

**Implementation:**

Install the Anthropic SDK or use `openai` depending on your API choice.

**AI Feature 1 — Card Description Generator:**
Button in card modal: "✨ Generate description from title." Sends card title + board name + list name → LLM → returns a structured markdown description with Acceptance Criteria, Steps to Reproduce (if bug board), or Description template. User can accept, regenerate, or dismiss.

**AI Feature 2 — Smart Priority Suggestion:**
When creating a card, after the user types the title, a subtle "Suggested: HIGH" pill appears (non-blocking, dismissible). Powered by a lightweight classification call: title text + board name → priority enum. Cache results to avoid calling the API for every keystroke (debounce + cache by title hash).

**AI Feature 3 — Sprint Planning Assistant:**
In the sprint planning view, "AI Suggest" button. Sends the backlog (titles, story points, priorities) + team capacity → returns a suggested sprint scope. Displayed as a recommendation, not auto-applied. User drags suggested cards into sprint to accept individually.

**AI Feature 4 — Natural Language Card Creation:**
In the command palette, type: "Create card: Fix login bug in auth service, high priority, assign to Viraj, due Friday." Parsed by LLM into structured card fields before the create action is called. Regex fallback if LLM call fails.

**AI Feature 5 — Meeting Notes → Cards:**
New route `/ai/extract`. Paste meeting notes (text area). LLM extracts action items, formats as draft cards with suggested assignees (if names are mentioned) and priorities. User reviews and bulk-creates the cards they want.

**Cost control:** All AI calls are server-side. Log token usage per org. Add to `STRIPE_CONFIG`: FREE plan = 100 AI calls/month. PRO = 2000 AI calls/month. Counter stored in `Organization.aiCallsThisMonth`, reset by monthly cron.

---

### TASK-023 · Roadmap View (Initiative → Epic → Card)
**Priority:** P2 | **Effort:** 1 week

**What:** Strategic hierarchy above boards. Initiatives contain Epics contain Cards. Visualized on a timeline with milestone markers.

**Schema:**
```prisma
model Initiative {
  id          String   @id @default(cuid())
  orgId       String
  title       String
  description String?
  status      String   @default("ACTIVE")
  startDate   DateTime?
  endDate     DateTime?
  color       String?
  epics       Epic[]

  organization Organization @relation(fields: [orgId], references: [id])
}

model Epic {
  id            String   @id @default(cuid())
  orgId         String
  boardId       String?
  initiativeId  String?
  title         String
  description   String?
  status        String   @default("IN_PROGRESS")
  startDate     DateTime?
  dueDate       DateTime?
  color         String?
  cards         Card[]

  organization Organization @relation(fields: [orgId], references: [id])
  initiative   Initiative?  @relation(fields: [initiativeId], references: [id])
}

// Add to Card:
model Card {
  // ...
  epicId String?
  epic   Epic?  @relation(fields: [epicId], references: [id])
}
```

New route `/roadmap`: Full-page timeline. Rows grouped by Initiative → Epics beneath each. Card count + completion % shown on each epic bar. Click epic to see its cards in a side panel. Milestone markers (diamond shape) for key dates.

---

### TASK-024 · Org-Wide Search (Full-Text)
**Priority:** P2 | **Effort:** 3 days

**What:** The command palette searches API endpoints. Not indexed. Slow. No full-text search on descriptions. A proper search finds anything instantly.

**Implementation:**

Enable PostgreSQL full-text search on Supabase:
```sql
-- Add tsvector column to cards
ALTER TABLE cards ADD COLUMN search_vector tsvector 
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) STORED;

CREATE INDEX cards_search_idx ON cards USING GIN (search_vector);

-- Same for boards, lists, comments
```

New route `/search`: Full-page search results. Type in a search bar, results appear across all entity types: Boards, Cards, Comments. Each result shows: entity type, title, excerpt with highlighted terms, which board/list it's in, priority/assignee.

Update command palette to also search descriptions (not just titles) via the full-text index.

Server action `globalSearch(query: string)` — single query joining boards + cards + comments with `@@to_tsquery` ranking. Returns top 20 results, tenant-scoped.

---

### TASK-025 · Time Tracking
**Priority:** P2 | **Effort:** 3 days

**What:** Log time spent on cards. Compare estimates to actuals. Time reports per member.

**Schema:**
```prisma
model TimeLog {
  id          String   @id @default(cuid())
  cardId      String
  userId      String
  orgId       String
  minutes     Int
  description String?
  loggedAt    DateTime @default(now())

  card Card @relation(fields: [cardId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id])
}

// Add to Card:
model Card {
  // ...
  estimatedMinutes Int?
  timeLogs         TimeLog[]
}
```

**UI**: "Time Tracking" section in card modal. "Log time" button opens quick input: hours + minutes + optional description. Shows total logged vs. estimate. History of all logs with user and timestamp.

**Reports**: Analytics tab → "Time" chart. Breakdown by user, by card, by week. Export as CSV.

---

### TASK-026 · Import / Export
**Priority:** P2 | **Effort:** 4 days

**What:** Users coming from Trello, Jira, Asana, or just CSV. Lock-in is a trust issue — export too, so users know they can leave.

**Import:**

1. **CSV import** (`/api/import/csv`): Upload CSV → map columns to NEXUS fields → preview → import. Creates cards in a new board.

2. **Trello JSON import** (`/api/import/trello`): Trello's "Export as JSON" → upload → maps boards → lists → cards, labels, members (matched by email), checklists, attachments (re-uploaded to Supabase Storage), comments.

3. **Jira XML import**: Jira backup XML → maps issues to cards, sprints, epics, components to labels, story points.

**Export:**

1. **Board → CSV**: All cards with all fields as columns.
2. **Board → JSON**: Full board structure (importable back into NEXUS).
3. **Org → JSON backup**: Complete org export (GDPR compliance requirement).

---

### TASK-027 · Integrations Hub
**Priority:** P2 | **Effort:** 3 weeks

**What:** NEXUS connects to the tools teams already use.

**GitHub Integration** (highest value):
- Link cards to PRs and commits
- Card automatically moves to "In Review" when a PR is opened referencing `NEXUS-[cardId]`
- Card moves to "Done" when PR is merged
- PR status badge on card modal
- Implementation: GitHub App → webhook → parse commit messages → call automation engine

**Slack Integration**:
- Post to Slack channel when: card created, moved to Done, overdue, assigned to user
- `/nexus` Slack command: create a card from Slack
- Implementation: Slack App → Bot token → `chat.postMessage` from notification system

**Google Calendar Sync**:
- Cards with due dates sync as Google Calendar events
- Implementation: OAuth 2.0 → Google Calendar API → two-way sync

**Zapier / Make.com**:
- NEXUS as a trigger app (card created, updated)
- NEXUS as an action app (create card, update card)
- Implementation: Zapier developer platform using the REST API (TASK-021)

---

### TASK-028 · Advanced Analytics & Reports
**Priority:** P2 | **Effort:** 1 week

**What:** Current analytics shows basic charts. Enterprise teams need cycle time, lead time, cumulative flow, throughput.

**New charts to add:**

1. **Cumulative Flow Diagram**: Stacked area chart showing card count per list over time. Reveals bottlenecks (one status growing faster than others).

2. **Cycle Time Distribution**: Histogram of time from "In Progress" to "Done." Identify outliers.

3. **Lead Time**: Time from card creation to completion. Average + trend.

4. **Throughput**: Cards completed per week. Simple bar chart but critical for capacity planning.

5. **Sprint Burndown**: Already planned in TASK-013. Add burnup variant.

6. **Member Contribution**: Heat map (GitHub-style) of activity per member over 90 days.

**Data collection**: Add `CardStatusTransition` events to AuditLog. Calculate derived metrics (`cycleTime`, `leadTime`) at report generation time from transition history.

**Export**: CSV export for every chart. Scheduled email report (weekly digest) using Resend.

---

### TASK-029 · Desktop Push Notifications
**Priority:** P3 | **Effort:** 1 week

**What:** The `desktopNotifications` preference is stored. No delivery.

**Implementation:**

1. Service Worker at `/public/sw.js` with Push API event handler.
2. VAPID key generation: `npx web-push generate-vapid-keys`. Add `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` to env.
3. Client-side subscription prompt (only shown if user enables in settings).
4. Store `PushSubscription` object in `User.pushSubscription` (JSON field).
5. From notification system (`lib/notifications.ts`): after creating `Notification` row, call `webpush.sendNotification()` if user has a push subscription.

**Acceptance:** Enabling desktop notifications + granting browser permission → receiving an @mention → desktop push notification appears even with NEXUS tab closed.

---

### TASK-030 · Board Sharing & Guest Access
**Priority:** P2 | **Effort:** 3 days

**What:** Share a board with someone outside your org as read-only. Public read-only URL.

**Schema:**
```prisma
model BoardShare {
  id          String   @id @default(cuid())
  boardId     String   @unique
  token       String   @unique @default(cuid())
  isPublic    Boolean  @default(true)
  allowedEmails String[]  // empty = anyone with link
  expiresAt   DateTime?
  createdAt   DateTime @default(now())

  board Board @relation(fields: [boardId], references: [id], onDelete: Cascade)
}
```

Route `/shared/[token]`: Read-only Kanban view. No auth required if `isPublic`. No edit capability. No org data exposed beyond the shared board's cards and lists. Session variable not set for shared routes — RLS returns only the board in question via a separate `publicDb` client using a restricted service account.

---

## PHASE 4 — QUALITY & PRODUCTION HARDENING

---

### TASK-031 · Complete Test Coverage
**Priority:** P1 | **Effort:** Ongoing

**Target coverage by file type:**

| Category | Target |
|----------|--------|
| `lib/tenant-context.ts` | >90% |
| `lib/dal.ts` | >80% |
| `lib/action-protection.ts` | 100% |
| `actions/*.ts` | >70% |
| `app/api/*.ts` | >70% |
| `hooks/*.ts` | >50% |
| `components/` | >40% (critical paths) |

**Unit tests needed:**
- All 8 `phase3-actions` handlers
- All `label-actions` and `assignee-actions` handlers
- `lexorank.ts` — edge cases at boundaries
- `stripe.ts` — limit enforcement logic

**Integration tests needed:**
- Full board lifecycle (create → add lists → add cards → reorder → delete)
- Stripe checkout session creation with correct org metadata
- Supabase realtime channel subscription with mocked client

**E2E tests needed:** Already covered in TASK-005.

---

### TASK-032 · Observability & Monitoring
**Priority:** P1 | **Effort:** 2 days

**What:** Sentry is configured. But you have no visibility into performance, uptime, or usage patterns.

**Implementation:**

1. **Vercel Analytics**: Enable in Vercel dashboard. Add `<Analytics />` component to root layout. Gives Web Vitals, page views, geographic breakdown.

2. **Uptime monitoring**: Set up Better Uptime or UptimeRobot (free). Monitor `/api/health` endpoint. Alert on Slack if down.

3. **Health check endpoint** (`/app/api/health/route.ts`):
```typescript
export async function GET() {
  const checks = {
    db: await db.$queryRaw`SELECT 1`.then(() => "ok").catch(() => "fail"),
    supabase: "ok", // ping supabase
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
  };
  const healthy = Object.values(checks).every(v => v === "ok" || typeof v === "string" && v !== "fail");
  return Response.json(checks, { status: healthy ? 200 : 503 });
}
```

4. **PostHog** (product analytics — anonymous, privacy-respecting):
```bash
npm install posthog-js
```
Track: board created, card moved, sprint started, export used, AI feature used. Use to understand which features are actually used.

5. **Sentry Performance**: Already configured. Add custom spans around expensive operations (DAL queries, Stripe calls, AI calls).

---

### TASK-033 · GDPR & Privacy Compliance
**Priority:** P1 | **Effort:** 3 days

**What:** Serving UK/EU users. Non-negotiable for a B2B SaaS.

**Implementation:**

1. **Privacy policy page** (`/privacy`): Markdown-rendered, covers: data collected, third-party processors (Clerk, Supabase, Stripe, Sentry, Resend), retention periods, user rights.

2. **Terms of service page** (`/terms`).

3. **Data export** (`/settings/data`): "Export my data" → generates JSON of all user's data across all orgs. Available for download within 24 hours (async generation, email notification when ready).

4. **Account deletion**: "Delete account" in settings → removes `User` row, clears all `AuditLog.userName`, anonymizes `Comment.userId` (replace with "Deleted User"). Does not delete org data (other members' work).

5. **Cookie consent** (`components/cookie-banner.tsx`): Non-intrusive banner. Respects `prefers-color-scheme`. Choices stored in `localStorage` + `UserPreference.cookieConsent`.

6. **Data retention**: Cron job at `0 0 * * 0` (weekly): delete `AuditLog` rows older than 1 year for FREE plan, 3 years for PRO.

---

### TASK-034 · Onboarding Flow
**Priority:** P1 | **Effort:** 3 days

**What:** A new user signs up and sees a blank dashboard. Drop-off. The first 5 minutes are critical.

**Implementation:**

1. **Welcome modal** (shown once per user, tracked in `UserPreference`): "Welcome to NEXUS — let's get you set up."

2. **Interactive checklist** (`components/onboarding/checklist.tsx`): Floating card in bottom-right corner. Items:
   - ☐ Create your first board
   - ☐ Add a list
   - ☐ Create your first card
   - ☐ Invite a teammate
   - ☐ Try the command palette (Cmd+K)
   Progress: "3/5 complete." Persisted to `UserPreference.onboardingStep`.

3. **Sample board**: On first org creation, automatically create a demo board with pre-populated lists (To Do, In Progress, Done) and 3 sample cards. User can delete it. Board has a "Sample Board" badge.

4. **Contextual tooltips**: First time user opens card modal → tooltip pointing to priority picker: "Set priority here." Use `react-joyride` or a simple state machine approach. Fire-once tooltips stored in `UserPreference`.

5. **Empty states**: Every empty state has an illustration + CTA. No blank white boxes. "No boards yet — create your first board" with a large + button.

---

### TASK-035 · Performance Hardening
**Priority:** P1 | **Effort:** 3 days

**What:** Current performance utilities exist (`VirtualScroll`, `LazyLoad`, `PerformanceWrapper`) but no actual measurements. No targets.

**Targets (Lighthouse CI enforced in GitHub Actions):**
- Performance: >85
- Accessibility: >95
- Best Practices: >90
- SEO: >80
- LCP: <2.5s
- FID: <100ms
- CLS: <0.1

**Implementation:**

1. **Lighthouse CI** in `.github/workflows/`:
```yaml
- uses: treosh/lighthouse-ci-action@v10
  with:
    urls: |
      http://localhost:3000/
    budgetPath: ./lighthouserc.json
    uploadArtifacts: true
```

2. **Image optimization**: All `<img>` tags → Next.js `<Image>`. Add `sizes` prop to all board background images.

3. **Bundle analysis**: `npm install @next/bundle-analyzer`. Run `ANALYZE=true npm run build`. Identify and code-split any package >50KB that isn't needed on first paint.

4. **Database query optimization**: Add `EXPLAIN ANALYZE` to your 5 most frequent queries. Add missing indexes. Key ones:
```sql
CREATE INDEX cards_list_id_order ON cards (list_id, order);
CREATE INDEX cards_assignee_due ON cards (assignee_id, due_date) WHERE due_date IS NOT NULL;
CREATE INDEX audit_logs_org_created ON audit_logs (org_id, created_at DESC);
```

5. **API response caching**: Board data doesn't change every millisecond. Add `revalidate: 30` to board page server components. Real-time updates override stale cache.

---

### TASK-036 · Accessibility (a11y)
**Priority:** P1 | **Effort:** 3 days

**What:** Radix UI (via shadcn) handles most a11y. But custom components — DnD board, card modal, command palette — need manual auditing.

**Audit and fix:**

1. **Screen reader**: All interactive elements have `aria-label`. Card tiles: `role="button"` with accessible name including priority and due date.

2. **Keyboard navigation**: Full keyboard navigation through the board without mouse. Focus management in modal: focus trap on open, restore focus on close.

3. **Color contrast**: Check all custom colors (priority badges, label colors) against WCAG AA 4.5:1 ratio. Pink/maroon palette may need adjustment.

4. **Focus indicators**: Visible focus ring on all interactive elements. Not hidden with `outline: none` without a replacement.

5. **Skip link**: "Skip to main content" link at top of page for keyboard users.

6. **ARIA live regions**: Board list updates (card added/moved in real-time) announced to screen readers via `aria-live="polite"`.

Run `axe-core` in tests:
```bash
npm install -D @axe-core/playwright
```
Add a11y assertions to E2E tests.

---

### TASK-037 · Mobile App (React Native / Expo)
**Priority:** P3 | **Effort:** 4–6 weeks

**What:** The web app is mobile-responsive, but a native app is a different experience class.

**Implementation:**

New monorepo workspace `apps/mobile/` using Expo (React Native). Share:
- All server actions (same API)
- TypeScript types
- Business logic hooks where possible

**Core screens:**
1. Dashboard (board grid)
2. Board view (horizontal scroll Kanban — swipe between lists)
3. Card detail (full feature parity)
4. Notifications
5. Settings

**Platform features:**
- Biometric authentication (Face ID / Touch ID) via Expo LocalAuthentication
- Push notifications via Expo Notifications + web push same backend
- Offline support: read-only mode when no network, sync queue when reconnected
- Share sheet: accept images/files and attach to cards
- Home screen widget (iOS 16+): "Your cards due today"

---

## COMPLETION TRACKER

| Task | Feature | Priority | Effort | Status |
|------|---------|---------|--------|--------|
| TASK-001 | PWA Icons | P0 | 30m | ⬜ |
| TASK-002 | GitHub Actions CI/CD | P0 | 45m | ⬜ |
| TASK-003 | Board Backgrounds | P0 | 4h | ⬜ |
| TASK-004 | Security Test Suite | P1 | 6h | ⬜ |
| TASK-005 | E2E Tests (Playwright) | P1 | 1d | ⬜ |
| TASK-006 | @Mention UI + Notifications | P1 | 8h | ⬜ |
| TASK-007 | Email Delivery (Resend) | P1 | 6h | ⬜ |
| TASK-008 | File Attachments | P1 | 1d | ⬜ |
| TASK-009 | Card Checklists | P1 | 8h | ⬜ |
| TASK-010 | Card Cover Images | P1 | 3h | ⬜ |
| TASK-011A | Table View | P1 | 3d | ✅ |
| TASK-011B | Calendar View | P1 | 2d | ✅ |
| TASK-011C | Timeline/Gantt View | P1 | 1w | ✅ |
| TASK-012 | Advanced Filtering & Saved Views | P1 | 3d | ⬜ |
| TASK-013 | Sprints (Agile Mode) | P1 | 1w | ⬜ |
| TASK-014 | Card Dependencies | P1 | 3d | ⬜ |
| TASK-015 | Bulk Operations | P1 | 2d | ⬜ |
| TASK-016 | Keyboard Shortcuts | P1 | 2d | ⬜ |
| TASK-017 | Workload View | P1 | 3d | ⬜ |
| TASK-018 | Custom Fields | P2 | 1w | ⬜ |
| TASK-019 | Automation Engine | P2 | 2w | ⬜ |
| TASK-020 | Webhooks (Outbound) | P2 | 2d | ⬜ |
| TASK-021 | Public REST API + API Keys | P2 | 1w | ⬜ |
| TASK-022 | AI Features | P2 | 2w | ⬜ |
| TASK-023 | Roadmap View (Epic/Initiative) | P2 | 1w | ⬜ |
| TASK-024 | Full-Text Search | P2 | 3d | ⬜ |
| TASK-025 | Time Tracking | P2 | 3d | ⬜ |
| TASK-026 | Import / Export | P2 | 4d | ⬜ |
| TASK-027 | Integrations (GitHub, Slack) | P2 | 3w | ⬜ |
| TASK-028 | Advanced Analytics | P2 | 1w | ⬜ |
| TASK-029 | Desktop Push Notifications | P3 | 1w | ⬜ |
| TASK-030 | Board Sharing & Guest Access | P2 | 3d | ⬜ |
| TASK-031 | Complete Test Coverage | P1 | ongoing | ⬜ |
| TASK-032 | Observability & Monitoring | P1 | 2d | ⬜ |
| TASK-033 | GDPR & Privacy Compliance | P1 | 3d | ⬜ |
| TASK-034 | Onboarding Flow | P1 | 3d | ⬜ |
| TASK-035 | Performance Hardening | P1 | 3d | ⬜ |
| TASK-036 | Accessibility (a11y) | P1 | 3d | ⬜ |
| TASK-037 | Mobile App | P3 | 6w | ⬜ |

---

## BUILD ORDER (Dependency-Respecting Sequence)

```
Week 1:   TASK-001, TASK-002, TASK-003, TASK-004, TASK-010
Week 2:   TASK-005, TASK-006, TASK-007, TASK-008
Week 3:   TASK-009, TASK-011A, TASK-012, TASK-016
Week 4:   TASK-011B, TASK-013, TASK-014, TASK-015
Week 5:   TASK-011C, TASK-017, TASK-034
Week 6:   TASK-018, TASK-024, TASK-032, TASK-033
Week 7:   TASK-019, TASK-020, TASK-022
Week 8:   TASK-021, TASK-023, TASK-025, TASK-026
Week 9:   TASK-027 (GitHub), TASK-028, TASK-035, TASK-036
Week 10:  TASK-027 (Slack), TASK-030, TASK-031
Week 11+: TASK-029, TASK-037
```

TASK-001 → TASK-002 → TASK-003 must be done before showing the project.
TASK-006 depends on email infrastructure in TASK-007 for full functionality.
TASK-019 (Automation) builds on TASK-013 (Sprints) and TASK-014 (Dependencies).
TASK-021 (API) is required before TASK-027 (Zapier integration).
TASK-022 (AI) can be built independently at any point after TASK-003.

---

## WHAT THIS DOCUMENT IS NOT

This document does not contain aspirational claims. Every schema block is valid Prisma syntax. Every implementation step is specific enough to execute without guessing. Every acceptance criterion is testable without subjectivity.

When a task is marked ⬜ it means it has not been started.  
When it is marked 🔄 it means it is in progress.  
When it is marked ✅ it means it passes its acceptance criteria.  

No task moves to ✅ without its acceptance criteria being verified against the running application.