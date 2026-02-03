"use client";

import { useState } from "react";
import { Editor } from "@tiptap/react";
import { Link2, ExternalLink, Unlink, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface LinkPopoverProps {
  editor: Editor;
}

export const LinkPopover = ({ editor }: LinkPopoverProps) => {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      const previousUrl = editor.getAttributes("link").href || "";
      setUrl(previousUrl);
    }
  };

  const handleSetLink = () => {
    if (!url) {
      editor.chain().focus().unsetLink().run();
      setOpen(false);
      return;
    }

    // Add https:// if no protocol specified
    let finalUrl = url;
    if (!/^https?:\/\//i.test(url)) {
      finalUrl = `https://${url}`;
    }

    editor.chain().focus().setLink({ href: finalUrl }).run();
    setOpen(false);
    setUrl("");
  };

  const handleRemoveLink = () => {
    editor.chain().focus().unsetLink().run();
    setOpen(false);
    setUrl("");
  };

  const isActive = editor.isActive("link");

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 hover:bg-accent hover:text-accent-foreground transition-all duration-150 ${isActive ? "bg-accent text-accent-foreground" : ""}`}
          title="Add link (Ctrl+K)"
        >
          <Link2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 shadow-xl" align="start" side="bottom">
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Link URL</label>
            <div className="flex gap-2">
              <Input
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSetLink();
                  }
                  if (e.key === "Escape") {
                    setOpen(false);
                  }
                }}
                autoFocus
                className="flex-1"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSetLink}
              size="sm"
              className="flex-1 gap-2"
            >
              <Check className="h-3 w-3" />
              {isActive ? "Update" : "Add"} Link
            </Button>
            {isActive && (
              <Button
                onClick={handleRemoveLink}
                size="sm"
                variant="outline"
                className="gap-2"
              >
                <Unlink className="h-3 w-3" />
                Remove
              </Button>
            )}
          </div>

          {isActive && url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Open link in new tab
            </a>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
