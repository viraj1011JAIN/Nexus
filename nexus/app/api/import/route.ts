/**
 * TASK-026 — Import/Export API: Import Endpoint
 *
 * POST /api/import
 * Content-Type: application/json
 * Body: { format: "nexus" | "trello", data: <JSON export> }
 *
 * Returns: { boardId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth }                     from "@clerk/nextjs/server";
import { importFromJSON, importFromTrello } from "@/actions/import-export-actions";
import { z } from "zod";

export const dynamic = "force-dynamic";

const ImportSchema = z.object({
  format: z.enum(["nexus", "trello"]),
  data:   z.unknown(),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = ImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 });
  }

  const { format, data } = parsed.data;

  let result: { data?: { boardId: string }; error?: string };

  if (format === "nexus") {
    result = await importFromJSON(data);
  } else {
    result = await importFromTrello(data);
  }

  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ boardId: result.data?.boardId }, { status: 201 });
}
