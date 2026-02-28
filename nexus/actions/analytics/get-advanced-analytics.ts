"use server";
import "server-only";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdvancedBoardAnalytics {
  /** Burndown: remaining open cards per day over the last 60 days */
  burndown: { date: string; remaining: number; ideal: number }[];

  /** Weekly throughput (last 9 weeks) */
  throughput: { week: string; completed: number; created: number }[];

  /** Cycle time (hours) distribution histogram + percentile stats */
  cycleTime: {
    histogram: { label: string; count: number }[];
    avg: number;
    p50: number;
    p75: number;
    p90: number;
    sampleCount: number;
  };

  /** Cumulative flow – cards per list per day (last 60 days) */
  cumulativeFlow: { date: string; [list: string]: number | string }[];
  listNames: string[];

  /** Per-list bottleneck stats */
  listStats: {
    listId: string;
    listTitle: string;
    cardCount: number;
    overdueCount: number;
    avgAgeDays: number;
    completedList: boolean;
  }[];

  /** Assignment / due-date coverage */
  coverage: {
    total: number;
    withAssignee: number;
    withDueDate: number;
    withBothPercent: number;
    assigneePercent: number;
    dueDatePercent: number;
  };

  /** Cards created by day-of-week (0=Sun … 6=Sat) */
  creationPattern: { day: string; count: number }[];

  /** Top labels by card count */
  topLabels: { name: string; color: string; count: number }[];

  /** Quick score cards */
  scores: {
    healthScore: number;       // 0-100
    velocityScore: number;     // 0-100
    coverageScore: number;     // 0-100
    overdueScore: number;      // 0-100 (higher = fewer overdue)
  };

  /**
   * Lead time trend: weekly average hours from card creation to completion.
   * Parallel to throughput weeks so the two charts can be compared side-by-side.
   */
  leadTimeTrend: { week: string; avgHours: number; p50: number; count: number }[];

  /**
   * Per-member contribution stats derived from assignee relationships.
   * Sorted by total card count descending, capped at 10 members.
   */
  memberStats: {
    name: string;
    totalCards: number;
    completedCards: number;
    overdueCards: number;
    avgLeadTimeHours: number;
  }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return Math.round(sorted[Math.max(0, idx)]);
}

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Action ───────────────────────────────────────────────────────────────────

export async function getAdvancedBoardAnalytics(
  boardId: string,
): Promise<{ data?: AdvancedBoardAnalytics; error?: string }> {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) return { error: "Unauthorized" };

    const board = await db.board.findUnique({
      where: { id: boardId, orgId },
      include: {
        lists: {
          orderBy: { order: "asc" },
          include: {
            cards: {
              include: {
                assignee: { select: { id: true, name: true } },
                labels: { include: { label: true } },
              },
            },
          },
        },
      },
    });

    if (!board) return { error: "Board not found" };

    const now = new Date();
    const allCards = board.lists.flatMap((l) => l.cards);

    // Detect "done" list(s) heuristically
    const doneListIds = new Set(
      board.lists
        .filter((l) =>
          /done|complete|finished|closed/i.test(l.title),
        )
        .map((l) => l.id),
    );

    const completedCards = allCards.filter((c) => doneListIds.has(c.listId));
    const openCards = allCards.filter((c) => !doneListIds.has(c.listId));

    // ─── 1. Burndown (last 60 days) ─────────────────────────────────────────
    const DAYS = 60;
    const _totalStart = allCards.length; // approximation: current total as "scope"
    const burndown: { date: string; remaining: number; ideal: number }[] = [];

    for (let i = DAYS - 1; i >= 0; i--) {
      const day = addDays(now, -i);
      const dayStr = dateKey(day);

      // Cards that were open at end-of-day = created before or on that day AND not yet completed
      const createdByDay = allCards.filter(
        (c) => dateKey(new Date(c.createdAt)) <= dayStr,
      ).length;
      const completedByDay = completedCards.filter((c) => {
        // Prefer a dedicated completedAt timestamp when available; fall back to
        // updatedAt for boards that don't yet track it explicitly.
        const completedDate =
          (c as unknown as { completedAt?: Date | null }).completedAt ?? c.updatedAt;
        return completedDate && dateKey(new Date(completedDate)) <= dayStr;
      }).length;

      const remaining = Math.max(0, createdByDay - completedByDay);
      const ideal = Math.max(
        0,
        Math.round(openCards.length - (openCards.length / (DAYS - 1)) * (DAYS - 1 - i)),
      );

      burndown.push({ date: dayStr, remaining, ideal });
    }

    // ─── 2. Throughput (last 9 weeks) ────────────────────────────────────────
    const throughput: { week: string; completed: number; created: number }[] = [];
    for (let w = 8; w >= 0; w--) {
      const weekEnd = addDays(now, -w * 7);
      const weekStart = addDays(weekEnd, -6);
      const weekLabel = `${dateKey(weekStart).slice(5)}`;

      const created = allCards.filter((c) => {
        const d = new Date(c.createdAt);
        return d >= weekStart && d <= weekEnd;
      }).length;

      const completed = completedCards.filter((c) => {
        if (!c.updatedAt) return false;
        const d = new Date(c.updatedAt);
        return d >= weekStart && d <= weekEnd;
      }).length;

      throughput.push({ week: weekLabel, completed, created });
    }

    // ─── 2b. Lead time trend (last 9 weeks, same buckets as throughput) ──────
    const leadTimeTrend: { week: string; avgHours: number; p50: number; count: number }[] = [];
    for (let w = 8; w >= 0; w--) {
      const weekEnd = addDays(now, -w * 7);
      const weekStart = addDays(weekEnd, -6);
      const weekLabel2 = dateKey(weekStart).slice(5);

      const times = completedCards
        .filter((c) => {
          if (!c.updatedAt) return false;
          const d = new Date(c.updatedAt);
          return d >= weekStart && d <= weekEnd;
        })
        .filter((c) => c.createdAt)
        .map((c) =>
          Math.max(
            0,
            (new Date(c.updatedAt!).getTime() - new Date(c.createdAt).getTime()) /
              (1000 * 60 * 60),
          ),
        )
        .sort((a, b) => a - b);

      leadTimeTrend.push({
        week: weekLabel2,
        avgHours:
          times.length > 0
            ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
            : 0,
        p50: percentile(times, 50),
        count: times.length,
      });
    }

    // ─── 3. Cycle time ───────────────────────────────────────────────────────
    const cycleTimes = completedCards
      .filter((c) => c.createdAt && c.updatedAt)
      .map((c) => {
        const hours =
          (new Date(c.updatedAt!).getTime() - new Date(c.createdAt).getTime()) /
          (1000 * 60 * 60);
        return Math.max(0, hours);
      })
      .sort((a, b) => a - b);

    // Histogram buckets (hours): <4, 4-24, 24-72, 72-168, >168
    const buckets = [
      { label: "<4h", min: 0, max: 4 },
      { label: "4-24h", min: 4, max: 24 },
      { label: "1-3d", min: 24, max: 72 },
      { label: "3-7d", min: 72, max: 168 },
      { label: ">7d", min: 168, max: Infinity },
    ];

    const histogram = buckets.map((b) => ({
      label: b.label,
      count: cycleTimes.filter((h) => h >= b.min && h < b.max).length,
    }));

    const avg =
      cycleTimes.length > 0
        ? Math.round(cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length)
        : 0;

    const cycleTime = {
      histogram,
      avg,
      p50: percentile(cycleTimes, 50),
      p75: percentile(cycleTimes, 75),
      p90: percentile(cycleTimes, 90),
      sampleCount: cycleTimes.length,
    };

    // ─── 4. Cumulative flow (last 60 days) ───────────────────────────────────
    const CF_DAYS = 60;
    const listNames = board.lists.map((l) => l.title);

    const cumulativeFlow: { date: string; [list: string]: number | string }[] = [];

    for (let i = CF_DAYS - 1; i >= 0; i--) {
      const day = addDays(now, -i);
      const dayStr = dateKey(day);

      const row: { date: string; [list: string]: number | string } = { date: dayStr };

      for (const list of board.lists) {
        // Cards that exist in this list and were created on or before this day
        // (simplified: use current list membership as proxy)
        const count = list.cards.filter(
          (c) => dateKey(new Date(c.createdAt)) <= dayStr,
        ).length;
        row[list.title] = count;
      }

      cumulativeFlow.push(row);
    }

    // ─── 5. List bottleneck stats ─────────────────────────────────────────────
    const listStats = board.lists.map((list) => {
      const overdue = list.cards.filter(
        (c) =>
          c.dueDate &&
          new Date(c.dueDate) < now &&
          !doneListIds.has(c.listId),
      ).length;

      const ageDays =
        list.cards.length > 0
          ? list.cards.reduce((sum, c) => {
              const created = new Date(c.createdAt);
              return sum + (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
            }, 0) / list.cards.length
          : 0;

      return {
        listId: list.id,
        listTitle: list.title,
        cardCount: list.cards.length,
        overdueCount: overdue,
        avgAgeDays: Math.round(ageDays * 10) / 10,
        completedList: doneListIds.has(list.id),
      };
    });

    // ─── 6. Coverage ─────────────────────────────────────────────────────────
    const total = openCards.length;
    const withAssignee = openCards.filter((c) => c.assigneeId).length;
    const withDueDate = openCards.filter((c) => c.dueDate).length;
    const withBoth = openCards.filter((c) => c.assigneeId && c.dueDate).length;

    const coverage = {
      total,
      withAssignee,
      withDueDate,
      withBothPercent: total > 0 ? Math.round((withBoth / total) * 100) : 0,
      assigneePercent: total > 0 ? Math.round((withAssignee / total) * 100) : 0,
      dueDatePercent: total > 0 ? Math.round((withDueDate / total) * 100) : 0,
    };

    // ─── 7. Day-of-week creation pattern ─────────────────────────────────────
    const dowCounts = Array(7).fill(0);
    for (const card of allCards) {
      dowCounts[new Date(card.createdAt).getDay()]++;
    }
    const creationPattern = dowCounts.map((count, i) => ({ day: DOW[i], count }));

    // ─── 8. Top labels ────────────────────────────────────────────────────────
    const labelMap = new Map<string, { name: string; color: string; count: number }>();
    for (const card of allCards) {
      for (const la of card.labels ?? []) {
        const l = la.label;
        if (!l) continue;
        const existing = labelMap.get(l.id) ?? { name: l.name, color: l.color, count: 0 };
        existing.count++;
        labelMap.set(l.id, existing);
      }
    }
    const topLabels = [...labelMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // ─── 9. Member stats ──────────────────────────────────────────────────────
    const memberMap = new Map<
      string,
      { name: string; totalCards: number; completedCards: number; overdueCards: number; leadTimes: number[] }
    >();

    for (const card of allCards) {
      if (!card.assigneeId || !card.assignee) continue;
      const existing = memberMap.get(card.assigneeId) ?? {
        name: card.assignee.name ?? "Unknown",
        totalCards: 0,
        completedCards: 0,
        overdueCards: 0,
        leadTimes: [],
      };
      existing.totalCards++;
      if (doneListIds.has(card.listId)) {
        existing.completedCards++;
        if (card.createdAt) {
          // Use the same completion-date logic as the burndown section: prefer a
          // dedicated completedAt timestamp, fall back to updatedAt so lead-time
          // is consistent across all analytics.
          const completionDate =
            (card as unknown as { completedAt?: Date | null }).completedAt ?? card.updatedAt;
          const hrs = Math.max(
            0,
            (new Date(completionDate).getTime() - new Date(card.createdAt).getTime()) /
              (1000 * 60 * 60),
          );
          existing.leadTimes.push(hrs);
        }
      }
      if (card.dueDate && new Date(card.dueDate) < now && !doneListIds.has(card.listId)) {
        existing.overdueCards++;
      }
      memberMap.set(card.assigneeId, existing);
    }

    const memberStats = [...memberMap.values()]
      .sort((a, b) => b.totalCards - a.totalCards)
      .slice(0, 10)
      .map(({ leadTimes, ...rest }) => ({
        ...rest,
        avgLeadTimeHours:
          leadTimes.length > 0
            ? Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length)
            : 0,
      }));

    // ─── 10. Scores ───────────────────────────────────────────────────────────
    const overdueCount = allCards.filter(
      (c) =>
        c.dueDate &&
        new Date(c.dueDate) < now &&
        !doneListIds.has(c.listId),
    ).length;

    const overdueScore = Math.max(
      0,
      100 - Math.round((overdueCount / Math.max(1, total)) * 100),
    );

    // Velocity: completions last 7 days vs prior 7 days
    const sevenAgo = addDays(now, -7);
    const fourteenAgo = addDays(now, -14);
    const lastWeekDone = completedCards.filter(
      (c) => c.updatedAt && new Date(c.updatedAt) >= sevenAgo,
    ).length;
    const prevWeekDone = completedCards.filter(
      (c) =>
        c.updatedAt &&
        new Date(c.updatedAt) >= fourteenAgo &&
        new Date(c.updatedAt) < sevenAgo,
    ).length;
    const velocityScore = Math.min(
      100,
      prevWeekDone === 0
        ? lastWeekDone > 0
          ? 80
          : 50
        : Math.round((lastWeekDone / prevWeekDone) * 50 + 50),
    );

    const coverageScore = Math.round((coverage.assigneePercent + coverage.dueDatePercent) / 2);

    const completionRate =
      allCards.length > 0
        ? Math.round((completedCards.length / allCards.length) * 100)
        : 0;
    const healthScore = Math.round(
      completionRate * 0.3 + overdueScore * 0.3 + coverageScore * 0.2 + velocityScore * 0.2,
    );

    const scores = { healthScore, velocityScore, coverageScore, overdueScore };

    return {
      data: {
        burndown,
        throughput,
        cycleTime,
        cumulativeFlow,
        listNames,
        listStats,
        coverage,
        creationPattern,
        topLabels,
        scores,
        leadTimeTrend,
        memberStats,
      },
    };
  } catch (e) {
    console.error("[GET_ADVANCED_ANALYTICS]", e);
    return { error: "Failed to compute advanced analytics" };
  }
}
