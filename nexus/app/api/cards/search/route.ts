/**
 * TASK-024 — Full-Text Search API (upgraded)
 *
 * GET /api/cards/search?q=<query>&boardId=<id>&limit=20&page=1
 *
 * • Queries ≥ 3 chars: PostgreSQL FTS via to_tsquery (GIN index)
 * • Short queries: ILIKE fallback
 * • Returns ranked results with list + board context
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getTenantContext, TenantError } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

interface CardRow {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  due_date: Date | null;
  list_id: string;
  list_title: string;
  board_id: string;
  board_title: string;
  assignee_name: string | null;
  created_at: Date;
  rank: number;
}

export async function GET(request: NextRequest) {
  try {
    let orgId: string;
    try {
      const ctx = await getTenantContext();
      orgId = ctx.orgId;
    } catch (e) {
      if (e instanceof TenantError) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      throw e;
    }

    const sp      = request.nextUrl.searchParams;
    const q       = (sp.get("q") ?? "").trim();
    const boardId = sp.get("boardId") ?? undefined;
    const page    = Math.max(1, parseInt(sp.get("page")  ?? "1",  10));
    const limit   = Math.min(50,  Math.max(1, parseInt(sp.get("limit") ?? "20", 10)));
    const offset  = (page - 1) * limit;

    if (q.length < 1) {
      return NextResponse.json({ data: [], meta: { total: 0, page, limit } });
    }

    const useFts = q.length >= 3;

    let rows: CardRow[];
    let countRows: { count: bigint }[];

    if (useFts) {
      const tsQuery = q.split(/\s+/).map((w) => `${w}:*`).join(" & ");

      if (boardId) {
        [rows, countRows] = await Promise.all([
          db.$queryRaw<CardRow[]>`
            SELECT c.id, c.title, c.description, c.priority, c.due_date,
                   c.list_id, l.title AS list_title,
                   b.id AS board_id, b.title AS board_title,
                   u.name AS assignee_name, c.created_at,
                   ts_rank_cd(
                     to_tsvector('english', coalesce(c.title,'') || ' ' || coalesce(c.description,'')),
                     to_tsquery('english', ${tsQuery})
                   ) AS rank
            FROM cards c
            JOIN lists l  ON c.list_id  = l.id
            JOIN boards b ON l.board_id = b.id
            LEFT JOIN users u ON c.assignee_id = u.id
            WHERE b.org_id = ${orgId} AND b.id = ${boardId}
              AND to_tsvector('english', coalesce(c.title,'') || ' ' || coalesce(c.description,''))
                  @@ to_tsquery('english', ${tsQuery})
            ORDER BY rank DESC, c.created_at DESC
            LIMIT ${limit} OFFSET ${offset}`,
          db.$queryRaw<{ count: bigint }[]>`
            SELECT COUNT(*) AS count FROM cards c
            JOIN lists l  ON c.list_id  = l.id
            JOIN boards b ON l.board_id = b.id
            WHERE b.org_id = ${orgId} AND b.id = ${boardId}
              AND to_tsvector('english', coalesce(c.title,'') || ' ' || coalesce(c.description,''))
                  @@ to_tsquery('english', ${tsQuery})`,
        ]);
      } else {
        [rows, countRows] = await Promise.all([
          db.$queryRaw<CardRow[]>`
            SELECT c.id, c.title, c.description, c.priority, c.due_date,
                   c.list_id, l.title AS list_title,
                   b.id AS board_id, b.title AS board_title,
                   u.name AS assignee_name, c.created_at,
                   ts_rank_cd(
                     to_tsvector('english', coalesce(c.title,'') || ' ' || coalesce(c.description,'')),
                     to_tsquery('english', ${tsQuery})
                   ) AS rank
            FROM cards c
            JOIN lists l  ON c.list_id  = l.id
            JOIN boards b ON l.board_id = b.id
            LEFT JOIN users u ON c.assignee_id = u.id
            WHERE b.org_id = ${orgId}
              AND to_tsvector('english', coalesce(c.title,'') || ' ' || coalesce(c.description,''))
                  @@ to_tsquery('english', ${tsQuery})
            ORDER BY rank DESC, c.created_at DESC
            LIMIT ${limit} OFFSET ${offset}`,
          db.$queryRaw<{ count: bigint }[]>`
            SELECT COUNT(*) AS count FROM cards c
            JOIN lists l  ON c.list_id  = l.id
            JOIN boards b ON l.board_id = b.id
            WHERE b.org_id = ${orgId}
              AND to_tsvector('english', coalesce(c.title,'') || ' ' || coalesce(c.description,''))
                  @@ to_tsquery('english', ${tsQuery})`,
        ]);
      }
    } else {
      const pattern = `%${q}%`;

      if (boardId) {
        [rows, countRows] = await Promise.all([
          db.$queryRaw<CardRow[]>`
            SELECT c.id, c.title, c.description, c.priority, c.due_date,
                   c.list_id, l.title AS list_title, b.id AS board_id, b.title AS board_title,
                   u.name AS assignee_name, c.created_at, 1.0 AS rank
            FROM cards c JOIN lists l ON c.list_id = l.id JOIN boards b ON l.board_id = b.id
            LEFT JOIN users u ON c.assignee_id = u.id
            WHERE b.org_id = ${orgId} AND b.id = ${boardId}
              AND (c.title ILIKE ${pattern} OR c.description ILIKE ${pattern})
            ORDER BY c.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
          db.$queryRaw<{ count: bigint }[]>`
            SELECT COUNT(*) AS count FROM cards c
            JOIN lists l ON c.list_id = l.id JOIN boards b ON l.board_id = b.id
            WHERE b.org_id = ${orgId} AND b.id = ${boardId}
              AND (c.title ILIKE ${pattern} OR c.description ILIKE ${pattern})`,
        ]);
      } else {
        [rows, countRows] = await Promise.all([
          db.$queryRaw<CardRow[]>`
            SELECT c.id, c.title, c.description, c.priority, c.due_date,
                   c.list_id, l.title AS list_title, b.id AS board_id, b.title AS board_title,
                   u.name AS assignee_name, c.created_at, 1.0 AS rank
            FROM cards c JOIN lists l ON c.list_id = l.id JOIN boards b ON l.board_id = b.id
            LEFT JOIN users u ON c.assignee_id = u.id
            WHERE b.org_id = ${orgId}
              AND (c.title ILIKE ${pattern} OR c.description ILIKE ${pattern})
            ORDER BY c.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
          db.$queryRaw<{ count: bigint }[]>`
            SELECT COUNT(*) AS count FROM cards c
            JOIN lists l ON c.list_id = l.id JOIN boards b ON l.board_id = b.id
            WHERE b.org_id = ${orgId}
              AND (c.title ILIKE ${pattern} OR c.description ILIKE ${pattern})`,
        ]);
      }
    }

    const total = Number(countRows[0]?.count ?? 0);

    return NextResponse.json({
      data: rows.map((r) => ({
        id:           r.id,
        title:        r.title,
        description:  r.description,
        priority:     r.priority,
        dueDate:      r.due_date,
        listId:       r.list_id,
        listTitle:    r.list_title,
        boardId:      r.board_id,
        boardTitle:   r.board_title,
        assigneeName: r.assignee_name,
        createdAt:    r.created_at,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error("Failed to search cards", { error });
    return NextResponse.json({ error: "Failed to search cards" }, { status: 500 });
  }
}
