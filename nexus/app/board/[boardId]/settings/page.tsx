/**
 * TASK-018 — Board Settings: Custom Field Management
 * /board/[boardId]/settings
 */

import React from "react";
import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTenantContext } from "@/lib/tenant-context";
import { createDAL } from "@/lib/dal";
import { BoardFieldsClient } from "./_components/board-fields-client";
import type { CustomField } from "./_components/board-fields-client";
import { getCustomFieldsForBoard } from "@/actions/custom-field-actions";
import Link from "next/link";
import { ArrowLeft, Settings2 } from "lucide-react";

interface BoardSettingsPageProps {
  params: Promise<{ boardId: string }>;
}

// ─── Cached board lookup (deduplicates the DB query across generateMetadata + page) ─

const getBoardCached = cache(async (boardId: string) => {
  const ctx = await getTenantContext();
  const dal = await createDAL(ctx);
  return dal.boards.findUnique(boardId, { select: { id: true, title: true } });
});

export async function generateMetadata({ params }: BoardSettingsPageProps): Promise<Metadata> {
  const { boardId } = await params;
  try {
    const board = await getBoardCached(boardId);
    return { title: `Settings — ${board?.title ?? "Board"} — Nexus` };
  } catch {
    return { title: "Board Settings — Nexus" };
  }
}

export default async function BoardSettingsPage({ params }: BoardSettingsPageProps) {
  const { boardId } = await params;

  let board: { id: string; title: string } | null | undefined;
  try {
    board = await getBoardCached(boardId);
  } catch {
    notFound();
  }
  if (!board) notFound();

  let fieldsResult: Awaited<ReturnType<typeof getCustomFieldsForBoard>>;
  try {
    fieldsResult = await getCustomFieldsForBoard(boardId);
  } catch {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-base font-medium text-destructive">Failed to load custom fields</p>
          <p className="text-sm text-muted-foreground">Please try refreshing the page.</p>
        </div>
      </div>
    );
  }
  if (fieldsResult.error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-base font-medium text-destructive">Failed to load custom fields</p>
          <p className="text-sm text-muted-foreground">Please try refreshing the page.</p>
        </div>
      </div>
    );
  }

  // Map Prisma result to the client-side CustomField shape (options is JsonValue in Prisma)
  const fields: CustomField[] = (fieldsResult.data ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    type: f.type as CustomField["type"],
    isRequired: f.isRequired,
    options: Array.isArray(f.options) ? (f.options as string[]) : null,
    order: f.order,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-white/70 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link
            href={`/board/${boardId}`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Board
          </Link>
          <div className="h-4 w-px bg-border" />
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-indigo-500" />
            {board.title} — Settings
          </h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        <BoardFieldsClient boardId={boardId} initialFields={fields} />
      </div>
    </div>
  );
}
