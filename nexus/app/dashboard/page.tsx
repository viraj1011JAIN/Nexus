import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { BoardList } from "@/components/board-list";

export default async function DashboardPage() {
  const { userId, orgId } = await auth();

  // Require authentication
  if (!userId) {
    redirect("/sign-in");
  }

  // Fetch boards for the user's organization
  const boards = await db.board.findMany({
    where: orgId ? {
      orgId: orgId,
    } : undefined,
    orderBy: {
      createdAt: "desc",
    },
  });

  return <BoardList boards={boards} />;
}
