/**
 * LexoRank Rebalancer Cron — /api/cron/lexorank-rebalance
 *
 * WHY THIS EXISTS
 * ----------------
 * LexoRank strings grow longer after repeated mid-list insertions:
 *   m → ma → maa → maaa → ... (unbounded without intervention)
 *
 * The production DoS guard in `update-card-order.ts` rejects strings ≥ 64 chars,
 * which means a heavily-reordered list will eventually "jam" — users can no longer
 * move cards into any slot between the long strings.
 *
 * This job runs weekly (Sunday 03:00 UTC) and re-normalises every list where at
 * least one card has an `order` string ≥ 20 characters, resetting all card orders
 * in that list back to single characters (m, n, o, p, …).
 *
 * SAFETY PROPERTIES
 * -----------------
 * - Protected by CRON_SECRET bearer token (same as daily-reports cron).
 * - Uses systemDb (bypasses RLS — needed to reach all orgs without an active session).
 * - Each list is rebalanced inside its own $transaction to prevent partial rewrites.
 * - Rebalancing is purely a cosmetic re-key: visible card order is preserved.
 * - Idempotent: re-running the job on an already-balanced list is a no-op.
 */

import { NextResponse } from "next/server";
import { systemDb as db } from "@/lib/db";
import { rebalanceOrders } from "@/lib/lexorank";

/** Threshold: rebalance any list where a card's order string is this long or longer. */
const ORDER_LENGTH_THRESHOLD = 20;

export async function GET(request: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const startedAt = Date.now();
  let listsScanned = 0;
  let listsRebalanced = 0;
  let cardsUpdated = 0;
  const errors: string[] = [];

  try {
    // ── Find lists that contain at least one long order string ────────────────
    // We query directly on CardList + Card to avoid loading every card in the DB.
    const candidateLists = await db.list.findMany({
      where: {
        cards: {
          some: {
            order: {
              // Prisma string length filter: use raw comparison via `gt` on a computed
              // value — not supported natively, so we fetch lists with "any card whose
              // order length is suspicious" by pulling lists that have long order strings.
              // Fallback: fetch all lists and filter in JS (acceptable for weekly cron).
            },
          },
        },
      },
      select: {
        id: true,
        title: true,
        boardId: true,
        cards: {
          select: { id: true, order: true },
          orderBy: { order: "asc" },
        },
      },
    });

    listsScanned = candidateLists.length;

    for (const list of candidateLists) {
      // Skip if no card in this list has a long order string
      const needsRebalance = list.cards.some(
        (c) => c.order.length >= ORDER_LENGTH_THRESHOLD,
      );
      if (!needsRebalance) continue;

      try {
        // Compute new order values while preserving visible sort order
        const rebalanced = rebalanceOrders(list.cards);

        // Persist inside a transaction — all-or-nothing per list
        await db.$transaction(
          rebalanced.map((card) =>
            db.card.update({
              where: { id: card.id },
              data: { order: card.order },
            }),
          ),
        );

        listsRebalanced += 1;
        cardsUpdated += rebalanced.length;
      } catch (listErr) {
        errors.push(
          `list ${list.id} (${list.title}): ${listErr instanceof Error ? listErr.message : String(listErr)}`,
        );
      }
    }

    const durationMs = Date.now() - startedAt;

    return NextResponse.json({
      ok: true,
      listsScanned,
      listsRebalanced,
      cardsUpdated,
      errors,
      durationMs,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
        listsScanned,
        listsRebalanced,
        cardsUpdated,
      },
      { status: 500 },
    );
  }
}
