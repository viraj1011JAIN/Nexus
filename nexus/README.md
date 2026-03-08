# NEXUS

**Production-grade, multi-tenant project management platform.**

Real-time Kanban boards, sprints, analytics, and team collaboration — a self-hostable Jira/Trello alternative.

**Live:** [nexus-cyan-two.vercel.app](https://nexus-cyan-two.vercel.app/)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack, React Compiler) |
| Language | TypeScript (strict mode) |
| Auth | Clerk (multi-tenant, RBAC, OAuth, step-up verification) |
| Database | PostgreSQL + Prisma ORM (with optional sharding) |
| Realtime | Supabase Realtime (presence, live board updates) |
| Collaboration | Yjs + Tiptap (real-time collaborative editing) |
| Payments | Stripe (subscriptions, checkout, webhooks) |
| AI | OpenAI (card suggestions, auto-checklists, summaries) |
| Styling | Tailwind CSS 4 + Radix UI + shadcn/ui |
| Editor | Tiptap (rich text, mentions, code blocks, images) |
| Drag & Drop | dnd-kit |
| Charts | Recharts |
| Email | Resend |
| Rate Limiting | Upstash Redis |
| Push Notifications | Web Push (VAPID) |
| Monitoring | Sentry |
| CI/CD | GitHub Actions (bundle size, Lighthouse CI) |
| Deployment | Vercel (serverless) |

## Features

### Core
- **Multi-tenant architecture** — org-level data isolation, Clerk JWT verification, tenant context caching
- **Real-time Kanban boards** — drag-and-drop cards/lists with live sync across users
- **RBAC** — Owner, Admin, Member, Guest roles with fine-grained permission checks
- **Rich text editor** — Tiptap with real-time collaboration (Yjs), mentions, checklists, code blocks, images
- **Board backgrounds** — Unsplash integration for cover images
- **Labels, due dates, assignments** — full card metadata
- **Checklists & dependencies** — card-level task tracking with cross-card dependencies
- **Custom fields** — extend cards with custom metadata
- **Time tracking** — log and track time on cards

### Productivity
- **Search** — global card/board search
- **Command palette** — keyboard shortcuts (Cmd+K)
- **Saved views** — custom filtered board views
- **Automations** — rule-based card actions (automation engine)
- **Import/Export** — JSON and CSV board data
- **Templates** — built-in and custom board templates

### Analytics & Monitoring
- **Analytics dashboard** — board metrics, charts, and insights
- **Real-time analytics** — live data updates via Supabase
- **Activity feed & audit log** — full history of all actions
- **Onboarding flow** — guided setup for new users

### Integrations
- **GitHub integration** — webhook-based card sync
- **Slack integration** — notifications and updates
- **REST API (v1)** — API key authentication for external integrations
- **Stripe billing** — Pro plan with usage-based limits

### Security & Compliance
- **GDPR compliance** — data export and deletion requests
- **Security headers** — CSP, HSTS, X-Frame-Options, CORS
- **Rate limiting** — distributed via Upstash Redis
- **Membership approvals** — request-based board access
- **Demo mode** — sandboxed demo org with limits

### PWA & UX
- **Progressive Web App** — installable, offline shell, push notifications
- **Dark mode** — system-aware theme switching
- **Accessibility** — skip nav, ARIA live regions, focus management
- **Service worker** — cache-first static assets, stale-while-revalidate images

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL (or Supabase)
- Clerk account
- Stripe account (optional, for billing)

### Setup

```bash
# Clone
git clone https://github.com/viraj1011JAIN/Nexus.git
cd Nexus/nexus

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in your Clerk, database, Stripe, and Supabase credentials

# Generate Prisma client and push schema
npx prisma generate
npx prisma db push

# Run dev server
npm run dev
```

Open [http://localhost:3001](http://localhost:3001).

## Project Structure

```
nexus/
  app/              # Next.js App Router — pages, layouts, API routes
  actions/          # Server Actions (30+ mutation handlers)
  components/       # React components (board, layout, modals, editors)
  hooks/            # Custom hooks (realtime, presence, card lock, push)
  lib/              # Utilities — DAL, tenant context, services, helpers
  prisma/           # Schema, migrations, seed scripts
  public/           # Static assets, manifest.json, service worker
  scripts/          # Admin scripts (sharding, storage setup)
  e2e/              # Playwright end-to-end tests
  __tests__/        # Jest unit and integration tests
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Turbopack, port 3001) |
| `npm run build` | Production build (prisma generate + next build) |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests (watch mode) |
| `npm run test:ci` | Run tests with coverage |
| `npm run test:unit` | Unit tests only |
| `npm run test:integration` | Integration tests only |
| `npm run analyze` | Bundle size analyzer |
| `npm run db:seed` | Seed demo data |

## Environment Variables

See [`.env.example`](.env.example) for the full list with descriptions. Key variables:

- `DATABASE_URL` / `DIRECT_URL` — PostgreSQL connection strings
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` — Clerk auth
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — Stripe billing
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Realtime
- `OPENAI_API_KEY` — AI features
- `RESEND_API_KEY` — Transactional emails
- `NEXT_PUBLIC_APP_URL` — App base URL

## Author

**Viraj Jain** — [@viraj1011JAIN](https://github.com/viraj1011JAIN)

## License

All rights reserved.
