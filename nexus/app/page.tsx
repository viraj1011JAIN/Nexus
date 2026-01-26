import { db } from "@/lib/db";
import { BoardList } from "@/components/board-list";

export default async function Home() {
  const boards = await db.board.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  return <BoardList boards={boards} />;
}