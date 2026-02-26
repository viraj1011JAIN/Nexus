"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

interface BoardMetrics {
  overview: {
    totalCards: number;
    completedCards: number;
    inProgressCards: number;
    overdueCards: number;
    completionRate: number;
  };
  velocity: {
    cardsCreatedThisWeek: number;
    cardsCompletedThisWeek: number;
    avgCompletionTimeHours: number;
    trend: "up" | "down" | "stable";
  };
  priorityDistribution: {
    urgent: number;
    high: number;
    medium: number;
    low: number;
  };
  memberActivity: {
    userId: string;
    userName: string;
    cardsCreated: number;
    cardsCompleted: number;
    commentsAdded: number;
  }[];
  timeline: {
    date: string;
    created: number;
    completed: number;
  }[];
}

export async function getBoardAnalytics(
  boardId: string,
  days: number = 14,
): Promise<{ data?: BoardMetrics; error?: string }> {
  try {
    const { userId, orgId } = await auth();

    if (!userId || !orgId) {
      return { error: "Unauthorized" };
    }

    // Verify board access
    const board = await db.board.findUnique({
      where: { id: boardId, orgId },
      include: {
        lists: {
          include: {
            cards: {
              include: {
                assignee: true,
              },
            },
          },
        },
      },
    });

    if (!board) {
      return { error: "Board not found" };
    }

    // Calculate overview metrics
    const allCards = board.lists.flatMap((list) => list.cards);
    const completedListId = board.lists.find((l) => 
      l.title.toLowerCase().includes("done") || 
      l.title.toLowerCase().includes("complete")
    )?.id;

    const completedCards = allCards.filter(
      (c) => c.listId === completedListId
    );
    const overdueCards = allCards.filter(
      (c) => c.dueDate && new Date(c.dueDate) < new Date() && c.listId !== completedListId
    );

    const overview = {
      totalCards: allCards.length,
      completedCards: completedCards.length,
      inProgressCards: allCards.length - completedCards.length,
      overdueCards: overdueCards.length,
      completionRate:
        allCards.length > 0
          ? Math.round((completedCards.length / allCards.length) * 100)
          : 0,
    };

    // Calculate velocity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentCards = allCards.filter(
      (c) => new Date(c.createdAt) >= sevenDaysAgo
    );
    const recentCompleted = completedCards.filter(
      (c) => c.updatedAt && new Date(c.updatedAt) >= sevenDaysAgo
    );

    // Calculate avg completion time
    const completionTimes = completedCards
      .filter((c) => c.createdAt && c.updatedAt)
      .map((c) => {
        const created = new Date(c.createdAt).getTime();
        const completed = new Date(c.updatedAt).getTime();
        return (completed - created) / (1000 * 60 * 60); // hours
      });

    const avgCompletionTime =
      completionTimes.length > 0
        ? Math.round(
            completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
          )
        : 0;

    const velocity = {
      cardsCreatedThisWeek: recentCards.length,
      cardsCompletedThisWeek: recentCompleted.length,
      avgCompletionTimeHours: avgCompletionTime,
      trend: (recentCompleted.length > recentCards.length * 0.7
        ? "up"
        : recentCompleted.length < recentCards.length * 0.3
        ? "down"
        : "stable") as "up" | "down" | "stable",
    };

    // Priority distribution
    const priorityDistribution = {
      urgent: allCards.filter((c) => c.priority === "URGENT").length,
      high: allCards.filter((c) => c.priority === "HIGH").length,
      medium: allCards.filter((c) => c.priority === "MEDIUM").length,
      low: allCards.filter((c) => c.priority === "LOW" || !c.priority).length,
    };

    // Member activity
    const memberMap = new Map<string, {
      userId: string;
      userName: string;
      cardsCreated: number;
      cardsCompleted: number;
      commentsAdded: number;
    }>();

    for (const card of allCards) {
      if (card.assignee) {
        const existing = memberMap.get(card.assignee.id) || {
          userId: card.assignee.id,
          userName: card.assignee.name,
          cardsCreated: 0,
          cardsCompleted: 0,
          commentsAdded: 0,
        };

        existing.cardsCreated++;
        if (card.listId === completedListId) {
          existing.cardsCompleted++;
        }

        memberMap.set(card.assignee.id, existing);
      }
    }

    // Get comment counts
    const comments = await db.comment.groupBy({
      by: ["userId"],
      where: {
        card: {
          list: {
            boardId: board.id,
          },
        },
      },
      _count: {
        id: true,
      },
    });

    for (const comment of comments) {
      const existing = memberMap.get(comment.userId);
      if (existing) {
        existing.commentsAdded = comment._count.id;
      }
    }

    const memberActivity = Array.from(memberMap.values()).sort(
      (a, b) => b.cardsCompleted - a.cardsCompleted
    );

    // Timeline data (last N days based on `days` param; 0 = all time, capped at 90)
    const effectiveDays = days === 0 ? 90 : days;
    const timeline: { date: string; created: number; completed: number }[] = [];
    
    for (let i = effectiveDays - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];

      const created = allCards.filter((c) => {
        const cardDate = new Date(c.createdAt).toISOString().split("T")[0];
        return cardDate === dateStr;
      }).length;

      const completed = completedCards.filter((c) => {
        if (!c.updatedAt) return false;
        const cardDate = new Date(c.updatedAt).toISOString().split("T")[0];
        return cardDate === dateStr;
      }).length;

      timeline.push({ date: dateStr, created, completed });
    }

    return {
      data: {
        overview,
        velocity,
        priorityDistribution,
        memberActivity,
        timeline,
      },
    };
  } catch (error) {
    console.error("[GET_BOARD_ANALYTICS]", error);
    return { error: "Failed to fetch analytics" };
  }
}
