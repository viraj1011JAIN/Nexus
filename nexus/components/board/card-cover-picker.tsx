"use client";

import { useState } from "react";
import { Palette, Image as ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const COVER_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16",
  "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6",
  "#ec4899", "#64748b", "#0f172a", "#fbbf24",
];

const UNSPLASH_COVERS = [
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80",
  "https://images.unsplash.com/photo-1518791841217-8f162f1912da?w=600&q=80",
  "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=600&q=80",
  "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=600&q=80",
  "https://images.unsplash.com/photo-1557683316-973673baf926?w=600&q=80",
  "https://images.unsplash.com/photo-1509343256512-d77a5cb3791b?w=600&q=80",
  "https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?w=600&q=80",
  "https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?w=600&q=80",
];

interface CardCoverPickerProps {
  currentColor: string | null;
  currentImage: string | null;
  onSelect: (type: "color" | "image" | "none", value: string | null) => void;
}

export function CardCoverPicker({ currentColor, currentImage, onSelect }: CardCoverPickerProps) {
  const [tab, setTab] = useState<"color" | "photo">("color");
  const [customUrl, setCustomUrl] = useState("");

  const hasCover = !!(currentColor || currentImage);

  return (
    <div className="space-y-3">
      {/* Current cover preview */}
      {hasCover && (
        <div className="relative rounded-lg overflow-hidden h-16">
          <div
            className="w-full h-full"
            style={
              currentImage
                ? { backgroundImage: `url(${currentImage})`, backgroundSize: "cover", backgroundPosition: "center" }
                : { backgroundColor: currentColor ?? undefined }
            }
          />
          <button
            onClick={() => onSelect("none", null)}
            className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
        <button
          onClick={() => setTab("color")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-md transition-all",
            tab === "color"
              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
          )}
        >
          <Palette className="h-3 w-3" />
          Color
        </button>
        <button
          onClick={() => setTab("photo")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-md transition-all",
            tab === "photo"
              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
          )}
        >
          <ImageIcon className="h-3 w-3" />
          Photo
        </button>
      </div>

      {/* Color swatches */}
      {tab === "color" && (
        <div className="grid grid-cols-6 gap-2">
          {COVER_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => onSelect("color", color)}
              className={cn(
                "h-8 rounded-lg transition-all hover:scale-110 ring-offset-2",
                currentColor === color && "ring-2 ring-slate-900 dark:ring-slate-100"
              )}
              style={{ backgroundColor: color }}
              aria-label={`Cover color ${color}`}
            />
          ))}
        </div>
      )}

      {/* Photo grid */}
      {tab === "photo" && (
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-1.5">
            {UNSPLASH_COVERS.map((url) => (
              <button
                key={url}
                onClick={() => onSelect("image", url)}
                className={cn(
                  "h-12 rounded-md overflow-hidden ring-offset-1 transition-all hover:scale-105",
                  currentImage === url && "ring-2 ring-slate-900 dark:ring-slate-100"
                )}
                style={{ backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center" }}
                aria-label="Select cover photo"
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Paste image URL..."
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              className="h-8 text-xs"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs px-3"
              disabled={!customUrl.startsWith("http")}
              onClick={() => {
                if (customUrl.startsWith("http")) {
                  onSelect("image", customUrl);
                  setCustomUrl("");
                }
              }}
            >
              Use
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
