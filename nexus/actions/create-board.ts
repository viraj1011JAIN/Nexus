"use server";

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
    // Get or create organization
    let organization = await db.organization.findUnique({
      where: { id: orgId },
      include: { boards: true },
    });

    if (!organization) {
      organization = await db.organization.create({
        data: { id: orgId, name: "My Organization", slug: orgId.toLowerCase() },
        include: { boards: true },
      });
    }

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
      ...(data.imageLinkHTML ? { imageLinkHTML: data.imageLinkHTML } : {}),
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

    logger.info("Board created successfully", { boardId: board.id, orgId });
    revalidatePath(`/`);
    return { data: board };
  } catch (error) {
    logger.error("Failed to create board", { error });
    return { error: "Too many boards. Please upgrade your plan." };
  }
};

export const createBoard = createSafeAction(CreateBoard, handler);