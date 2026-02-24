/**
 * TASK-021 — Public REST API: Boards
 *
 * GET  /api/v1/boards        — list all boards for the org
 * POST /api/v1/boards        — create a board
 *
 * Required scopes: boards:read (GET), boards:write (POST)
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiKey, apiError } from "@/lib/api-key-auth";
import { STRIPE_CONFIG } from "@/lib/stripe";
import { z } from "zod";

export const dynamic = "force-dynamic";

// ─── GET /api/v1/boards ────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req, ["boards:read"]);
  if (!auth.ok) return apiError(auth.message, auth.status);

  const { orgId } = auth.ctx;

  const boards = await db.board.findMany({
    where: { orgId },
    select: {
      id: true,
      title: true,
      imageThumbUrl: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { lists: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({
    data: boards.map((b) => ({
      id: b.id,
      title: b.title,
      imageThumbUrl: b.imageThumbUrl ?? null,
      listCount: b._count.lists,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    })),
    meta: { total: boards.length },
  });
}

// ─── POST /api/v1/boards ───────────────────────────────────────────────────

const CreateBoardSchema = z.object({
  title: z.string().min(1).max(100),
});

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req, ["boards:write"]);
  if (!auth.ok) return apiError(auth.message, auth.status);

  let body: unknown;
  try { body = await req.json(); }
  catch { return apiError("Invalid JSON body.", 400); }

  const parsed = CreateBoardSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 422);

  // Enforce plan-based board limits — reads from STRIPE_CONFIG so the limit
  // stays in sync with the server-action path (create-board.ts).
  const org = await db.organization.findUnique({ where: { id: auth.ctx.orgId }, select: { subscriptionPlan: true } });
  if (!org) return apiError("Organization not found.", 404);

  const planKey = org.subscriptionPlan;
  // Fail closed: if the plan value is not a known key in STRIPE_CONFIG.limits,
  // block creation rather than silently falling back to Infinity.
  if (!(planKey in STRIPE_CONFIG.limits)) {
    return apiError(`Unknown subscription plan (${planKey}). Contact support.`, 403);
  }
  const boardLimit = STRIPE_CONFIG.limits[planKey as keyof typeof STRIPE_CONFIG.limits].boards;

  // Use an atomic transaction to eliminate the TOCTOU race between count and create.
  let board: { id: string; title: string; createdAt: Date; updatedAt: Date } | null = null;
  try {
    board = await db.$transaction(async (tx) => {
      if (boardLimit !== Infinity) {
        const count = await tx.board.count({ where: { orgId: auth.ctx.orgId } });
        if (count >= boardLimit) {
          const err = new Error("plan_limit") as Error & { planKey: string; boardLimit: number };
          err.planKey = planKey;
          err.boardLimit = boardLimit;
          throw err;
        }
      }
      return tx.board.create({
        data: { title: parsed.data.title, orgId: auth.ctx.orgId },
        select: { id: true, title: true, createdAt: true, updatedAt: true },
      });
    });
  } catch (err) {
    const e = err as Error & { planKey?: string; boardLimit?: number };
    if (e.message === "plan_limit" && e.planKey !== undefined) {
      const bl = e.boardLimit ?? boardLimit;
      return apiError(
        `${e.planKey} plan limit: ${bl} board${bl === 1 ? "" : "s"}. Please upgrade your plan.`,
        403
      );
    }
    throw err;
  }

  return Response.json({ data: board }, { status: 201 });
}
