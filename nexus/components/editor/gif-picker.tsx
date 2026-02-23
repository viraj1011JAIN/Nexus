"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useCallback, memo } from "react";
import { Sparkles, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
}

interface TenorGif {
  id: string;
  media_formats: {
    tinygif: { url: string };
    gif: { url: string };
  };
  content_description: string;
}

export const GifPicker = ({ onSelect }: GifPickerProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [gifs, setGifs] = useState<TenorGif[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchGifs = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const endpoint = query
        ? `/api/tenor/search?q=${encodeURIComponent(query)}&limit=20`
        : `/api/tenor/featured?limit=20`;

      const response = await fetch(endpoint);
      const data = await response.json();
      setGifs(data.results || []);
    } catch (error) {
      console.error("Failed to fetch GIFs:", error);
      setGifs([]);
    } finally {
      setLoading(false);
    }
  }, []); // Empty deps - stable function

  // Fetch when modal opens or search changes
  useEffect(() => {
    if (!open) return;
    
    // Debounce search, but fetch immediately on open
    const timer = setTimeout(() => {
      fetchGifs(search);
    }, search ? 400 : 0); // No delay when opening, 400ms delay for search
    
    return () => clearTimeout(timer);
  }, [open, search, fetchGifs]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-accent hover:text-accent-foreground transition-all duration-150"
          title="Insert GIF"
        >
          <Sparkles className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[450px] p-0 shadow-xl" 
        align="start" 
        side="bottom"
        onInteractOutside={(e) => {
          // Prevent closing when clicking inside the picker or editor
          e.preventDefault();
        }}
      >
        <div className="flex flex-col h-[500px]">
          {/* Search Header */}
          <div className="p-3 border-b bg-muted/30">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search GIFs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background"
                autoFocus
              />
            </div>
          </div>

          {/* GIF Grid */}
          <ScrollArea className="flex-1 p-2">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Loading GIFs...</p>
                </div>
              </div>
            ) : gifs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground px-4 text-center">
                <Sparkles className="h-8 w-8" />
                <p className="text-sm font-medium">No GIFs available</p>
                <p className="text-xs">
                  {search 
                    ? "Try a different search term" 
                    : "Configure GIPHY_API_KEY in .env to enable GIF search (easiest option)"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {gifs.map((gif) => {
                  const handleClick = () => {
                    onSelect(gif.media_formats.gif.url);
                    // Keep picker open for multiple GIF selections
                  };
                  
                  return (
                  <button
                    key={gif.id}
                    onClick={handleClick}
                    className="relative aspect-square rounded-lg overflow-hidden hover:ring-2 hover:ring-primary transition-all group bg-muted"
                  >
                    <img
                      src={gif.media_formats.tinygif.url}
                      alt={gif.content_description}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      loading="lazy"
                    />
                  </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="p-2 border-t bg-muted/30 text-xs text-muted-foreground text-center">
            Powered by Giphy
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Export memoized version
export default memo(GifPicker);
