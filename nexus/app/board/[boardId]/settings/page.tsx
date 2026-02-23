/**
 * TASK-018 — Board Settings: Custom Field Management
 * /board/[boardId]/settings
 */

import { notFound } from "next/navigation";
import { getTenantContext } from "@/lib/tenant-context";
import { createDAL } from "@/lib/dal";
import { BoardFieldsClient } from "./_components/board-fields-client";
import { getCustomFieldsForBoard } from "@/actions/custom-field-actions";
import Link from "next/link";
import { ArrowLeft, Settings2 } from "lucide-react";

interface BoardSettingsPageProps {
  params: Promise<{ boardId: string }>;
}

export async function generateMetadata({ params }: BoardSettingsPageProps) {
  const { boardId } = await params;
  const ctx = await getTenantContext();
  const dal = await createDAL(ctx);
  try {
    const board = await dal.boards.findUnique(boardId, { select: { title: true } });
    return { title: `Settings — ${board?.title ?? "Board"} — Nexus` };
  } catch {
    return { title: "Board Settings — Nexus" };
  }
}

export default async function BoardSettingsPage({ params }: BoardSettingsPageProps) {
  const { boardId } = await params;
  const ctx = await getTenantContext();
  const dal = await createDAL(ctx);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let board: any;
  try {
    board = await dal.boards.findUnique(boardId, { select: { id: true, title: true } });
  } catch {
    notFound();
  }
  if (!board) notFound();

  const fieldsResult = await getCustomFieldsForBoard(boardId);
  if (fieldsResult.error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-base font-medium text-destructive">Failed to load custom fields</p>
          <p className="text-sm text-muted-foreground">{fieldsResult.error}</p>
        </div>
      </div>
    );
  }
  const fields = fieldsResult.data ?? [];

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
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <BoardFieldsClient boardId={boardId} initialFields={fields as any} />
      </div>
    </div>
  );
}
