import { notFound } from "next/navigation";
import { BoardPageClient } from "@/components/board/board-page-client";
import { getTenantContext } from "@/lib/tenant-context";
import { createDAL } from "@/lib/dal";

// Revalidate the Route Cache every 30 seconds so stale board data
// (from Next.js full-route cache) is refreshed automatically. The page
// is still dynamically rendered per-request because getTenantContext()
// reads cookies, so ISR does not apply here — this setting governs any
// fetch()-based data calls made inside the render tree and controls the
// client-side Router Cache TTL.
export const revalidate = 30;

interface BoardIdPageProps {
  params: Promise<{
    boardId: string;
  }>;
}

export default async function BoardIdPage(props: BoardIdPageProps) {
  const params = await props.params;

  // Verify tenant context — redirects to sign-in/select-org if invalid (via middleware)
  const ctx = await getTenantContext();
  const dal = await createDAL(ctx);

  // Fetch board via DAL — returns NOT_FOUND if boardId doesn't belong to ctx.orgId
  // This prevents an authenticated user from reading another org's board by guessing the ID.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let board: any;
  try {
    board = await dal.boards.findUnique(params.boardId, {
      include: {
        lists: {
          orderBy: { order: "asc" },
          include: {
            cards: {
              orderBy: { order: "asc" },
              include: {
                assignee: { select: { id: true, name: true, imageUrl: true } },
                labels: { include: { label: { select: { id: true, name: true, color: true } } } },
                checklists: {
                  include: {
                    items: { select: { id: true, isComplete: true } },
                  },
                },
                _count: { select: { dependencies: true } },
              },
            },
          },
        },
      },
    });
  } catch {
    notFound();
  }

  if (!board) notFound();

  return (
    <div
      className="h-dvh relative flex flex-col overflow-hidden"
      style={board.imageFullUrl ? {
        backgroundImage: `url(${board.imageFullUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      } : undefined}
    >
      {/* Page background — theme-aware blobs when no image, dark overlay when image set */}
      {!board.imageFullUrl ? (
        <div className="absolute inset-0 overflow-hidden pointer-events-none dark:bg-[#0D0C14] bg-[#F4F1ED]">
          <div
            className="absolute top-[-120px] left-[10%] w-[600px] h-[600px] rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(123,47,247,0.07) 0%, transparent 70%)",
              filter: "blur(40px)",
            }}
          />
          <div
            className="absolute bottom-[-100px] right-[5%] w-[500px] h-[500px] rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(16,185,129,0.05) 0%, transparent 70%)",
              filter: "blur(40px)",
            }}
          />
        </div>
      ) : (
        <div className="absolute inset-0 bg-black/40 pointer-events-none" />
      )}
      
      {/* Header + Tabs wired together with shared filter state */}
      <BoardPageClient
        boardId={params.boardId}
        boardTitle={board.title}
        orgId={board.orgId}
        lists={board.lists}
      />
    </div>
  );
}