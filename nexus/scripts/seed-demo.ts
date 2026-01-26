#!/usr/bin/env tsx
/**
 * Demo Organization Seed Script
 * 
 * Purpose: Creates impressive sample data for guest demo mode
 * Usage: npx tsx scripts/seed-demo.ts
 * 
 * Features:
 * - Idempotent (can run multiple times safely)
 * - Transaction-based (all-or-nothing)
 * - Rich sample data with labels, priorities, descriptions
 * - Error handling and rollback
 */

import { PrismaClient, Priority, ACTION, ENTITY_TYPE } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_ORG_ID = "demo-org-id";
const DEMO_USER_ID = "demo-user-id";

// Rich sample data for impressive demo
const SAMPLE_CARDS = {
  backlog: [
    {
      title: "Implement OAuth2 authentication",
      description: "Add Google and GitHub OAuth providers with PKCE flow for enhanced security. Include refresh token rotation and session management.",
      priority: Priority.HIGH,
      labels: [
        { name: "Security", color: "#EF4444" },
        { name: "Backend", color: "#3B82F6" },
      ],
    },
    {
      title: "Design system component library",
      description: "Build reusable React components with Storybook documentation. Include dark mode support and accessibility (WCAG 2.1 AA).",
      priority: Priority.MEDIUM,
      labels: [
        { name: "Frontend", color: "#10B981" },
        { name: "Design", color: "#8B5CF6" },
      ],
    },
    {
      title: "Database optimization for queries",
      description: "Add composite indexes on frequently queried columns. Implement query result caching with Redis for 90%+ performance improvement.",
      priority: Priority.URGENT,
      labels: [
        { name: "Performance", color: "#F59E0B" },
        { name: "Database", color: "#6366F1" },
      ],
    },
    {
      title: "API rate limiting middleware",
      description: "Implement token bucket algorithm with Redis. Support tiered limits: 100/hour (free), 1000/hour (pro).",
      priority: Priority.MEDIUM,
      labels: [
        { name: "Backend", color: "#3B82F6" },
        { name: "Infrastructure", color: "#6B7280" },
      ],
    },
    {
      title: "Stripe webhook signature verification",
      description: "Add webhook signature validation to prevent replay attacks. Implement idempotent event processing with deduplication.",
      priority: Priority.HIGH,
      labels: [
        { name: "Security", color: "#EF4444" },
        { name: "Payments", color: "#EC4899" },
      ],
    },
  ],
  inProgress: [
    {
      title: "Real-time collaboration with WebSockets",
      description: "Implement Supabase Realtime for live card updates. Add presence tracking to show online users with cursor positions.",
      priority: Priority.HIGH,
      labels: [
        { name: "Feature", color: "#14B8A6" },
        { name: "Backend", color: "#3B82F6" },
      ],
    },
    {
      title: "E2E tests with Playwright",
      description: "Write critical path tests: auth flow, card drag & drop, Stripe checkout. Run in CI/CD pipeline with screenshot diffing.",
      priority: Priority.MEDIUM,
      labels: [
        { name: "Testing", color: "#F97316" },
        { name: "Quality", color: "#84CC16" },
      ],
    },
    {
      title: "Mobile responsive navigation",
      description: "Redesign sidebar for mobile breakpoints. Implement swipe gestures for drawer navigation with haptic feedback.",
      priority: Priority.LOW,
      labels: [
        { name: "Frontend", color: "#10B981" },
        { name: "Mobile", color: "#06B6D4" },
      ],
    },
  ],
  done: [
    {
      title: "Database schema with Prisma",
      description: "Designed multi-tenant schema with row-level security. Implemented soft deletes and audit logging for compliance.",
      priority: Priority.HIGH,
      labels: [
        { name: "Database", color: "#6366F1" },
        { name: "Complete", color: "#22C55E" },
      ],
    },
    {
      title: "Clerk authentication integration",
      description: "Integrated Clerk with Organizations support. Added custom JWT claims and webhook handlers for user lifecycle events.",
      priority: Priority.HIGH,
      labels: [
        { name: "Security", color: "#EF4444" },
        { name: "Complete", color: "#22C55E" },
      ],
    },
  ],
};

async function main() {
  console.log("🚀 Starting demo organization seed...\n");

  try {
    // Use transaction for atomicity
    await prisma.$transaction(async (tx) => {
      // 1. Create Demo User (for audit logs and card assignments)
      console.log("📝 Creating demo user...");
      const demoUser = await tx.user.upsert({
        where: { id: DEMO_USER_ID },
        update: {},
        create: {
          id: DEMO_USER_ID,
          clerkUserId: "demo_clerk_user",
          email: "demo@nexus-demo.com",
          name: "Demo User",
          imageUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Demo",
        },
      });
      console.log(`✅ Demo user created: ${demoUser.email}\n`);

      // 2. Create Demo Organization (PRO plan to showcase premium features)
      console.log("🏢 Creating demo organization...");
      const org = await tx.organization.upsert({
        where: { id: DEMO_ORG_ID },
        update: {
          name: "Demo Company (Guest Mode)",
          subscriptionPlan: "PRO",
        },
        create: {
          id: DEMO_ORG_ID,
          name: "Demo Company (Guest Mode)",
          slug: "demo-company-guest",
          subscriptionPlan: "PRO",
          imageUrl: "https://api.dicebear.com/7.x/identicon/svg?seed=Demo",
        },
      });
      console.log(`✅ Organization created: ${org.name}`);
      console.log(`   Plan: ${org.subscriptionPlan}\n`);

      // 3. Link User to Organization as OWNER
      console.log("🔗 Linking user to organization...");
      await tx.organizationUser.upsert({
        where: {
          userId_organizationId: {
            userId: DEMO_USER_ID,
            organizationId: DEMO_ORG_ID,
          },
        },
        update: {},
        create: {
          userId: DEMO_USER_ID,
          organizationId: DEMO_ORG_ID,
          role: "OWNER",
        },
      });
      console.log(`✅ User linked as OWNER\n`);

      // 4. Create Board with Unsplash-style background
      console.log("📋 Creating demo board...");
      const board = await tx.board.create({
        data: {
          title: "Product Roadmap Q1 2026",
          orgId: DEMO_ORG_ID,
          imageId: "demo-unsplash-id",
          imageThumbUrl: "https://images.unsplash.com/photo-1557683316-973673baf926?w=400",
          imageFullUrl: "https://images.unsplash.com/photo-1557683316-973673baf926?w=1920",
          imageUserName: "Gradientify",
          imageLinkHTML: '<a href="https://unsplash.com/photos/demo">Unsplash Demo</a>',
        },
      });
      console.log(`✅ Board created: ${board.title}`);
      console.log(`   ID: ${board.id}\n`);

      // 5. Create Lists with Lexorank ordering
      console.log("📑 Creating lists...");
      const backlogList = await tx.list.create({
        data: {
          title: "📥 Backlog",
          boardId: board.id,
          order: "a",
        },
      });

      const inProgressList = await tx.list.create({
        data: {
          title: "🚧 In Progress",
          boardId: board.id,
          order: "m",
        },
      });

      const doneList = await tx.list.create({
        data: {
          title: "✅ Done",
          boardId: board.id,
          order: "z",
        },
      });

      console.log(`✅ Created 3 lists: Backlog, In Progress, Done\n`);

      // 6. Create Cards with rich data
      console.log("🎴 Creating cards with labels...");
      let cardCount = 0;

      // Backlog cards
      for (let i = 0; i < SAMPLE_CARDS.backlog.length; i++) {
        const cardData = SAMPLE_CARDS.backlog[i];
        const card = await tx.card.create({
          data: {
            title: cardData.title,
            description: cardData.description,
            priority: cardData.priority,
            listId: backlogList.id,
            order: String.fromCharCode(97 + i), // a, b, c, d, e
            assigneeId: i % 2 === 0 ? DEMO_USER_ID : null, // Assign every other card
          },
        });

        // Create labels for this card
        for (const label of cardData.labels) {
          await tx.cardLabel.create({
            data: {
              name: label.name,
              color: label.color,
              cardId: card.id,
            },
          });
        }

        cardCount++;
      }

      // In Progress cards
      for (let i = 0; i < SAMPLE_CARDS.inProgress.length; i++) {
        const cardData = SAMPLE_CARDS.inProgress[i];
        const card = await tx.card.create({
          data: {
            title: cardData.title,
            description: cardData.description,
            priority: cardData.priority,
            listId: inProgressList.id,
            order: String.fromCharCode(97 + i),
            assigneeId: DEMO_USER_ID, // All in-progress assigned to demo user
            dueDate: new Date(Date.now() + (i + 1) * 86400000 * 3), // Due in 3, 6, 9 days
          },
        });

        for (const label of cardData.labels) {
          await tx.cardLabel.create({
            data: {
              name: label.name,
              color: label.color,
              cardId: card.id,
            },
          });
        }

        cardCount++;
      }

      // Done cards
      for (let i = 0; i < SAMPLE_CARDS.done.length; i++) {
        const cardData = SAMPLE_CARDS.done[i];
        const card = await tx.card.create({
          data: {
            title: cardData.title,
            description: cardData.description,
            priority: cardData.priority,
            listId: doneList.id,
            order: String.fromCharCode(97 + i),
            assigneeId: DEMO_USER_ID,
          },
        });

        for (const label of cardData.labels) {
          await tx.cardLabel.create({
            data: {
              name: label.name,
              color: label.color,
              cardId: card.id,
            },
          });
        }

        cardCount++;
      }

      console.log(`✅ Created ${cardCount} cards with labels\n`);

      // 7. Create sample audit logs
      console.log("📜 Creating audit trail...");
      await tx.auditLog.createMany({
        data: [
          {
            orgId: DEMO_ORG_ID,
            userId: DEMO_USER_ID,
            action: ACTION.CREATE,
            entityType: ENTITY_TYPE.BOARD,
            entityId: board.id,
            entityTitle: board.title,
            userImage: demoUser.imageUrl!,
            userName: demoUser.name,
          },
          {
            orgId: DEMO_ORG_ID,
            userId: DEMO_USER_ID,
            action: ACTION.CREATE,
            entityType: ENTITY_TYPE.LIST,
            entityId: backlogList.id,
            entityTitle: backlogList.title,
            userImage: demoUser.imageUrl!,
            userName: demoUser.name,
          },
          {
            orgId: DEMO_ORG_ID,
            userId: DEMO_USER_ID,
            action: ACTION.CREATE,
            entityType: ENTITY_TYPE.LIST,
            entityId: inProgressList.id,
            entityTitle: inProgressList.title,
            userImage: demoUser.imageUrl!,
            userName: demoUser.name,
          },
        ],
      });

      console.log(`✅ Created audit logs\n`);
    });

    console.log("\n🎉 Demo organization seeded successfully!");
    console.log("\n📊 Summary:");
    console.log(`   Organization ID: ${DEMO_ORG_ID}`);
    console.log(`   Plan: PRO`);
    console.log(`   Board: Product Roadmap Q1 2026`);
    console.log(`   Lists: 3 (Backlog, In Progress, Done)`);
    console.log(`   Cards: ${SAMPLE_CARDS.backlog.length + SAMPLE_CARDS.inProgress.length + SAMPLE_CARDS.done.length}`);
    console.log(`   Labels: Multiple per card`);
    console.log("\n💡 Next steps:");
    console.log(`   1. Add demo button to sign-in page`);
    console.log(`   2. Route: /organization/${DEMO_ORG_ID}`);
    console.log(`   3. Protect demo org from mutations in middleware\n`);

  } catch (error) {
    console.error("\n❌ Error seeding demo organization:");
    console.error(error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
