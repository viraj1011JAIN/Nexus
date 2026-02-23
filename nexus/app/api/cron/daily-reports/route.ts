import { NextResponse } from "next/server";
import { systemDb as db } from "@/lib/db";
import { sendWeeklyDigestEmail, sendDueDateReminderEmail } from "@/lib/email";
import { clerkClient } from "@clerk/nextjs/server";

// NOTE: systemDb is used here intentionally — cron jobs access all organizations
// without a user session. They run under a shared CRON_SECRET and must bypass
// Row-Level Security to generate cross-org aggregate reports.

export async function GET(request: Request) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Get all organizations with their boards
    const orgs = await db.organization.findMany({
      include: {
        boards: {
          include: {
            lists: {
              include: {
                cards: {
                  include: {
                    assignee: { select: { email: true, name: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const reports = [];

    for (const org of orgs) {
      // Calculate org-wide metrics for yesterday
      const allCards = org.boards.flatMap((b) =>
        b.lists.flatMap((l) => l.cards)
      );

      const cardsCreatedYesterday = allCards.filter((c) => {
        const cardDate = new Date(c.createdAt);
        return cardDate >= yesterday && cardDate < today;
      }).length;

      const cardsCompletedYesterday = allCards.filter((c) => {
        if (!c.updatedAt) return false;
        const cardDate = new Date(c.updatedAt);
        // Assuming completion is when card is moved to "Done" list
        const doneList = org.boards
          .flatMap((b) => b.lists)
          .find(
            (l) =>
              l.title.toLowerCase().includes("done") ||
              l.title.toLowerCase().includes("complete")
          );
        return (
          c.listId === doneList?.id &&
          cardDate >= yesterday &&
          cardDate < today
        );
      }).length;

      const reportData = {
        orgId: org.id,
        orgName: org.name,
        date: yesterday.toISOString(),
        metrics: {
          totalBoards: org.boards.length,
          totalCards: allCards.length,
          cardsCreatedYesterday,
          cardsCompletedYesterday,
          overdueCards: allCards.filter(
            (c) => c.dueDate && new Date(c.dueDate) < today
          ).length,
        },
      };

      reports.push(reportData);

      // ─── Weekly digest email (sent every Monday) ────────────────────────
      const isMonday = new Date().getDay() === 1;
      if (isMonday) {
        try {
          // Fetch ALL org members from Clerk (paginated) to get email addresses
          const clerk = await clerkClient();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const allMemberships: any[] = [];
          let offset = 0;
          let pageCount = 0;
          do {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let membershipsPage: { data: any[] };
            try {
              membershipsPage = await clerk.organizations
                .getOrganizationMembershipList({ organizationId: org.id, limit: 100, offset });
            } catch (clerkErr) {
              console.warn(
                `[daily-reports] Failed to fetch memberships for org ${org.id} at offset ${offset}:`,
                clerkErr
              );
              break;
            }
            allMemberships.push(...membershipsPage.data);
            offset += membershipsPage.data.length;
            pageCount = membershipsPage.data.length;
          } while (pageCount === 100);

          // Compute actual 7-day completed count
          const sevenDaysAgo = new Date(today);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const doneListIds = new Set(
            org.boards
              .flatMap((b) => b.lists)
              .filter(
                (l) =>
                  l.title.toLowerCase().includes("done") ||
                  l.title.toLowerCase().includes("complete")
              )
              .map((l) => l.id)
          );
          const cardsCompletedLast7Days = allCards.filter((c) => {
            if (!c.updatedAt) return false;
            const d = new Date(c.updatedAt);
            return doneListIds.has(c.listId) && d >= sevenDaysAgo && d < today;
          }).length;

          const weekStats = {
            cardsCreated: allCards.filter((c) => {
              const d = new Date(c.createdAt);
              const sevenDaysAgo2 = new Date(today);
              sevenDaysAgo2.setDate(sevenDaysAgo2.getDate() - 7);
              return d >= sevenDaysAgo2;
            }).length,
            cardsCompleted: cardsCompletedLast7Days,
            overdueCards: reportData.metrics.overdueCards,
            activeBoards: org.boards.length,
          };

          for (const membership of allMemberships) {
            const user = membership.publicUserData;
            if (!user?.identifier) continue;
            await sendWeeklyDigestEmail({
              userEmail: user.identifier,
              userName: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.identifier,
              stats: weekStats,
              appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://nexus.app",
            }).catch(() => null); // never let email failure break the cron
          }
        } catch {
          console.warn("[CRON] Failed to send weekly digest for org", org.id);
        }
      }

      // ─── Due-date reminder emails (daily) ──────────────────────────────
      try {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dayAfter = new Date(tomorrow);
        dayAfter.setDate(dayAfter.getDate() + 1);

        const dueSoonCards = allCards.filter(
          (c) => c.dueDate && new Date(c.dueDate) >= tomorrow && new Date(c.dueDate) < dayAfter
        );

        if (dueSoonCards.length > 0) {
          for (const card of dueSoonCards) {
            // Only notify the assigned user — skip unassigned cards
            if (!card.assignee) continue;

            const parentBoard = org.boards.find((b) =>
              b.lists.some((l) => l.cards.some((c) => c.id === card.id))
            );
            const cardUrl = parentBoard
              ? `${process.env.NEXT_PUBLIC_APP_URL ?? "https://nexus.app"}/board/${parentBoard.id}`
              : `${process.env.NEXT_PUBLIC_APP_URL ?? "https://nexus.app"}/dashboard`;

            await sendDueDateReminderEmail({
              userEmail: card.assignee.email,
              userName: card.assignee.name,
              cardTitle: card.title,
              boardTitle: parentBoard?.title ?? "Your board",
              dueDate: new Date(card.dueDate!),
              cardUrl,
            }).catch(() => null);
          }
        }
      } catch {
        console.warn("[CRON] Failed to send due-date reminders for org", org.id);
      }
    }

    console.log(`[CRON] Generated ${reports.length} daily reports`);

    return NextResponse.json({
      success: true,
      reportsGenerated: reports.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[DAILY_REPORTS_CRON]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

// Disable body parser for this route (Vercel requirement)
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
