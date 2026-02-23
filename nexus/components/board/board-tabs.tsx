"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorBoundary } from "@/components/error-boundary";
import { ListContainer } from "@/components/board/list-container";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { BarChart3, LayoutDashboard } from "lucide-react";

interface BoardTabsProps {
  boardId: string;
  boardTitle: string;
  orgId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lists: any[];
}

export function BoardTabs({ boardId, boardTitle, orgId, lists }: BoardTabsProps) {
  return (
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
          <ListContainer boardId={boardId} orgId={orgId} data={lists} />
        </ErrorBoundary>
      </TabsContent>

      <TabsContent value="analytics" className="mt-0">
        <ErrorBoundary>
          <AnalyticsDashboard boardId={boardId} boardName={boardTitle} orgId={orgId} />
        </ErrorBoundary>
      </TabsContent>
    </Tabs>
  );
}
