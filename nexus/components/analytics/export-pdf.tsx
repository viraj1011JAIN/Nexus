"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { generateBoardReport, type BoardMetrics } from "@/lib/services/pdf-service";

interface ExportPDFProps {
  metrics: BoardMetrics;
  boardName: string;
}

export function ExportPDF({ metrics, boardName }: ExportPDFProps) {
  const handleExport = () => {
    try {
      generateBoardReport({ metrics, boardName });
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
