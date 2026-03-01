"use server";
import "server-only";

import { revalidatePath } from "next/cache";
import { getTenantContext, requireRole, isDemoContext } from "@/lib/tenant-context";
import { createDAL } from "@/lib/dal";
import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { CreateBoard } from "./schema";
import { ActionState } from "@/lib/create-safe-action";
import { z } from "zod";
import { Board } from "@prisma/client";
import { logger } from "@/lib/logger";
import { STRIPE_CONFIG } from "@/lib/stripe";
import { checkRateLimit, RATE_LIMITS } from "@/lib/action-protection";
import { createBoardFromTemplate } from "@/actions/template-actions";
import { clearPermissionCache } from "@/lib/board-permissions";

type InputType = z.infer<typeof CreateBoard>;
type ReturnType = ActionState<InputType, Board>;

const handler = async (data: InputType): Promise<ReturnType> => {
  const ctx = await getTenantContext();
  await requireRole("MEMBER", ctx);

  const rl = checkRateLimit(ctx.userId, "create-board", RATE_LIMITS["create-board"]);
  if (!rl.allowed) {
    return { error: `Too many requests. Try again in ${Math.ceil(rl.resetInMs / 1000)}s.` };
  }

  const dal = await createDAL(ctx);

  if (isDemoContext(ctx)) {
    return { error: "Cannot create boards in demo mode." };
  }

  const { orgId } = ctx;

  try {
    // Get or create organization — upsert avoids a race condition where two
    // concurrent first-time requests both find no row and both try to create one.
    const organization = await db.organization.upsert({
      where:  { id: orgId },
      update: {},
      create: { id: orgId, name: "My Organization", slug: orgId.toLowerCase() },
      include: { boards: true },
    });

    const currentBoardCount = organization.boards.length;
    const boardLimit = STRIPE_CONFIG.limits[organization.subscriptionPlan as "FREE" | "PRO"]?.boards || STRIPE_CONFIG.limits.FREE.boards;

    if (currentBoardCount >= boardLimit) {
      return { 
        error: "LIMIT_REACHED",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { limit: boardLimit, current: currentBoardCount } as any,
      };
    }

    const imageFields = {
      ...(data.imageId       ? { imageId: data.imageId } : {}),
      ...(data.imageThumbUrl ? { imageThumbUrl: data.imageThumbUrl } : {}),
      ...(data.imageFullUrl  ? { imageFullUrl: data.imageFullUrl } : {}),
      ...(data.imageUserName ? { imageUserName: data.imageUserName } : {}),
      ...(data.imageLinkUrl ? { imageLinkHTML: data.imageLinkUrl } : {}),
    };

    let board: Board;

    if (data.templateId) {
      // Create board populated from template (handles lists + cards + audit log internally)
      const tmplResult = await createBoardFromTemplate({
        templateId: data.templateId,
        title: data.title,
        ...imageFields,
      });

      if (tmplResult.error || !tmplResult.data) {
        return { error: tmplResult.error ?? "Failed to create board from template" };
      }

      const created = await db.board.findUnique({ where: { id: tmplResult.data.boardId } });
      if (!created) return { error: "Board creation failed" };
      board = created;
    } else {
      // Blank board — DAL injects orgId server-side
      board = await dal.boards.create({ title: data.title, ...imageFields });

      await dal.auditLogs.create({
        entityId: board.id,
        entityType: "BOARD",
        entityTitle: board.title,
        action: "CREATE",
      });
    }

    // ── RBAC: Auto-add the creator as board OWNER ──
    // This is the ONLY way to become the first board member.
    // Without this, strict isolation means nobody can access the board.
    try {
      await db.boardMember.create({
        data: {
          boardId: board.id,
          userId: ctx.internalUserId,
          orgId: ctx.orgId,
          role: "OWNER",
          invitedAt: new Date(),
          joinedAt: new Date(),
        },
      });
      clearPermissionCache();
    } catch (memberError) {
      // If board member creation fails, delete the board to avoid an orphaned board
      // that nobody can access.
      logger.error("Failed to create board member for creator — rolling back board", { error: memberError, boardId: board.id });
      await db.board.delete({ where: { id: board.id } }).catch(() => {});
      return { error: "Failed to create board. Please try again." };
    }

    logger.info("Board created successfully", { boardId: board.id, orgId });
    revalidatePath(`/`);
    return { data: board };
  } catch (error) {
    logger.error("Failed to create board", { error });
    return { error: "Too many boards. Please upgrade your plan." };
  }
};

export const createBoard = createSafeAction(CreateBoard, handler);