/**
 * TASK-021 — Public REST API: Cards
 *
 * GET  /api/v1/cards                 — list cards (filter by boardId, listId, assigneeId, priority)
 * POST /api/v1/cards                 — create a card
 *
 * Required scopes: cards:read (GET), cards:write (POST)
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiKey, apiError } from "@/lib/api-key-auth";
import { z } from "zod";
import { Priority } from "@prisma/client";

export const dynamic = "force-dynamic";

// ─── GET /api/v1/cards ────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req, ["cards:read"]);
  if (!auth.ok) return apiError(auth.message, auth.status);

  const { orgId } = auth.ctx;
  const sp = req.nextUrl.searchParams;

  const boardId    = sp.get("boardId") ?? undefined;
  const listId     = sp.get("listId")  ?? undefined;
  const assigneeId = sp.get("assigneeId") ?? undefined;
  const priority   = sp.get("priority") as Priority | undefined;
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") ?? "50", 10)));

  const where = {
    list: {
      board: {
        orgId,
        ...(boardId ? { id: boardId } : {}),
      },
      ...(listId ? { id: listId } : {}),
    },
    ...(assigneeId ? { assigneeId } : {}),
    ...(priority && Object.values(Priority).includes(priority) ? { priority } : {}),
  };

  const [cards, total] = await Promise.all([
    db.card.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        dueDate: true,
        startDate: true,
        storyPoints: true,
        createdAt: true,
        updatedAt: true,
        list: { select: { id: true, title: true, board: { select: { id: true, title: true } } } },
        assignee: { select: { id: true, name: true, imageUrl: true } },
      },
      orderBy: { order: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.card.count({ where }),
  ]);

  return Response.json({
    data: cards,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
}

// ─── POST /api/v1/cards ───────────────────────────────────────────────────

const CreateCardSchema = z.object({
  title:      z.string().min(1).max(255),
  listId:     z.string().uuid("listId must be a UUID"),
  priority:   z.nativeEnum(Priority).optional(),
  dueDate:    z.string().datetime().optional(),
  assigneeId: z.string().uuid().optional(),
  storyPoints: z.number().int().min(0).max(999).optional(),
  description: z.string().max(10000).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req, ["cards:write"]);
  if (!auth.ok) return apiError(auth.message, auth.status);

  let body: unknown;
  try { body = await req.json(); }
  catch { return apiError("Invalid JSON body.", 400); }

  const parsed = CreateCardSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 422);

  // Verify list belongs to org
  const list = await db.list.findFirst({
    where: { id: parsed.data.listId, board: { orgId: auth.ctx.orgId } },
    select: { id: true },
  });
  if (!list) return apiError("List not found or does not belong to your organization.", 404);

  // Compute next order (append to end)
  const lastCard = await db.card.findFirst({
    where: { listId: parsed.data.listId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const order = lastCard ? lastCard.order + "z" : "m";

  const card = await db.card.create({
    data: {
      title:       parsed.data.title,
      listId:      parsed.data.listId,
      priority:    parsed.data.priority ?? "MEDIUM",
      dueDate:     parsed.data.dueDate   ? new Date(parsed.data.dueDate) : undefined,
      assigneeId:  parsed.data.assigneeId,
      storyPoints: parsed.data.storyPoints,
      description: parsed.data.description,
      order,
    },
    select: {
      id: true, title: true, priority: true, dueDate: true,
      listId: true, assigneeId: true, createdAt: true,
    },
  });

  return Response.json({ data: card }, { status: 201 });
}
