import { NextResponse } from "next/server";
import { systemDb as db } from "@/lib/db";

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
                cards: true,
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

      // Here you would send email via Resend or another service
      // Example:
      // await resend.emails.send({
      //   from: "NEXUS Reports <reports@yourdomain.com>",
      //   to: ["admin@example.com"], // Get org admin emails
      //   subject: `Daily Analytics Report - ${org.name}`,
      //   html: generateEmailHTML(reportData),
      // });
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
