/**
 * PDF Service — lib/services/pdf-service.ts
 *
 * Encapsulates all jsPDF / jspdf-autotable logic for board analytics reports.
 * Components should call `generateBoardReport()` and handle the returned
 * success / error signal — no PDF internals should leak into UI layer.
 *
 * This is a client-side service (jsPDF runs in the browser via the canvas API).
 * Import it only from 'use client' modules.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface BoardMetrics {
  overview: {
    totalCards: number;
    completedCards: number;
    inProgressCards: number;
    overdueCards: number;
    completionRate: number;
  };
  velocity: {
    avgCompletionTimeHours: number;
    cardsCreatedThisWeek: number;
    cardsCompletedThisWeek: number;
    trend: string;
  };
  priorityDistribution: {
    urgent: number;
    high: number;
    medium: number;
    low: number;
  };
  memberActivity: Array<{
    userName: string;
    cardsCreated: number;
    cardsCompleted: number;
    commentsAdded: number;
  }>;
  timeline: Array<{
    date: string;
    created: number;
    completed: number;
  }>;
}

export interface GenerateBoardReportInput {
  metrics: BoardMetrics;
  boardName: string;
}

/**
 * Generates a multi-section PDF analytics report and triggers a browser download.
 * Returns `true` on success, throws on failure (caller is responsible for toast).
 */
export function generateBoardReport({ metrics, boardName }: GenerateBoardReportInput): void {
  const doc = new jsPDF();

  // ── Title ──────────────────────────────────────────────────────────────────
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(`${boardName} - Analytics Report`, 14, 22);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);

  // ── Overview ───────────────────────────────────────────────────────────────
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Overview Metrics", 14, 45);

  autoTable(doc, {
    startY: 50,
    head: [["Metric", "Value"]],
    body: [
      ["Total Cards",                metrics.overview.totalCards.toString()],
      ["Completed",                  metrics.overview.completedCards.toString()],
      ["In Progress",                metrics.overview.inProgressCards.toString()],
      ["Overdue",                    metrics.overview.overdueCards.toString()],
      ["Completion Rate",            `${metrics.overview.completionRate}%`],
      ["Avg. Completion Time",       `${metrics.velocity.avgCompletionTimeHours}h`],
      ["Cards Created This Week",    metrics.velocity.cardsCreatedThisWeek.toString()],
      ["Cards Completed This Week",  metrics.velocity.cardsCompletedThisWeek.toString()],
      ["Trend",                      metrics.velocity.trend.toUpperCase()],
    ],
    theme: "grid",
    headStyles: { fillColor: [59, 130, 246] },
  });

  // ── Priority Distribution ──────────────────────────────────────────────────
  const finalY1 = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Priority Distribution", 14, finalY1);

  autoTable(doc, {
    startY: finalY1 + 5,
    head: [["Priority", "Count"]],
    body: [
      ["Urgent", metrics.priorityDistribution.urgent.toString()],
      ["High",   metrics.priorityDistribution.high.toString()],
      ["Medium", metrics.priorityDistribution.medium.toString()],
      ["Low",    metrics.priorityDistribution.low.toString()],
    ],
    theme: "grid",
    headStyles: { fillColor: [59, 130, 246] },
  });

  // ── Member Activity ────────────────────────────────────────────────────────
  if (metrics.memberActivity.length > 0) {
    const finalY2 = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Top Contributors", 14, finalY2);

    autoTable(doc, {
      startY: finalY2 + 5,
      head: [["Member", "Created", "Completed", "Comments"]],
      body: metrics.memberActivity.slice(0, 10).map((m) => [
        m.userName,
        m.cardsCreated.toString(),
        m.cardsCompleted.toString(),
        m.commentsAdded.toString(),
      ]),
      theme: "grid",
      headStyles: { fillColor: [59, 130, 246] },
    });
  }

  // ── Timeline ───────────────────────────────────────────────────────────────
  if ((doc as any).lastAutoTable.finalY > 200) {
    doc.addPage();
  }

  const finalY3 = (doc as any).lastAutoTable?.finalY
    ? (doc as any).lastAutoTable.finalY + 15
    : 20;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Timeline (Last 14 Days)", 14, finalY3);

  autoTable(doc, {
    startY: finalY3 + 5,
    head: [["Date", "Created", "Completed"]],
    body: metrics.timeline.map((t) => [
      t.date,
      t.created.toString(),
      t.completed.toString(),
    ]),
    theme: "striped",
    headStyles: { fillColor: [59, 130, 246] },
  });

  // ── Save ───────────────────────────────────────────────────────────────────
  const fileName = `${boardName.replace(/\s+/g, "_")}_analytics_${Date.now()}.pdf`;
  doc.save(fileName);
}
