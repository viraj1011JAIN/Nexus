"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext, requireRole } from "@/lib/tenant-context";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

// ─── Built-in seeded templates ────────────────────────────────────────────────

export interface TemplateSummary {
  id: string;
  title: string;
  description: string | null;
  category: string;
  imageThumbUrl: string | null;
  listCount: number;
}

export interface TemplateDetail extends TemplateSummary {
  lists: {
    id: string;
    title: string;
    order: string;
    cards: { id: string; title: string; order: string }[];
  }[];
}

/** Returns all templates visible to the current org (global + org-specific). */
export async function getTemplates(): Promise<{ data?: TemplateSummary[]; error?: string }> {
  const ctx = await getTenantContext();

  const templates = await db.boardTemplate.findMany({
    where: {
      OR: [{ orgId: null }, { orgId: ctx.orgId }],
    },
    include: { _count: { select: { lists: true } } },
    orderBy: [{ orgId: "asc" }, { title: "asc" }],
  });

  return {
    data: templates.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      category: t.category,
      imageThumbUrl: t.imageThumbUrl,
      listCount: t._count.lists,
    })),
  };
}

/** Returns a single template with full list+card structure. */
export async function getTemplateById(
  templateId: string
): Promise<{ data?: TemplateDetail; error?: string }> {
  const ctx = await getTenantContext();

  const template = await db.boardTemplate.findFirst({
    where: {
      id: templateId,
      OR: [{ orgId: null }, { orgId: ctx.orgId }],
    },
    include: {
      lists: {
        include: { cards: true },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!template) return { error: "Template not found" };

  return {
    data: {
      id: template.id,
      title: template.title,
      description: template.description,
      category: template.category,
      imageThumbUrl: template.imageThumbUrl,
      listCount: template.lists.length,
      lists: template.lists.map((l) => ({
        id: l.id,
        title: l.title,
        order: l.order,
        cards: l.cards.map((c) => ({ id: c.id, title: c.title, order: c.order })),
      })),
    },
  };
}

/**
 * Creates a board from a template.
 * Copies all lists and cards, assigns new IDs, keeps order.
 */
export async function createBoardFromTemplate(opts: {
  templateId: string;
  title: string;
  imageId?: string;
  imageThumbUrl?: string;
  imageFullUrl?: string;
  imageUserName?: string;
  imageLinkHTML?: string;
}): Promise<{ data?: { boardId: string }; error?: string }> {
  const ctx = await getTenantContext();
  await requireRole("MEMBER", ctx);

  const templateResult = await getTemplateById(opts.templateId);
  if (templateResult.error || !templateResult.data) {
    return { error: templateResult.error ?? "Template not found" };
  }

  const template = templateResult.data;

  try {
    const board = await db.board.create({
      data: {
        title: opts.title,
        orgId: ctx.orgId,
        imageId: opts.imageId,
        imageThumbUrl: opts.imageThumbUrl,
        imageFullUrl: opts.imageFullUrl,
        imageUserName: opts.imageUserName,
        imageLinkHTML: opts.imageLinkHTML,
      },
    });

    // Create lists with their cards in sequence (LexoRank preserved from template)
    for (const list of template.lists) {
      const createdList = await db.list.create({
        data: {
          title: list.title,
          order: list.order,
          boardId: board.id,
        },
      });

      if (list.cards.length > 0) {
        await db.card.createMany({
          data: list.cards.map((c) => ({
            title: c.title,
            order: c.order,
            listId: createdList.id,
          })),
        });
      }
    }

    await db.auditLog.create({
      data: {
        orgId: ctx.orgId,
        entityId: board.id,
        entityType: "BOARD",
        entityTitle: board.title,
        action: "CREATE",
        userId: ctx.userId,
        userImage: "",
        userName: "System",
      },
    });

    logger.info("Board created from template", {
      boardId: board.id,
      templateId: opts.templateId,
      orgId: ctx.orgId,
    });

    revalidatePath("/dashboard");
    return { data: { boardId: board.id } };
  } catch (error) {
    logger.error("Failed to create board from template", { error });
    return { error: "Failed to create board from template" };
  }
}

/** Seed built-in templates if they don't exist yet. Called from a server action / admin route. */
export async function seedBuiltInTemplates(): Promise<void> {
  const BUILT_IN: Array<{
    title: string;
    description: string;
    category: string;
    lists: Array<{ title: string; cards: string[] }>;
  }> = [
    {
      title: "Kanban Board",
      description: "Classic Kanban layout for continuous delivery workflows.",
      category: "Engineering",
      lists: [
        { title: "Backlog", cards: ["Write requirements", "Research solutions"] },
        { title: "In Progress", cards: ["Feature: login flow"] },
        { title: "Review", cards: [] },
        { title: "Done", cards: [] },
      ],
    },
    {
      title: "Sprint Planning",
      description: "Two-week sprint structure with a clear backlog and review stage.",
      category: "Engineering",
      lists: [
        { title: "Sprint Backlog", cards: ["User story 1", "User story 2", "User story 3"] },
        { title: "In Development", cards: [] },
        { title: "QA / Testing", cards: [] },
        { title: "Completed", cards: [] },
      ],
    },
    {
      title: "Marketing Campaign",
      description: "Plan, execute, and measure a marketing campaign end-to-end.",
      category: "Marketing",
      lists: [
        { title: "Ideas", cards: ["Blog post ideas", "Social media calendar"] },
        { title: "Content Creation", cards: [] },
        { title: "Design Review", cards: [] },
        { title: "Published", cards: [] },
      ],
    },
    {
      title: "Product Roadmap",
      description: "High-level product planning across Now, Next, and Later horizons.",
      category: "Product",
      lists: [
        {
          title: "Now",
          cards: ["Core feature launch", "Bug fixes", "Performance improvements"],
        },
        { title: "Next", cards: ["Analytics dashboard", "Mobile app"] },
        { title: "Later", cards: ["Enterprise tier", "API integrations"] },
        { title: "Shipped", cards: [] },
      ],
    },
    {
      title: "Design System",
      description: "Track component creation, review, and documentation.",
      category: "Design",
      lists: [
        { title: "To Design", cards: ["Button variants", "Form inputs", "Modal pattern"] },
        { title: "Designing", cards: [] },
        { title: "Dev Handoff", cards: [] },
        { title: "In Library", cards: [] },
      ],
    },
    {
      title: "Hiring Pipeline",
      description: "Manage job applications from first contact to offer.",
      category: "HR",
      lists: [
        { title: "Applied", cards: ["Candidate 1", "Candidate 2"] },
        { title: "Phone Screen", cards: [] },
        { title: "Technical Interview", cards: [] },
        { title: "Final Interview", cards: [] },
        { title: "Offer", cards: [] },
      ],
    },
  ];

  for (const t of BUILT_IN) {
    const exists = await db.boardTemplate.findFirst({ where: { title: t.title, orgId: null } });
    if (exists) continue;

    const listData = t.lists.map((l, li) => {
      const listOrder = String.fromCharCode("a".charCodeAt(0) + li);
      return {
        title: l.title,
        order: listOrder,
        cards: {
          create: l.cards.map((c, ci) => ({
            title: c,
            order: String.fromCharCode("a".charCodeAt(0) + ci),
          })),
        },
      };
    });

    await db.boardTemplate.create({
      data: {
        title: t.title,
        description: t.description,
        category: t.category,
        orgId: null, // global / built-in
        lists: { create: listData },
      },
    });
  }
}
