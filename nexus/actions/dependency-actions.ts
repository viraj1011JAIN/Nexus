"use server";
import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTenantContext, requireRole, isDemoContext } from "@/lib/tenant-context";
import { db } from "@/lib/db";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const AddDependencySchema = z.object({
  blockerId: z.string().uuid(),
  blockedId: z.string().uuid(),
  type: z.enum(["BLOCKS", "RELATES_TO", "DUPLICATES"] as const).default("BLOCKS"),
  boardId: z.string().uuid().optional(),
});

const RemoveDependencySchema = z.object({
  id: z.string().uuid(),
  boardId: z.string().uuid().optional(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function verifyCardOwnership(cardId: string, orgId: string) {
  const card = await db.card.findFirst({
    where: { id: cardId, list: { board: { orgId } } },
    select: { id: true, title: true },
  });
  if (!card) throw new Error("Card not found or access denied.");
  return card;
}

// ─── Cycle detection ─────────────────────────────────────────────────────────

/**
 * BFS from `blockedId` through the BLOCKS dependency graph.
 * Returns true if `blockerId` is reachable, which means adding
 * blockerId→blockedId would create a cycle (A→B→…→A).
 */
/** Hard cap on BFS nodes to prevent unbounded DB queries on adversarial graphs. */
const MAX_VISITED = 500;

async function wouldCreateCycle(
  blockerId: string,
  blockedId: string,
  orgId: string
): Promise<boolean> {
  const visited = new Set<string>([blockedId]);
  let frontier = [blockedId];

  while (frontier.length > 0) {
    if (visited.size > MAX_VISITED) {
      throw new Error(
        "Dependency graph is too large to validate safely. Reduce the number of card dependencies and try again."
      );
    }

    const edges = await db.cardDependency.findMany({
      where: {
        blockerId: { in: frontier },
        // Restrict both sides of the edge to this org to prevent cross-tenant traversal.
        blocker: { list: { board: { orgId } } },
        blocked: { list: { board: { orgId } } },
        type: "BLOCKS",
      },
      select: { blockedId: true },
    });

    const next: string[] = [];
    for (const edge of edges) {
      if (edge.blockedId === blockerId) return true; // cycle detected
      if (!visited.has(edge.blockedId)) {
        visited.add(edge.blockedId);
        next.push(edge.blockedId);
      }
    }
    frontier = next;
  }

  return false;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function getCardDependencies(cardId: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);

    const [blocking, blockedBy] = await Promise.all([
      db.cardDependency.findMany({
        where: {
          blockerId: cardId,
          blocker: { list: { board: { orgId: ctx.orgId } } },
        },
        include: {
          blocked: { select: { id: true, title: true, dueDate: true, priority: true, list: { select: { title: true } } } },
        },
      }),
      db.cardDependency.findMany({
        where: {
          blockedId: cardId,
          blocked: { list: { board: { orgId: ctx.orgId } } },
        },
        include: {
          blocker: { select: { id: true, title: true, dueDate: true, priority: true, list: { select: { title: true } } } },
        },
      }),
    ]);

    return { data: { blocking, blockedBy } };
  } catch (e) {
    console.error("[GET_DEPENDENCIES]", e);
    return { error: "Failed to load dependencies." };
  }
}

export async function addCardDependency(raw: unknown) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const input = AddDependencySchema.parse(raw);

    if (input.blockerId === input.blockedId) return { error: "A card cannot depend on itself." };

    // Verify both cards belong to this org
    await Promise.all([
      verifyCardOwnership(input.blockerId, ctx.orgId),
      verifyCardOwnership(input.blockedId, ctx.orgId),
    ]);

    // Prevent circular dependency via BFS — catches multi-hop cycles (A→B→C→A),
    // not just direct reversals. Only BLOCKS edges can form directed cycles;
    // RELATES_TO and DUPLICATES are symmetric and don't need this check.
    const circular =
      input.type === "BLOCKS" &&
      (await wouldCreateCycle(input.blockerId, input.blockedId, ctx.orgId));
    if (circular) return { error: "Adding this dependency would create a circular dependency." };

    const dep = await db.cardDependency.upsert({
      where: {
        blockerId_blockedId: { blockerId: input.blockerId, blockedId: input.blockedId },
      },
      create: {
        blockerId: input.blockerId,
        blockedId: input.blockedId,
        type: input.type,
      },
      update: { type: input.type },
    });

    revalidatePath(`/board/${input.boardId}`);
    return { data: dep };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to add dependency.";
    return { error: msg };
  }
}

export async function removeCardDependency(raw: unknown) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const input = RemoveDependencySchema.parse(raw);

    const dep = await db.cardDependency.findFirst({
      where: {
        id: input.id,
        blocker: { list: { board: { orgId: ctx.orgId } } },
      },
    });
    if (!dep) return { error: "Dependency not found." };

    await db.cardDependency.delete({ where: { id: input.id } });

    revalidatePath(`/board/${input.boardId}`);
    return { data: true };
  } catch (e) {
    console.error("[REMOVE_DEPENDENCY]", e);
    return { error: "Failed to remove dependency." };
  }
}
