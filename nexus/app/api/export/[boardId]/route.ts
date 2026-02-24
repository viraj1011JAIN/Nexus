/**
 * TASK-026 — Import/Export API: Export Endpoint
 *
 * GET /api/export/[boardId]?format=json|csv
 *
 * Returns the board as a downloadable file.
 */

import { NextRequest } from "next/server";
import { auth }        from "@clerk/nextjs/server";
import { exportBoardAsJSON, exportBoardAsCSV } from "@/actions/import-export-actions";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { boardId } = await params;
  const format = req.nextUrl.searchParams.get("format") ?? "json";

  if (format === "csv") {
    const result = await exportBoardAsCSV(boardId);
    if (result.error) return Response.json({ error: result.error }, { status: 404 });

    return new Response(result.data, {
      headers: {
        "Content-Type":        "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      },
    });
  }

  // Default: JSON
  const result = await exportBoardAsJSON(boardId);
  if (result.error) return Response.json({ error: result.error }, { status: 404 });

  const json     = JSON.stringify(result.data, null, 2);
  const filename = `nexus-board-${boardId}-export.json`;

  return new Response(json, {
    headers: {
      "Content-Type":        "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
