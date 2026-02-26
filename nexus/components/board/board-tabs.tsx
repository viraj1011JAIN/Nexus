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
  BarChart3, LayoutDashboard, Table2, GitBranch, Calendar, Users, GanttChart,
} from "lucide-react";
import { GanttView } from "@/components/board/gantt-view";
import { useTheme } from "@/components/theme-provider";

// â”€â”€â”€ Tab definitions (order matters â€” keys 1â€“6 map to tabs by index) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const TABS = [
  { value: "board",     label: "Board",     Icon: LayoutDashboard },
  { value: "table",     label: "Table",     Icon: Table2 },
  { value: "calendar",  label: "Calendar",  Icon: Calendar },
  { value: "timeline",  label: "Timeline",  Icon: GanttChart },
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
  const { theme } = useTheme();
  const isDark = theme === "dark";
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
  }, [setActiveTab, setFilters]);
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
      labelIds: string[];
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
          labelIds: (card.labels ?? []).map((la: { label: { id: string } }) => la.label.id),
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
      filters.labelIds.length > 0 ||
      (filters.listIds?.length ?? 0) > 0 ||
      !!filters.search;
    if (!hasActiveFilter) return allCards;
    return allCards.filter((card) => {
      if (filters.assigneeIds.length > 0 && !filters.assigneeIds.includes(card.assigneeId ?? "")) return false;
      if (filters.priorities.length > 0 && !filters.priorities.includes(card.priority ?? "")) return false;
      if (filters.labelIds.length > 0 && !filters.labelIds.some((id) => card.labelIds.includes(id))) return false;
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
    // Delegate to handleTabChange so filter state is reset when switching away
    // from calendar via keyboard shortcut, matching the Tabs onValueChange behaviour.
    handleTabChange(tab);
    // Brief visual focus to indicate the switch
    tabListRef.current?.querySelector<HTMLElement>(`[data-value="${tab}"]`)?.focus();
  }, [handleTabChange]);

  const selectAllVisible = useCallback(() => {
    // filteredCards is only meaningful (calendar filters dates) on the calendar tab;
    // on all other tabs use allCards so Ctrl+A truly selects every card.
    const cards = activeTab === "calendar" ? filteredCards : allCards;
    bulk.selectAll(cards.map((c) => c.id));
  }, [bulk, filteredCards, allCards, activeTab]);

  const shortcuts = useMemo(() => [
    // â”€â”€ View switch (1â€“6) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    { key: "1", description: "Switch to Board view",    action: () => switchToTab("board"),     ignoreInInput: true },
    { key: "2", description: "Switch to Table view",    action: () => switchToTab("table"),     ignoreInInput: true },
    { key: "3", description: "Switch to Calendar view", action: () => switchToTab("calendar"),  ignoreInInput: true },
    { key: "4", description: "Switch to Timeline view", action: () => switchToTab("timeline"),  ignoreInInput: true },
    { key: "5", description: "Switch to Sprints view",  action: () => switchToTab("sprints"),   ignoreInInput: true },
    { key: "6", description: "Switch to Workload view", action: () => switchToTab("workload"),  ignoreInInput: true },
    { key: "7", description: "Switch to Analytics",     action: () => switchToTab("analytics"), ignoreInInput: true },
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

  const doneCount = (lists ?? []).find((l: { title: string }) => l.title === "Done")?.cards?.length ?? 0;

  return (
    <>
      {/* Keyboard shortcuts modal */}
      <KeyboardShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        shortcuts={shortcuts}
      />

      {/* Shimmer brand stripe */}
      <div className="h-[2px] flex-shrink-0 shimmer-stripe" />

      <Tabs
        id="board-tabs"
        value={activeTab}
        onValueChange={(v) => handleTabChange(v as TabValue)}
        className="w-full relative z-10 flex-1 flex flex-col overflow-hidden"
      >
        <div
          className="px-6 py-2 flex items-center justify-between gap-4"
          ref={tabListRef as React.RefObject<HTMLDivElement>}
          style={{
            borderBottom: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.07)",
            background: isDark ? "rgba(13,12,20,0.75)" : "rgba(255,253,249,0.9)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <div className="flex flex-col gap-2">
            <TabsList
              className="h-auto p-1 gap-0.5"
              style={{
                background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                border: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(0,0,0,0.07)",
                borderRadius: 10,
              }}
            >
              {TABS.map(({ value, label, Icon }, i) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  data-value={value}
                  className="gap-1.5 text-[12.5px] rounded-[7px] px-3 py-1.5 data-[state=active]:shadow-none"
                  style={{
                    color: activeTab === value
                      ? isDark ? "#C084FC" : "#7B2FF7"
                      : isDark ? "rgba(255,255,255,0.38)" : "#9A8F85",
                    background: activeTab === value
                      ? isDark ? "rgba(123,47,247,0.15)" : "rgba(123,47,247,0.08)"
                      : "transparent",
                    fontWeight: activeTab === value ? 600 : 400,
                    fontFamily: "'DM Sans', sans-serif",
                    transition: "all 0.18s ease",
                  }}
                  title={`${label} (${i + 1})`}
                >
                  <Icon className="h-3.5 w-3.5" style={{ opacity: activeTab === value ? 1 : 0.6 }} />
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

          {/* Board stats — right side */}
          <div className="flex items-center gap-4 flex-shrink-0">
            {[
              { label: "Lists",  val: (lists ?? []).length,  color: "#7B2FF7" },
              { label: "Cards",  val: allCards.length,       color: "#1A73E8" },
              { label: "Done",   val: doneCount,             color: "#059669" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span
                  className="text-[14px] font-bold leading-none font-display"
                  style={{ color: s.color }}
                >
                  {s.val}
                </span>
                <span
                  className="text-[11px] font-normal"
                  style={{ color: isDark ? "rgba(255,255,255,0.25)" : "#BFB9B3" }}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <TabsContent value="board" className="mt-0 p-0 flex flex-col overflow-hidden">
          <ErrorBoundary>
            <ListContainer boardId={boardId} orgId={orgId} data={lists} />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="table" className="mt-0 p-6 pt-4 flex-1 overflow-y-auto">
          <ErrorBoundary>
            <TableView lists={lists} />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="calendar" className="mt-0 p-6 pt-4 flex-1 overflow-y-auto">
          <ErrorBoundary>
            <CalendarView cards={filteredCards} boardId={boardId} />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="timeline" className="mt-0 p-4 pt-4 flex-1 overflow-y-auto">
          <ErrorBoundary>
            <GanttView lists={lists} />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="sprints" className="mt-0 p-6 pt-4 max-w-3xl flex-1 overflow-y-auto">
          <ErrorBoundary>
            <SprintPanel boardId={boardId} />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="workload" className="mt-0 p-6 pt-4 flex-1 overflow-y-auto">
          <ErrorBoundary>
            <WorkloadView boardId={boardId} lists={lists} />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="analytics" className="mt-0 flex-1 overflow-y-auto">
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

