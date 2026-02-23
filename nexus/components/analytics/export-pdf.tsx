"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

interface ExportPDFProps {
  metrics: any;
  boardName: string;
}

export function ExportPDF({ metrics, boardName }: ExportPDFProps) {
  const handleExport = () => {
    try {
      const doc = new jsPDF();

      // Title
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text(`${boardName} - Analytics Report`, 14, 22);

      // Date
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);

      // Overview Section
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Overview Metrics", 14, 45);

      autoTable(doc, {
        startY: 50,
        head: [["Metric", "Value"]],
        body: [
          ["Total Cards", metrics.overview.totalCards.toString()],
          ["Completed", metrics.overview.completedCards.toString()],
          ["In Progress", metrics.overview.inProgressCards.toString()],
          ["Overdue", metrics.overview.overdueCards.toString()],
          ["Completion Rate", `${metrics.overview.completionRate}%`],
          ["Avg. Completion Time", `${metrics.velocity.avgCompletionTimeHours}h`],
          ["Cards Created This Week", metrics.velocity.cardsCreatedThisWeek.toString()],
          ["Cards Completed This Week", metrics.velocity.cardsCompletedThisWeek.toString()],
          ["Trend", metrics.velocity.trend.toUpperCase()],
        ],
        theme: "grid",
        headStyles: { fillColor: [59, 130, 246] },
      });

      // Priority Distribution Section
      const finalY1 = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Priority Distribution", 14, finalY1);

      autoTable(doc, {
        startY: finalY1 + 5,
        head: [["Priority", "Count"]],
        body: [
          ["Urgent", metrics.priorityDistribution.urgent.toString()],
          ["High", metrics.priorityDistribution.high.toString()],
          ["Medium", metrics.priorityDistribution.medium.toString()],
          ["Low", metrics.priorityDistribution.low.toString()],
        ],
        theme: "grid",
        headStyles: { fillColor: [59, 130, 246] },
      });

      // Member Activity Section
      if (metrics.memberActivity.length > 0) {
        const finalY2 = (doc as any).lastAutoTable.finalY + 15;
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Top Contributors", 14, finalY2);

        autoTable(doc, {
          startY: finalY2 + 5,
          head: [["Member", "Created", "Completed", "Comments"]],
          body: metrics.memberActivity.slice(0, 10).map((m: any) => [
            m.userName,
            m.cardsCreated.toString(),
            m.cardsCompleted.toString(),
            m.commentsAdded.toString(),
          ]),
          theme: "grid",
          headStyles: { fillColor: [59, 130, 246] },
        });
      }

      // Add new page for timeline if needed
      if ((doc as any).lastAutoTable.finalY > 200) {
        doc.addPage();
      }

      // Timeline Section
      const finalY3 = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 15 : 20;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Timeline (Last 14 Days)", 14, finalY3);

      autoTable(doc, {
        startY: finalY3 + 5,
        head: [["Date", "Created", "Completed"]],
        body: metrics.timeline.map((t: any) => [
          t.date,
          t.created.toString(),
          t.completed.toString(),
        ]),
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246] },
      });

      // Save the PDF
      const fileName = `${boardName.replace(/\s+/g, "_")}_analytics_${Date.now()}.pdf`;
      doc.save(fileName);
      
      toast.success("PDF exported successfully");
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Failed to export PDF");
    }
  };

  return (
    <Button onClick={handleExport} variant="outline" size="sm">
      <Download className="mr-2 h-4 w-4" />
      Export PDF
    </Button>
  );
}
