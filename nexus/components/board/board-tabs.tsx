"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { startOfToday, startOfDay, endOfDay } from "date-fns";
import dynamic from "next/dynamic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorBoundary } from "@/components/error-boundary";
// ─── Dynamic imports for all components that import server actions ─────────
// Static imports create a frozen reference to Turbopack's server-action stub
// chunk (content-hashed ID). When any file changes during HMR the stub gets a
// new hash; the old ID no longer has a registered factory → runtime crash.
// dynamic() integrates with the Turbopack HMR system so after each update the
// next render re-fetches the latest chunk, always getting a live factory.
const ListContainer = dynamic(() =>
  import("@/components/board/list-container").then((m) => ({ default: m.ListContainer }))
);
const AnalyticsDashboard = dynamic(() =>
  import("@/components/analytics/analytics-dashboard").then((m) => ({ default: m.AnalyticsDashboard }))
);
const SprintPanel = dynamic(() =>
  import("@/components/board/sprint-panel").then((m) => ({ default: m.SprintPanel }))
);
const CalendarView = dynamic(() =>
  import("@/components/board/calendar-view").then((m) => ({ default: m.CalendarView }))
);
const WorkloadView = dynamic(() =>
  import("@/components/board/workload-view").then((m) => ({ default: m.WorkloadView }))
);
const FilterBar = dynamic(() =>
  import("@/components/board/filter-bar").then((m) => ({ default: m.FilterBar }))
);
const BulkActionBar = dynamic(() =>
  import("@/components/board/bulk-action-bar").then((m) => ({ default: m.BulkActionBar }))
);
// TableView and GanttView don't import server actions — static imports are safe
import { TableView } from "@/components/board/table-view";
import { GanttView } from "@/components/board/gantt-view";
import type { BoardFilterState } from "@/components/board/filter-bar";
import { BulkSelectionProvider, useBulkSelection } from "@/lib/bulk-selection-context";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { KeyboardShortcutsModal } from "@/components/keyboard-shortcuts-modal";
import {
  BarChart3, LayoutDashboard, Table2, GitBranch, Calendar, Users, GanttChart, Filter,
} from "lucide-react";
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
  /**
   * Optional external control of the filter bar open state.
   * When provided (e.g. from BoardPageClient), the header Filter button and the
   * tab-internal filter state stay in sync.
   */
  filterBarOpen?: boolean;
  onFilterBarChange?: (open: boolean) => void;
}

// â”€â”€â”€ Inner component (consumes BulkSelectionContext) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function BoardTabsInner({ boardId, boardTitle, orgId, lists, filterBarOpen: externalFilterOpen, onFilterBarChange }: BoardTabsProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [activeTab, setActiveTab] = useState<TabValue>("board");
  const [filters, setFilters] = useState<BoardFilterState>({
    assigneeIds: [],
    priorities: [],
    labelIds: [],
  });

  // ── Filter bar open state ──────────────────────────────────────────────────
  // If an external controller is provided (BoardPageClient), use it; otherwise
  // fall back to internal state so the component also works standalone.
  const [internalFilterOpen, setInternalFilterOpen] = useState(false);
  const isFilterBarOpen = externalFilterOpen ?? internalFilterOpen;
  const setFilterBarOpen = useCallback(
    (open: boolean) => {
      if (onFilterBarChange) {
        onFilterBarChange(open);
      } else {
        setInternalFilterOpen(open);
      }
    },
    [onFilterBarChange]
  );

  // Tab switching — no longer resets filters so a user can switch views while
  // keeping the same active filters (e.g. "my cards" on board, then on table).
  const handleTabChange = useCallback((tab: TabValue) => {
    setActiveTab(tab);
  }, [setActiveTab]);
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
      !!filters.search ||
      !!filters.overdue ||
      !!filters.dueDateFrom ||
      !!filters.dueDateTo;
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
      // Overdue: dueDate exists and is strictly before today (cards due today are not overdue)
      if (filters.overdue) {
        if (!card.dueDate || new Date(card.dueDate) >= startOfToday()) return false;
      }
      // Due date range — inclusive: card.dueDate must be within [startOfDay(from), endOfDay(to)]
      if (filters.dueDateFrom) {
        if (!card.dueDate || new Date(card.dueDate) < startOfDay(new Date(filters.dueDateFrom))) return false;
      }
      if (filters.dueDateTo) {
        if (!card.dueDate || new Date(card.dueDate) > endOfDay(new Date(filters.dueDateTo))) return false;
      }
      return true;
    });
  }, [allCards, filters]);

  // Whether any filter is currently applied — used to decide when to narrow views
  const filteredCardIds = useMemo(() => new Set(filteredCards.map((c) => c.id)), [filteredCards]);
  const hasActiveFilter = filteredCards.length < allCards.length;

  /**
   * Apply the current filters to the raw lists structure so that all views
   * (board, table, timeline, workload) receive only the matching cards.
   * When no filter is active, returns the original lists reference unchanged.
   */
  const filteredListsForView = useMemo(() => {
    if (!hasActiveFilter) return lists;
    return (lists ?? []).map((list: { id: string; title: string; cards: unknown[] }) => ({
      ...list,
      cards: (list.cards ?? []).filter((card: unknown) => filteredCardIds.has((card as { id: string }).id)),
    }));
  }, [lists, filteredCardIds, hasActiveFilter]);

  // FilterBar is shown for all content-oriented views when the filter bar is open.
  // Analytics and Sprints manage their own data; no card filter applies there.
  const showFilterBar = isFilterBarOpen && !["analytics", "sprints"].includes(activeTab);

  // â”€â”€ Keyboard shortcuts (TASK-016) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const switchToTab = useCallback((tab: TabValue) => {
    handleTabChange(tab);
    // Brief visual focus to indicate the switch
    tabListRef.current?.querySelector<HTMLElement>(`[data-value="${tab}"]`)?.focus();
  }, [handleTabChange]);

  const selectAllVisible = useCallback(() => {
    // Always select the currently visible (filtered) cards, regardless of tab.
    bulk.selectAll(filteredCards.map((c) => c.id));
  }, [bulk, filteredCards]);

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
    // ── Filter bar ────────────────────────────────────────────────────────────────
    { key: "f", description: "Toggle filter bar", action: () => setFilterBarOpen(!isFilterBarOpen), ignoreInInput: true },
    // ── Help ─────────────────────────────────────────────────────────────────────
    { key: "?", description: "Show keyboard shortcuts", action: () => setShortcutsOpen(true), ignoreInInput: true },
  ], [switchToTab, bulk, selectAllVisible, setFilterBarOpen, isFilterBarOpen]);

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

          {/* Board stats + filter toggle — right side */}
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

            {/* Filter toggle — active indicator dot when filters are applied */}
            {!["analytics", "sprints"].includes(activeTab) && (
              <button
                onClick={() => setFilterBarOpen(!isFilterBarOpen)}
                title="Toggle filters (F)"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "5px 12px",
                  borderRadius: 8,
                  border: isFilterBarOpen
                    ? "1px solid #00C8FF"
                    : "1px solid rgba(0,200,255,0.45)",
                  background: isFilterBarOpen
                    ? "#00C8FF"
                    : "rgba(0,200,255,0.12)",
                  color: isFilterBarOpen ? "#000" : "#00C8FF",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  transition: "all 0.18s ease",
                  position: "relative",
                  boxShadow: isFilterBarOpen
                    ? "0 0 10px rgba(0,200,255,0.55), 0 0 20px rgba(0,200,255,0.25)"
                    : "0 0 6px rgba(0,200,255,0.2)",
                }}
              >
                <Filter className="w-3 h-3" />
                Filters
                {hasActiveFilter && (
                  <span
                    style={{
                      position: "absolute",
                      top: 2,
                      right: 2,
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#00C8FF",
                      boxShadow: "0 0 4px #00C8FF",
                    }}
                  />
                )}
              </button>
            )}
          </div>
        </div>

        <TabsContent value="board" className="mt-0 p-0 flex flex-col overflow-hidden">
          <ErrorBoundary>
            <ListContainer boardId={boardId} orgId={orgId} data={filteredListsForView} />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="table" className="mt-0 p-6 pt-4 flex-1 overflow-y-auto">
          <ErrorBoundary>
            <TableView lists={filteredListsForView} />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="calendar" className="mt-0 p-6 pt-4 flex-1 overflow-y-auto">
          <ErrorBoundary>
            <CalendarView cards={filteredCards} boardId={boardId} />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="timeline" className="mt-0 p-4 pt-4 flex-1 overflow-y-auto">
          <ErrorBoundary>
            <GanttView lists={filteredListsForView} />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="sprints" className="mt-0 p-6 pt-4 max-w-3xl flex-1 overflow-y-auto">
          <ErrorBoundary>
            <SprintPanel boardId={boardId} />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="workload" className="mt-0 p-6 pt-4 flex-1 overflow-y-auto">
          <ErrorBoundary>
            <WorkloadView boardId={boardId} lists={filteredListsForView} />
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

