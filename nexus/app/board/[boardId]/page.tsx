import { notFound } from "next/navigation";
import { ListContainer } from "@/components/board/list-container";
import { ErrorBoundary } from "@/components/error-boundary";
import { BoardHeader } from "@/components/board/board-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { BarChart3, LayoutDashboard } from "lucide-react";
import { getTenantContext } from "@/lib/tenant-context";
import { createDAL } from "@/lib/dal";

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
  let board: any;
  try {
    board = await dal.boards.findUnique(params.boardId, {
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
  } catch {
    notFound();
  }

  if (!board) notFound();

  return (
    // eslint-disable-next-line react/forbid-component-props
    <div
      className="h-full min-h-screen overflow-x-auto relative"
      style={board.imageFullUrl ? {
        backgroundImage: `url(${board.imageFullUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      } : undefined}
    >
      {/* Page background — gradient + blobs when no image, dark overlay when image set */}
      {!board.imageFullUrl ? (
        <div className="absolute inset-0 bg-linear-to-br from-slate-100 via-indigo-50 to-purple-50 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
          <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-black/40 pointer-events-none" />
      )}
      
      {/* Header with Real-Time Indicators */}
      <div className="relative z-10 p-6 pb-0">
        <BoardHeader boardId={params.boardId} boardTitle={board.title} orgId={board.orgId} />
      </div>

      {/* Tabs for Board / Analytics */}
      <Tabs defaultValue="board" className="w-full relative z-10">
        <div className="px-6 pt-4">
          <TabsList className="bg-white/80 backdrop-blur-sm shadow-sm">
            <TabsTrigger value="board" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Board
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="board" className="mt-0 p-6 pt-4">
          <ErrorBoundary>
            <ListContainer boardId={params.boardId} orgId={board.orgId} data={board.lists} />
          </ErrorBoundary>
        </TabsContent>
        
        <TabsContent value="analytics" className="mt-0">
          <ErrorBoundary>
            <AnalyticsDashboard boardId={params.boardId} boardName={board.title} orgId={board.orgId} />
          </ErrorBoundary>
        </TabsContent>
      </Tabs>
    </div>
  );
}