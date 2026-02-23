"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorBoundary } from "@/components/error-boundary";
import { ListContainer } from "@/components/board/list-container";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { TableView } from "@/components/board/table-view";
import { SprintPanel } from "@/components/board/sprint-panel";
import { CalendarView } from "@/components/board/calendar-view";
import { WorkloadView } from "@/components/board/workload-view";
import { FilterBar, type BoardFilterState } from "@/components/board/filter-bar";
import { BulkActionBar } from "@/components/board/bulk-action-bar";
import { BulkSelectionProvider, useBulkSelection } from "@/lib/bulk-selection-context";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { KeyboardShortcutsModal } from "@/components/keyboard-shortcuts-modal";
import {
  BarChart3, LayoutDashboard, Table2, GitBranch, Calendar, Users,
} from "lucide-react";

// â”€â”€â”€ Tab definitions (order matters â€” keys 1â€“6 map to tabs by index) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const TABS = [
  { value: "board",     label: "Board",     Icon: LayoutDashboard },
  { value: "table",     label: "Table",     Icon: Table2 },
  { value: "calendar",  label: "Calendar",  Icon: Calendar },
  { value: "sprints",   label: "Sprints",   Icon: GitBranch },
  { value: "workload",  label: "Workload",  Icon: Users },
  { value: "analytics", label: "Analytics", Icon: BarChart3 },
] as const;

type TabValue = typeof TABS[number]["value"];

interface BoardTabsProps {
  boardId: string;
  boardTitle: string;
  orgId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lists: any[];
}

// â”€â”€â”€ Inner component (consumes BulkSelectionContext) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function BoardTabsInner({ boardId, boardTitle, orgId, lists }: BoardTabsProps) {
  const [activeTab, setActiveTab] = useState<TabValue>("board");
  const [filters, setFilters] = useState<BoardFilterState>({
    assigneeIds: [],
    priorities: [],
    labelIds: [],
  });

  // Reset filters when leaving the calendar tab so selectAllVisible and filter logic
  // always operate on the full card list on non-calendar views.
  const handleTabChange = useCallback((tab: TabValue) => {
    setActiveTab(tab);
    if (tab !== "calendar") {
      setFilters({ assigneeIds: [], priorities: [], labelIds: [] });
    }
  }, []);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const tabListRef = useRef<HTMLDivElement>(null);

  const bulk = useBulkSelection();
  const router = useRouter();

  // Flatten all cards
  const allCards = useMemo(() => {
    const cards: {
      id: string;
      title: string;
      dueDate?: string | null;
      priority?: string | null;
      listId: string;
      listTitle: string;
      boardId: string;
      assigneeId?: string | null;
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
          assigneeId: card.assigneeId ?? null,
          assigneeImageUrl: card.assignee?.imageUrl ?? null,
          assigneeName: card.assignee?.name ?? null,
          coverColor: card.coverColor ?? null,
        });
      }
    }
    return cards;
  }, [lists, boardId]);

  const members = useMemo(() => {
    const map = new Map<string, { id: string; name: string; imageUrl?: string | null }>();
    for (const card of allCards) {
      // Only include cards that have a real assigneeId so the map key is always
      // the actual DB user id — keeps FilterBar predicate consistent
      if (card.assigneeId && card.assigneeName) {
        if (!map.has(card.assigneeId)) {
          map.set(card.assigneeId, { id: card.assigneeId, name: card.assigneeName, imageUrl: card.assigneeImageUrl });
        }
      }
    }
    return [...map.values()];
  }, [allCards]);

  const listOptions = useMemo(
    () => (lists ?? []).map((l: { id: string; title: string }) => ({ id: l.id, title: l.title })),
    [lists]
  );

  const labels = useMemo(() => {
    const labelMap = new Map<string, { id: string; name: string; color: string }>();
    for (const list of lists ?? []) {
      for (const card of list.cards ?? []) {
        for (const la of card.labels ?? []) {
          const l = la.label;
          if (l && !labelMap.has(l.id)) labelMap.set(l.id, { id: l.id, name: l.name, color: l.color });
        }
      }
    }
    return [...labelMap.values()];
  }, [lists]);

  const filteredCards = useMemo(() => {
    const hasActiveFilter =
      filters.assigneeIds.length > 0 ||
      filters.priorities.length > 0 ||
      (filters.listIds?.length ?? 0) > 0 ||
      !!filters.search;
    if (!hasActiveFilter) return allCards;
    return allCards.filter((card) => {
      if (filters.assigneeIds.length > 0 && !filters.assigneeIds.includes(card.assigneeId ?? "")) return false;
      if (filters.priorities.length > 0 && !filters.priorities.includes(card.priority ?? "")) return false;
      if (filters.listIds?.length && !filters.listIds.includes(card.listId)) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!card.title.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allCards, filters]);

  // Only calendar actually consumes filteredCards — board and table receive raw lists.
  // Show the FilterBar only for views wired to filtered data, to avoid a filter bar
  // that appears to work but has no effect on the rendered content.
  const showFilterBar = activeTab === "calendar";

  // â”€â”€ Keyboard shortcuts (TASK-016) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const switchToTab = useCallback((tab: TabValue) => {
    setActiveTab(tab);
    // Brief visual focus to indicate the switch
    tabListRef.current?.querySelector<HTMLElement>(`[data-value="${tab}"]`)?.focus();
  }, []);

  const selectAllVisible = useCallback(() => {
    bulk.selectAll(filteredCards.map((c) => c.id));
  }, [bulk, filteredCards]);

  const shortcuts = useMemo(() => [
    // â”€â”€ View switch (1â€“6) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    { key: "1", description: "Switch to Board view",    action: () => switchToTab("board"),     ignoreInInput: true },
    { key: "2", description: "Switch to Table view",    action: () => switchToTab("table"),     ignoreInInput: true },
    { key: "3", description: "Switch to Calendar view", action: () => switchToTab("calendar"),  ignoreInInput: true },
    { key: "4", description: "Switch to Sprints view",  action: () => switchToTab("sprints"),   ignoreInInput: true },
    { key: "5", description: "Switch to Workload view", action: () => switchToTab("workload"),  ignoreInInput: true },
    { key: "6", description: "Switch to Analytics",     action: () => switchToTab("analytics"), ignoreInInput: true },
    // â”€â”€ Bulk selection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    { key: "b", description: "Toggle bulk selection mode", action: () => bulk.isBulkMode ? bulk.exitBulkMode() : bulk.enterBulkMode(), ignoreInInput: true },
    { key: "a", modifiers: { ctrl: true } as const, description: "Select all visible cards", action: selectAllVisible, ignoreInInput: true },
    // Two Escape entries: closing the shortcuts modal should work even when focus is inside
    // an input within the modal (ignoreInInput: false), but clearing bulk selection should
    // not fire while the user is typing in an input field (ignoreInInput: true).
    // The hook returns on first match, so we fire both by combining them into one entry
    // that always closes the modal and only conditionally clears selection.
    {
      key: "Escape",
      description: "Clear selection / close modal",
      action: () => {
        setShortcutsOpen(false);
        // Only clear selection when focus is not inside an input/textarea/contentEditable
        const el = document.activeElement;
        const inInput = el && (
          ["input", "textarea", "select"].includes(el.tagName.toLowerCase()) ||
          (el as HTMLElement).isContentEditable
        );
        if (!inInput) bulk.clearSelection();
      },
      ignoreInInput: false,
    },
    // â”€â”€ Help â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    { key: "?", description: "Show keyboard shortcuts", action: () => setShortcutsOpen(true), ignoreInInput: true },
  ], [switchToTab, bulk, selectAllVisible]);

  useKeyboardShortcuts(shortcuts);

  return (
    <>
      {/* Keyboard shortcuts modal */}
      <KeyboardShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        shortcuts={shortcuts}
      />

      <Tabs
        value={activeTab}
        onValueChange={(v) => handleTabChange(v as TabValue)}
        className="w-full relative z-10"
      >
        <div className="px-6 pt-4 space-y-3" ref={tabListRef as React.RefObject<HTMLDivElement>}>
          <TabsList className="bg-white/80 backdrop-blur-sm shadow-sm">
            {TABS.map(({ value, label, Icon }, i) => (
              <TabsTrigger
                key={value}
                value={value}
                data-value={value}
                className="gap-2"
                title={`${label} (${i + 1})`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {showFilterBar && (
            <ErrorBoundary fallback={null}>
              <FilterBar boardId={boardId} members={members} lists={listOptions} labels={labels} onChange={setFilters} />
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
            <CalendarView cards={filteredCards} boardId={boardId} />
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

      {/* Bulk action bar â€” appears when cards are selected */}
      <BulkActionBar
        selectedIds={bulk.selectedIds}
        onClearSelection={bulk.clearSelection}
        onActionComplete={() => router.refresh()}
        lists={listOptions}
        members={members}
      />
    </>
  );
}

// â”€â”€â”€ Public export (wraps inner with BulkSelectionProvider) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function BoardTabs(props: BoardTabsProps) {
  return (
    <BulkSelectionProvider>
      <BoardTabsInner {...props} />
    </BulkSelectionProvider>
  );
}

