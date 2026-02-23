"use client";

import { useState, useMemo, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorBoundary } from "@/components/error-boundary";
import { ListContainer } from "@/components/board/list-container";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { TableView } from "@/components/board/table-view";
import { SprintPanel } from "@/components/board/sprint-panel";
import { CalendarView } from "@/components/board/calendar-view";
import { WorkloadView } from "@/components/board/workload-view";
import { FilterBar, type BoardFilterState } from "@/components/board/filter-bar";
import { BulkActionBar, useBulkSelection } from "@/components/board/bulk-action-bar";
import {
  BarChart3, LayoutDashboard, Table2, GitBranch, Calendar, Users,
} from "lucide-react";

interface BoardTabsProps {
  boardId: string;
  boardTitle: string;
  orgId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lists: any[];
}

export function BoardTabs({ boardId, boardTitle, orgId, lists }: BoardTabsProps) {
  const [activeTab, setActiveTab] = useState("board");
  const [filters, setFilters] = useState<BoardFilterState>({
    assigneeIds: [],
    priorities: [],
    labelIds: [],
  });

  const bulk = useBulkSelection();

  // Flatten all cards from all lists for cross-view use
  const allCards = useMemo(() => {
    const cards: {
      id: string;
      title: string;
      dueDate?: string | null;
      priority?: string | null;
      listId: string;
      listTitle: string;
      boardId: string;
      assigneeImageUrl?: string | null;
      assigneeName?: string | null;
      coverColor?: string | null;
    }[] = [];
    for (const list of lists ?? []) {
      for (const card of list.cards ?? []) {
        cards.push({
          id: card.id,
          title: card.title,
          dueDate: card.dueDate,
          priority: card.priority,
          listId: list.id,
          listTitle: list.title,
          boardId,
          assigneeImageUrl: card.assignee?.imageUrl ?? null,
          assigneeName: card.assignee?.name ?? null,
          coverColor: card.coverColor ?? null,
        });
      }
    }
    return cards;
  }, [lists, boardId]);

  // Derive members from all cards assignees
  const members = useMemo(() => {
    const map = new Map<string, { id: string; name: string; imageUrl?: string | null }>();
    for (const card of allCards) {
      if (card.assigneeName) {
        map.set(card.assigneeName, {
          id: card.assigneeImageUrl ?? card.assigneeName,
          name: card.assigneeName,
          imageUrl: card.assigneeImageUrl,
        });
      }
    }
    return [...map.values()];
  }, [allCards]);

  // Derive lists for filter bar
  const listOptions = useMemo(
    () => (lists ?? []).map((l: { id: string; title: string }) => ({ id: l.id, title: l.title })),
    [lists]
  );

  // Show filter bar on certain tabs
  const showFilterBar = ["board", "table", "calendar"].includes(activeTab);

  return (
    <>
      <Tabs
        defaultValue="board"
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full relative z-10"
      >
        <div className="px-6 pt-4 space-y-3">
          <TabsList className="bg-white/80 backdrop-blur-sm shadow-sm">
            <TabsTrigger value="board" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Board
            </TabsTrigger>
            <TabsTrigger value="table" className="gap-2">
              <Table2 className="h-4 w-4" />
              Table
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2">
              <Calendar className="h-4 w-4" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="sprints" className="gap-2">
              <GitBranch className="h-4 w-4" />
              Sprints
            </TabsTrigger>
            <TabsTrigger value="workload" className="gap-2">
              <Users className="h-4 w-4" />
              Workload
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Filter bar */}
          {showFilterBar && (
            <ErrorBoundary fallback={null}>
              <FilterBar
                boardId={boardId}
                members={members}
                lists={listOptions}
                labels={[]}
                onChange={setFilters}
              />
            </ErrorBoundary>
          )}
        </div>

        <TabsContent value="board" className="mt-0 p-6 pt-4">
          <ErrorBoundary>
            <ListContainer boardId={boardId} orgId={orgId} data={lists} />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="table" className="mt-0 p-6 pt-4">
          <ErrorBoundary>
            <TableView lists={lists} />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="calendar" className="mt-0 p-6 pt-4">
          <ErrorBoundary>
            <CalendarView cards={allCards} boardId={boardId} />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="sprints" className="mt-0 p-6 pt-4 max-w-3xl">
          <ErrorBoundary>
            <SprintPanel boardId={boardId} />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="workload" className="mt-0 p-6 pt-4">
          <ErrorBoundary>
            <WorkloadView boardId={boardId} lists={lists} />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="analytics" className="mt-0">
          <ErrorBoundary>
            <AnalyticsDashboard boardId={boardId} boardName={boardTitle} orgId={orgId} />
          </ErrorBoundary>
        </TabsContent>
      </Tabs>

      {/* Bulk action bar */}
      <BulkActionBar
        selectedIds={bulk.selectedIds}
        onClearSelection={bulk.clearSelection}
        onActionComplete={() => {/* refresh happens via server revalidation */}}
        lists={listOptions}
        members={members}
      />
    </>
  );
}
