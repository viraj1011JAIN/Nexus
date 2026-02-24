/**
 * TASK-021 — Public REST API: Board Detail
 *
 * GET    /api/v1/boards/[boardId]  — get board with lists and cards
 * PATCH  /api/v1/boards/[boardId]  — update board title
 * DELETE /api/v1/boards/[boardId]  — delete board
 *
 * Required scopes: boards:read (GET), boards:write (PATCH/DELETE)
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiKey, apiError } from "@/lib/api-key-auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

// ─── GET /api/v1/boards/[boardId] ─────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const auth = await authenticateApiKey(req, ["boards:read"]);
  if (!auth.ok) return apiError(auth.message, auth.status);

  const { boardId } = await params;

  const board = await db.board.findFirst({
    where: { id: boardId, orgId: auth.ctx.orgId },
    include: {
      lists: {
        orderBy: { order: "asc" },
        include: {
          cards: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              title: true,
              priority: true,
              dueDate: true,
              startDate: true,
              storyPoints: true,
              assignee: { select: { id: true, name: true, imageUrl: true } },
            },
          },
        },
      },
    },
  });

  if (!board) return apiError("Board not found.", 404);

  return Response.json({ data: board });
}

// ─── PATCH /api/v1/boards/[boardId] ───────────────────────────────────────

const UpdateBoardSchema = z.object({
  title: z.string().min(1).max(100).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const auth = await authenticateApiKey(req, ["boards:write"]);
  if (!auth.ok) return apiError(auth.message, auth.status);

  const { boardId } = await params;

  const existing = await db.board.findFirst({ where: { id: boardId, orgId: auth.ctx.orgId } });
  if (!existing) return apiError("Board not found.", 404);

  let body: unknown;
  try { body = await req.json(); }
  catch { return apiError("Invalid JSON body.", 400); }

  const parsed = UpdateBoardSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 422);

  const board = await db.board.update({
    where: { id: boardId },
    data: { ...(parsed.data.title && { title: parsed.data.title }) },
    select: { id: true, title: true, updatedAt: true },
  });

  return Response.json({ data: board });
}

// ─── DELETE /api/v1/boards/[boardId] ──────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const auth = await authenticateApiKey(req, ["boards:write"]);
  if (!auth.ok) return apiError(auth.message, auth.status);

  const { boardId } = await params;

  const existing = await db.board.findFirst({ where: { id: boardId, orgId: auth.ctx.orgId } });
  if (!existing) return apiError("Board not found.", 404);

  await db.board.delete({ where: { id: boardId } });

  return new Response(null, { status: 204 });
}
