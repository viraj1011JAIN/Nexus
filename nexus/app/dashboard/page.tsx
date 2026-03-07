import { BoardList, type DashboardBoard } from "@/components/board-list";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";

/**
 * Server Component — fetches boards from the database directly, then passes
 * them as `initialBoards` to the client component.  This eliminates the
 * client-side loading spinner; boards appear on first paint instead of after
 * a round-trip fetch from the browser.
 */
export default async function DashboardPage() {
  let initialBoards: DashboardBoard[] = [];

  try {
    const ctx = await getTenantContext();
    const rawBoards = await db.board.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        imageThumbUrl: true,
        _count: { select: { lists: true } },
        lists: { select: { _count: { select: { cards: true } } } },
      },
    });

    initialBoards = rawBoards.map((b) => ({
      id: b.id,
      title: b.title,
      updatedAt: b.updatedAt,
      imageThumbUrl: b.imageThumbUrl,
      listCount: b._count.lists,
      cardCount: b.lists.reduce((sum, l) => sum + l._count.cards, 0),
    }));
  } catch {
    // TenantError / unauthenticated — middleware handles the redirect.
    // Render with empty boards so the component mounts cleanly.
  }

  return <BoardList initialBoards={initialBoards} />;
}

