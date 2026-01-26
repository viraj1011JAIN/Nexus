import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ListContainer } from "@/components/board/list-container";
import { ErrorBoundary } from "@/components/error-boundary";
import { BoardHeader } from "@/components/board/board-header";

interface BoardIdPageProps {
  params: Promise<{
    boardId: string;
  }>;
}

export default async function BoardIdPage(props: BoardIdPageProps) {
  const params = await props.params;

  // 1. Fetch Board + Lists + CARDS
  const board = await db.board.findUnique({
    where: { id: params.boardId },
    include: {
      lists: {
        orderBy: { order: "asc" },
        include: {
          cards: {
            orderBy: { order: "asc" },
          },
        },
      },
    },
  });

  if (!board) notFound();

  return (
    <div className="h-full min-h-screen bg-gradient-to-br from-slate-100 via-indigo-50 to-purple-50 p-6 overflow-x-auto relative">
      {/* Subtle animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
      </div>
      
      {/* Header with Real-Time Indicators */}
      <BoardHeader boardId={params.boardId} boardTitle={board.title} />

      {/* Board Canvas - Handled by Client Component */}
      <div className="relative z-10">
        <ErrorBoundary>
          <ListContainer boardId={params.boardId} data={board.lists} />
        </ErrorBoundary>
      </div>
    </div>
  );
}