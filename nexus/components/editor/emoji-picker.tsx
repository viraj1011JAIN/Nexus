"use client";

import { useState, memo } from "react";
import EmojiPicker, { Theme, EmojiClickData } from "emoji-picker-react";
import { SmilePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTheme } from "@/components/theme-provider";

interface EmojiPickerComponentProps {
  onSelect: (emoji: string) => void;
}

export const EmojiPickerComponent = ({ onSelect }: EmojiPickerComponentProps) => {
  const [open, setOpen] = useState(false);
  const { resolvedTheme } = useTheme();

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onSelect(emojiData.emoji);
    // Keep picker open for multiple emoji selections
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-accent hover:text-accent-foreground transition-all duration-150"
          title="Insert emoji"
        >
          <SmilePlus className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-full p-0 border-0 shadow-xl" 
        align="start"
        side="bottom"
        onInteractOutside={(e) => {
          // Prevent closing when clicking inside the picker or editor
          e.preventDefault();
        }}
      >
        <EmojiPicker
          onEmojiClick={handleEmojiClick}
          theme={(resolvedTheme === "dark" ? "dark" : "light") as Theme}
          width={350}
          height={400}
          previewConfig={{ showPreview: false }}
          searchPlaceHolder="Search emojis..."
          skinTonesDisabled={false}
        />
      </PopoverContent>
    </Popover>
  );
};

// Export memoized version
export default memo(EmojiPickerComponent);
