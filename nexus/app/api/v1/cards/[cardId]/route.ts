/**
 * TASK-021 — Public REST API: Single Card
 *
 * GET    /api/v1/cards/:cardId   — get card details
 * PATCH  /api/v1/cards/:cardId   — update card
 * DELETE /api/v1/cards/:cardId   — delete card
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiKey, apiError } from "@/lib/api-key-auth";
import { z } from "zod";
import { Priority } from "@prisma/client";

export const dynamic = "force-dynamic";

// Resolve card and ensure it belongs to org
async function resolveCard(cardId: string, orgId: string) {
  return db.card.findFirst({
    where: { id: cardId, list: { board: { orgId } } },
    select: {
      id: true, title: true, description: true, priority: true,
      dueDate: true, startDate: true, storyPoints: true, order: true,
      createdAt: true, updatedAt: true, listId: true, assigneeId: true,
      list: { select: { id: true, title: true, board: { select: { id: true, title: true } } } },
      assignee: { select: { id: true, name: true, imageUrl: true } },
    },
  });
}

// ─── GET /api/v1/cards/:cardId ────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const auth = await authenticateApiKey(req, ["cards:read"]);
  if (!auth.ok) return apiError(auth.message, auth.status);

  const { cardId } = await params;
  const card = await resolveCard(cardId, auth.ctx.orgId);
  if (!card) return apiError("Card not found.", 404);

  return Response.json({ data: card });
}

// ─── PATCH /api/v1/cards/:cardId ─────────────────────────────────────────

const PatchCardSchema = z.object({
  title:       z.string().min(1).max(255).optional(),
  description: z.string().max(10000).optional().nullable(),
  priority:    z.nativeEnum(Priority).optional(),
  dueDate:     z.string().datetime().optional().nullable(),
  startDate:   z.string().datetime().optional().nullable(),
  assigneeId:  z.string().uuid().optional().nullable(),
  listId:      z.string().uuid("listId must be a UUID").optional(),
  storyPoints: z.number().int().min(0).max(999).optional().nullable(),
}).refine((d) => Object.keys(d).length > 0, { message: "Body must include at least one field." });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const auth = await authenticateApiKey(req, ["cards:write"]);
  if (!auth.ok) return apiError(auth.message, auth.status);

  const { cardId } = await params;
  const card = await resolveCard(cardId, auth.ctx.orgId);
  if (!card) return apiError("Card not found.", 404);

  let body: unknown;
  try { body = await req.json(); }
  catch { return apiError("Invalid JSON body.", 400); }

  const parsed = PatchCardSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 422);

  // If moving to a different list, ensure that list belongs to same org
  if (parsed.data.listId && parsed.data.listId !== card.listId) {
    const targetList = await db.list.findFirst({
      where: { id: parsed.data.listId, board: { orgId: auth.ctx.orgId } },
      select: { id: true },
    });
    if (!targetList) return apiError("Target list not found or does not belong to your organization.", 404);
  }

  const updated = await db.card.update({
    where: { id: cardId },
    data: {
      ...(parsed.data.title        !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.description  !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.priority     !== undefined ? { priority: parsed.data.priority } : {}),
      ...(parsed.data.dueDate      !== undefined ? { dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null } : {}),
      ...(parsed.data.startDate    !== undefined ? { startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null } : {}),
      ...(parsed.data.assigneeId   !== undefined ? { assigneeId: parsed.data.assigneeId } : {}),
      ...(parsed.data.listId       !== undefined ? { listId: parsed.data.listId } : {}),
      ...(parsed.data.storyPoints  !== undefined ? { storyPoints: parsed.data.storyPoints } : {}),
    },
    select: {
      id: true, title: true, description: true, priority: true,
      dueDate: true, startDate: true, storyPoints: true,
      listId: true, assigneeId: true, updatedAt: true,
    },
  });

  return Response.json({ data: updated });
}

// ─── DELETE /api/v1/cards/:cardId ─────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const auth = await authenticateApiKey(req, ["cards:write"]);
  if (!auth.ok) return apiError(auth.message, auth.status);

  const { cardId } = await params;
  const card = await resolveCard(cardId, auth.ctx.orgId);
  if (!card) return apiError("Card not found.", 404);

  await db.card.delete({ where: { id: cardId } });

  return new Response(null, { status: 204 });
}
