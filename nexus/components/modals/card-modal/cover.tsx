"use client";

import { useState } from "react";
import { ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CardCoverPicker } from "@/components/board/card-cover-picker";
import { ErrorBoundary } from "@/components/error-boundary";

interface CoverTabProps {
  cardId: string;
  boardId: string;
  currentColor: string | null;
  currentImage: string | null;
  onCoverChange?: (color: string | null, image: string | null) => void;
}

export function CoverTab({ cardId, boardId, currentColor, currentImage, onCoverChange }: CoverTabProps) {
  const [saving, setSaving] = useState(false);
  const [color, setColor] = useState<string | null>(currentColor);
  const [image, setImage] = useState<string | null>(currentImage);

  const handleSelect = async (type: "color" | "image" | "none", value: string | null) => {
    setSaving(true);
    try {
      const patch: { coverColor?: string | null; coverImageUrl?: string | null } =
        type === "color"
          ? { coverColor: value, coverImageUrl: null }
          : type === "image"
          ? { coverColor: null, coverImageUrl: value }
          : { coverColor: null, coverImageUrl: null };

      const res = await fetch(`/api/card/${encodeURIComponent(cardId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId, ...patch }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Failed to save cover");
      }

      const newColor = type === "color" ? value : null;
      const newImage = type === "image" ? value : null;
      setColor(newColor);
      setImage(newImage);
      onCoverChange?.(newColor, newImage);
      toast.success(type === "none" ? "Cover removed" : "Cover updated!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save cover");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Card Cover</span>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>

      <ErrorBoundary
        fallback={
          <p className="text-sm text-muted-foreground py-4 text-center">
            Failed to render cover picker.
          </p>
        }
      >
        <CardCoverPicker
          currentColor={color}
          currentImage={image}
          onSelect={handleSelect}
        />
      </ErrorBoundary>
    </div>
  );
}
