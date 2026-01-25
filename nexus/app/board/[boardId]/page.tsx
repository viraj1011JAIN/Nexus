import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ListContainer } from "@/components/board/list-container"; // <--- Import the new component

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
    <div className="h-full min-h-screen bg-slate-100 p-4 overflow-x-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link 
            href="/" 
            className="text-sm px-3 py-1 bg-white rounded shadow-sm hover:bg-slate-50"
        >
            ← Back
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">{board.title}</h1>
      </div>

      {/* Board Canvas - Handled by Client Component */}
      <ListContainer boardId={params.boardId} data={board.lists} />
    </div>
  );
}