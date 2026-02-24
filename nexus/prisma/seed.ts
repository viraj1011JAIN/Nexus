import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── Template definitions ─────────────────────────────────────────────────────

const TEMPLATES = [
  // ── 1. Scrum Sprint Board ─────────────────────────────────────────────────
  {
    id: "tpl-scrum-sprint",
    title: "Scrum Sprint Board",
    description: "Classic Agile sprint workflow for engineering teams. Track backlog, in-progress work, code review, and completed items across your sprint.",
    category: "Engineering",
    lists: [
      {
        title: "📋 Product Backlog",
        order: "a",
        cards: [
          "Refine user story acceptance criteria",
          "Break down epics into smaller stories",
          "Estimate story points with the team",
          "Prioritize next sprint candidates",
          "Review and groom backlog with PO",
        ],
      },
      {
        title: "🚀 Sprint Backlog",
        order: "b",
        cards: [
          "Set up CI/CD pipeline for new service",
          "Implement JWT refresh token flow",
          "Design database migration strategy",
          "Add unit tests for auth module",
        ],
      },
      {
        title: "⚙️ In Progress",
        order: "c",
        cards: [
          "Build REST API for user profiles",
          "Fix pagination bug on search results",
        ],
      },
      {
        title: "👀 Code Review",
        order: "d",
        cards: [
          "PR #142 — Add rate limiting middleware",
          "PR #145 — Refactor notification service",
        ],
      },
      {
        title: "🧪 QA / Testing",
        order: "e",
        cards: [
          "Test login edge cases on Safari",
          "Verify email delivery in staging",
        ],
      },
      {
        title: "✅ Done",
        order: "f",
        cards: [
          "SSO integration with Okta",
          "API documentation published",
          "Performance profiling completed",
        ],
      },
    ],
  },

  // ── 2. Product Roadmap ────────────────────────────────────────────────────
  {
    id: "tpl-product-roadmap",
    title: "Product Roadmap",
    description: "Quarterly roadmap to align your entire product organization. Visualise what's planned, in discovery, building, and shipped.",
    category: "Product",
    lists: [
      {
        title: "💡 Ideas & Discovery",
        order: "a",
        cards: [
          "AI-powered task suggestions",
          "Mobile app offline mode",
          "Third-party calendar sync",
          "Advanced analytics dashboard",
          "Guest user access (view-only)",
        ],
      },
      {
        title: "🔬 Research & Validation",
        order: "b",
        cards: [
          "User interviews — onboarding flow",
          "Competitive analysis: Notion vs Linear",
          "Prototype test: drag-and-drop redesign",
        ],
      },
      {
        title: "📐 Scoped & Planned",
        order: "c",
        cards: [
          "Slack integration V2",
          "Custom fields on cards",
          "Bulk card actions",
        ],
      },
      {
        title: "🏗️ In Development",
        order: "d",
        cards: [
          "Real-time presence indicators",
          "Rich text card descriptions",
          "Card templates library",
        ],
      },
      {
        title: "🚢 Shipped",
        order: "e",
        cards: [
          "Dark mode support",
          "CSV export",
          "Two-factor authentication",
          "Webhook notifications",
        ],
      },
    ],
  },

  // ── 3. Marketing Campaign ─────────────────────────────────────────────────
  {
    id: "tpl-marketing-campaign",
    title: "Marketing Campaign Launch",
    description: "End-to-end campaign management from ideation through launch and reporting. Perfect for product launches, seasonal campaigns, and brand initiatives.",
    category: "Marketing",
    lists: [
      {
        title: "🧠 Ideation",
        order: "a",
        cards: [
          "Define campaign goals and KPIs",
          "Identify target audience segments",
          "Competitive campaign audit",
          "Brainstorm messaging angles",
        ],
      },
      {
        title: "✍️ Content Creation",
        order: "b",
        cards: [
          "Write landing page copy",
          "Design hero banner (1200×628)",
          "Record 60-second product demo video",
          "Draft email nurture sequence (5 emails)",
          "Create social media asset pack",
        ],
      },
      {
        title: "🔍 Review & Approvals",
        order: "c",
        cards: [
          "Legal review — claims & disclaimers",
          "Brand review — tone and design",
          "Stakeholder sign-off",
        ],
      },
      {
        title: "📅 Scheduled",
        order: "d",
        cards: [
          "Email campaign — Monday 9 AM",
          "LinkedIn post — Tuesday 11 AM",
          "Paid ads go live — Wednesday",
        ],
      },
      {
        title: "📣 Launched",
        order: "e",
        cards: [
          "Product Hunt launch post",
          "Blog announcement published",
        ],
      },
      {
        title: "📊 Reporting",
        order: "f",
        cards: [
          "First 48h performance report",
          "A/B test results analysis",
          "Full campaign post-mortem",
        ],
      },
    ],
  },

  // ── 4. Design Sprint ──────────────────────────────────────────────────────
  {
    id: "tpl-design-sprint",
    title: "Design Sprint (5-Day)",
    description: "Google Ventures–style 5-day design sprint to rapidly validate ideas with real users before committing to full development.",
    category: "Design",
    lists: [
      {
        title: "📅 Monday — Understand",
        order: "a",
        cards: [
          "Map the problem space",
          "Interview key stakeholders",
          "Define the long-term goal",
          "List sprint questions",
          "Choose a target moment on the map",
        ],
      },
      {
        title: "✏️ Tuesday — Sketch",
        order: "b",
        cards: [
          "Lightning demos — competitive inspiration",
          "Four-step sketching process",
          "Crazy 8s warm-up exercise",
          "Solution sketches (individually)",
        ],
      },
      {
        title: "🗳️ Wednesday — Decide",
        order: "c",
        cards: [
          "Art museum — post sketches on wall",
          "Heatmap voting stickers",
          "Speed critique of top solutions",
          "Supervote to pick direction",
          "Create storyboard (15 frames)",
        ],
      },
      {
        title: "🔨 Thursday — Prototype",
        order: "d",
        cards: [
          "Assign roles: Maker, Stitcher, Writer, Interviewer",
          "Build high-fidelity Figma prototype",
          "Write interview script",
          "Trial run the prototype internally",
        ],
      },
      {
        title: "🧪 Friday — Test",
        order: "e",
        cards: [
          "User interview #1",
          "User interview #2",
          "User interview #3",
          "User interview #4",
          "User interview #5",
          "Synthesise findings & decide next steps",
        ],
      },
    ],
  },

  // ── 5. Hiring Pipeline ────────────────────────────────────────────────────
  {
    id: "tpl-hiring-pipeline",
    title: "Hiring Pipeline",
    description: "Full-cycle recruiting board from job posting to offer accepted. Keep every candidate stage visible and ensure nothing falls through the cracks.",
    category: "HR",
    lists: [
      {
        title: "📣 Job Posting",
        order: "a",
        cards: [
          "Write job description",
          "Get hiring manager sign-off",
          "Post on LinkedIn, Indeed, Wellfound",
          "Share with employee referral program",
        ],
      },
      {
        title: "📥 Applications",
        order: "b",
        cards: [
          "Frontend Engineer — Jane Smith",
          "Frontend Engineer — Carlos Rivera",
          "Product Designer — Priya Patel",
          "DevOps Engineer — Alex Kim",
        ],
      },
      {
        title: "📞 Phone Screen",
        order: "c",
        cards: [
          "Schedule 30-min intro call",
          "Send prep materials to candidate",
          "Complete phone screen scorecard",
        ],
      },
      {
        title: "🧩 Technical Assessment",
        order: "d",
        cards: [
          "Send take-home challenge",
          "Review submission (72h SLA)",
          "Debrief with hiring panel",
        ],
      },
      {
        title: "🏢 Onsite / Final Interviews",
        order: "e",
        cards: [
          "Coordinate panel availability",
          "Send interview guide to interviewers",
          "Collect structured feedback forms",
          "Debrief within 24h",
        ],
      },
      {
        title: "🤝 Offer",
        order: "f",
        cards: [
          "Draft offer letter",
          "Verbal offer call",
          "Send formal offer via DocuSign",
          "Confirm start date",
        ],
      },
      {
        title: "✅ Hired",
        order: "g",
        cards: [
          "Trigger onboarding workflow",
          "Order equipment",
          "Set up accounts & access",
        ],
      },
    ],
  },

  // ── 6. Bug Tracker ────────────────────────────────────────────────────────
  {
    id: "tpl-bug-tracker",
    title: "Bug Tracker",
    description: "Structured bug triage board for shipping quality software. Covers incoming reports, reproduction, active fixing, regression testing, and resolved issues.",
    category: "Engineering",
    lists: [
      {
        title: "🆕 Reported",
        order: "a",
        cards: [
          "Login button unresponsive on iOS 17",
          "CSV export produces empty file",
          "404 on /settings/billing for free users",
          "Notification badge count doesn't reset",
        ],
      },
      {
        title: "🔍 Triage",
        order: "b",
        cards: [
          "Confirm reproduction steps",
          "Assess severity (P0–P3)",
          "Assign to responsible team",
        ],
      },
      {
        title: "♻️ Reproducing",
        order: "c",
        cards: [
          "Dark mode flicker on page load",
          "Board drag-and-drop broken in Firefox",
        ],
      },
      {
        title: "⚙️ In Fix",
        order: "d",
        cards: [
          "Memory leak in websocket handler",
          "Race condition in optimistic updates",
        ],
      },
      {
        title: "🧪 Regression Testing",
        order: "e",
        cards: [
          "Verify fix on staging",
          "Run automated regression suite",
          "QA sign-off",
        ],
      },
      {
        title: "✅ Resolved",
        order: "f",
        cards: [
          "Stripe webhook signature validation fixed",
          "Profile image upload 413 error resolved",
          "Timezone offset bug in due dates closed",
        ],
      },
    ],
  },

  // ── 7. Content Calendar ───────────────────────────────────────────────────
  {
    id: "tpl-content-calendar",
    title: "Content Calendar",
    description: "Plan, produce, and publish content across all channels. Keeps writers, designers, and social media managers perfectly in sync.",
    category: "Marketing",
    lists: [
      {
        title: "💡 Content Ideas",
        order: "a",
        cards: [
          "\"How we scaled to 10k users\" case study",
          "Top 10 productivity tips for remote teams",
          "Product changelog — Q1 recap",
          "Customer spotlight: TechCorp story",
          "\"Behind the build\" engineering blog",
        ],
      },
      {
        title: "✍️ Writing",
        order: "b",
        cards: [
          "Draft blog: AI in project management",
          "Write Twitter thread on async work",
          "LinkedIn article: Engineering culture",
        ],
      },
      {
        title: "🎨 Design",
        order: "c",
        cards: [
          "Social graphics for Q2 launch",
          "Blog hero image creation",
          "Infographic: product timeline",
        ],
      },
      {
        title: "🔍 Editorial Review",
        order: "d",
        cards: [
          "SEO keyword check",
          "Grammar & clarity pass",
          "Fact-check statistics",
        ],
      },
      {
        title: "📅 Scheduled to Publish",
        order: "e",
        cards: [
          "Blog post — March 3rd",
          "Email newsletter — March 5th",
          "Twitter thread — March 7th",
        ],
      },
      {
        title: "🚀 Published",
        order: "f",
        cards: [
          "\"State of Remote Work 2025\" report",
          "Year in review blog post",
          "Product teardown video",
        ],
      },
    ],
  },

  // ── 8. Employee Onboarding ────────────────────────────────────────────────
  {
    id: "tpl-employee-onboarding",
    title: "Employee Onboarding",
    description: "30-60-90 day onboarding plan for new hires. Covers everything from hardware setup and access provisioning to culture integration and performance check-ins.",
    category: "HR",
    lists: [
      {
        title: "📦 Before Day 1",
        order: "a",
        cards: [
          "Order laptop and peripherals",
          "Set up email & Slack account",
          "Send welcome email with logistics",
          "Assign onboarding buddy",
          "Prepare desk / home office setup guide",
        ],
      },
      {
        title: "🌟 Week 1 — Settle In",
        order: "b",
        cards: [
          "Office / team tour",
          "Meet your manager (1:1)",
          "HR orientation & benefits overview",
          "Security & compliance training",
          "Read company handbook",
        ],
      },
      {
        title: "📚 Month 1 — Learn",
        order: "c",
        cards: [
          "Shadow 3 customer calls",
          "Complete product certification",
          "Meet all direct colleagues",
          "First project kick-off",
          "30-day check-in with manager",
        ],
      },
      {
        title: "🚀 Month 2 — Contribute",
        order: "d",
        cards: [
          "Own first deliverable end-to-end",
          "Present work to the team",
          "Contribute to team process improvements",
          "60-day performance conversation",
        ],
      },
      {
        title: "🎯 Month 3 — Thrive",
        order: "e",
        cards: [
          "Set 6-month OKRs",
          "Mentor newer team member",
          "90-day formal review",
          "Career development plan discussion",
        ],
      },
    ],
  },
];

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Seeding database...");

  // Create default organization
  const org = await prisma.organization.upsert({
    where: { id: "default-organization" },
    update: {},
    create: {
      id: "default-organization",
      name: "Default Organization",
      slug: "default-org",
    },
  });
  console.log("✅ Created organization:", org.name);

  // Seed global templates (orgId = null means visible to everyone)
  console.log("📋 Seeding board templates...");

  for (const tpl of TEMPLATES) {
    // Delete old version if it exists so we can re-seed cleanly
    await prisma.boardTemplate.deleteMany({ where: { id: tpl.id } });

    await prisma.boardTemplate.create({
      data: {
        id: tpl.id,
        title: tpl.title,
        description: tpl.description,
        category: tpl.category,
        orgId: null, // global — visible to all orgs
        lists: {
          create: tpl.lists.map((list) => ({
            title: list.title,
            order: list.order,
            cards: {
              create: list.cards.map((cardTitle, i) => ({
                title: cardTitle,
                order: String.fromCharCode(97 + i), // "a", "b", "c", …
              })),
            },
          })),
        },
      },
    });

    console.log(`  ✓ ${tpl.category.padEnd(12)} — ${tpl.title}`);
  }

  console.log("\n🎉 Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
