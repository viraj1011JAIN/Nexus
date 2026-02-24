/**
 * TASK-027 — Integrations Hub: GitHub Webhook Handler
 *
 * POST /api/integrations/github
 *
 * Listens for GitHub webhook events:
 *   - push                          → creates AuditLog entry per card referenced in commit messages (#CARD-ID)
 *   - pull_request opened/closed    → creates AuditLog entry per referenced card
 *   - pull_request closed + merged  → moves referenced cards to the board's Done/Complete list
 *
 * Webhook secret: GITHUB_WEBHOOK_SECRET env var
 */

import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db";
import { generateNextOrder }          from "@/lib/lexorank";
import crypto                        from "crypto";

export const dynamic = "force-dynamic";

function verifySignature(payload: string, sig: string | null, secret: string): boolean {
  if (!sig) return false;
  const expected = `sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

// Extract Nexus card IDs from text — patterns: nexus-<id>, card-<id>, or plain UUIDs preceded by #
const CARD_REF_RE = /(?:nexus-|card-|#)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;

function extractCardIds(text: string): string[] {
  const ids: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = CARD_REF_RE.exec(text)) !== null) ids.push(m[1]);
  return [...new Set(ids)];
}

export async function POST(req: NextRequest) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET ?? "";
  const rawBody = await req.text();
  const sig     = req.headers.get("x-hub-signature-256");

  if (secret && !verifySignature(rawBody, sig, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event   = req.headers.get("x-github-event") ?? "";
  const payload = JSON.parse(rawBody) as Record<string, unknown>;

  if (event === "push") {
    const commits = (payload.commits as { message: string; url: string; id: string }[]) ?? [];
    await Promise.allSettled(
      commits.flatMap((commit) => {
        const ids = extractCardIds(commit.message);
        return ids.map((cardId) =>
          db.auditLog.create({
            data: {
              entityId:    cardId,
              entityTitle: `GitHub commit: ${commit.message.slice(0, 80)}`,
              entityType:  "CARD",
              action:      "UPDATE",
              orgId:       (payload.repository as { owner?: { login?: string } })?.owner?.login ?? "github",
              userId:      "github-webhook",
              userImage:   "",
              userName:    "GitHub Webhook",
            },
          }).catch(() => null)
        );
      })
    );
    return NextResponse.json({ ok: true, processed: commits.length });
  }

  if (event === "pull_request") {
    const pr     = payload.pull_request as { title: string; html_url: string; state: string; merged: boolean; body?: string } | undefined;
    const action = payload.action as string | undefined;

    if (pr && (action === "opened" || action === "closed")) {
      const cardIds = extractCardIds(pr.title + " " + (pr.body ?? "") + " " + (payload.body as string ?? ""));

      if (action === "closed" && pr.merged) {
        // PR merged — move referenced cards to the board's Done/Complete list
        await Promise.allSettled(
          cardIds.map(async (cardId) => {
            try {
              const card = await db.card.findUnique({
                where: { id: cardId },
                include: { list: { include: { board: true } } },
              });
              if (!card) return null;

              const doneList = await db.list.findFirst({
                where: {
                  boardId: card.list.boardId,
                  OR: [
                    { title: { contains: "done",     mode: "insensitive" } },
                    { title: { contains: "complete",  mode: "insensitive" } },
                    { title: { contains: "merged",    mode: "insensitive" } },
                  ],
                },
              });
              if (!doneList || doneList.id === card.listId) return null;

              // Place card at end of target list
              const lastCard = await db.card.findFirst({
                where:   { listId: doneList.id },
                orderBy: { order: "desc" },
                select:  { order: true },
              });
              const newOrder = generateNextOrder(lastCard?.order ?? null);

              await db.card.update({
                where: { id: cardId },
                data:  { listId: doneList.id, order: newOrder },
              });

              await db.auditLog.create({
                data: {
                  entityId:    cardId,
                  entityTitle: `Moved to "${doneList.title}" on PR merge: ${pr.title.slice(0, 60)}`,
                  entityType:  "CARD",
                  action:      "UPDATE",
                  orgId:       card.list.board.orgId,
                  userId:      "github-webhook",
                  userImage:   "",
                  userName:    "GitHub (PR merged)",
                },
              });
            } catch {
              return null;
            }
          })
        );
      } else {
        // Opened, or closed without merge — create audit log entries only
        await Promise.allSettled(
          cardIds.map((cardId) =>
            db.auditLog.create({
              data: {
                entityId:    cardId,
                entityTitle: `GitHub PR ${action}: ${pr.title.slice(0, 80)}`,
                entityType:  "CARD",
                action:      action === "closed" ? "UPDATE" : "CREATE",
                orgId:       "github-webhook",
                userId:      "github-webhook",
                userImage:   "",
                userName:    "GitHub Webhook",
              },
            }).catch(() => null)
          )
        );
      }
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true, event, note: "Event not handled" });
}
