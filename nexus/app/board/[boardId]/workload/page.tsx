/**
 * TASK-017 — Standalone Workload View Page
 * /board/[boardId]/workload
 *
 * Deep-links to this page land on the workload view directly without needing
 * the full Kanban board to load first. Useful for manager bookmarks.
 */

import { notFound } from "next/navigation";
import { getTenantContext, requireRole } from "@/lib/tenant-context";
import { createDAL } from "@/lib/dal";
import { WorkloadView } from "@/components/board/workload-view";
import { ErrorBoundary } from "@/components/error-boundary";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { Suspense } from "react";

interface WorkloadPageProps {
  params: Promise<{ boardId: string }>;
}

export async function generateMetadata({ params }: WorkloadPageProps) {
  const { boardId } = await params;
  const ctx = await getTenantContext();
  try {
    await requireRole("MEMBER", ctx);
    const dal = await createDAL(ctx);
    const board = await dal.boards.findUnique(boardId, { select: { title: true } });
    return { title: `Workload — ${board?.title ?? "Board"} — Nexus` };
  } catch {
    return { title: "Workload — Nexus" };
  }
}

export default async function WorkloadPage({ params }: WorkloadPageProps) {
  const { boardId } = await params;
  const ctx = await getTenantContext();
  // Board-level ACL: only members (and above) of the owning org may view workload.
  await requireRole("MEMBER", ctx);
  const dal = await createDAL(ctx);

  type BoardWithLists = Awaited<ReturnType<typeof dal.boards.findUnique>> & {
    lists: Array<{
      id: string; title: string; order: string;
      cards: Array<{
        id: string; title: string; order: string; listId: string;
        priority?: string | null; dueDate?: Date | null;
        coverColor?: string | null; coverImageUrl?: string | null;
        assignee?: { name: string; imageUrl: string | null } | null;
      }>;
    }>;
  };

  let board: BoardWithLists | null = null;
  try {
    board = await dal.boards.findUnique(boardId, {
      include: {
        lists: {
          orderBy: { order: "asc" },
          include: {
            cards: {
              orderBy: { order: "asc" },
              include: {
                assignee: { select: { name: true, imageUrl: true } },
              },
            },
          },
        },
      },
    }) as unknown as BoardWithLists | null;
  } catch (err) {
    // dal.boards.findUnique returns null for missing boards (handled by if (!board) notFound()
    // below) — this catch only handles unexpected DB/permission/runtime exceptions.
    const msg = (err instanceof Error ? err.message : String(err)).slice(0, 200);
    console.error(`[WorkloadPage] Failed to fetch board: ${msg}`);
    throw err;
  }

  if (!board) notFound();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
      {/* Back navigation */}
      <div className="px-6 py-4 border-b bg-white/70 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <Link
            href={`/board/${boardId}`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Board
          </Link>
          <div className="h-4 w-px bg-border" />
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-500" />
            {board.title} — Workload
          </h1>
        </div>
      </div>

      {/* Workload view */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <ErrorBoundary>
          <Suspense fallback={<div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>}>
            <WorkloadView boardId={boardId} lists={board.lists} />
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}
