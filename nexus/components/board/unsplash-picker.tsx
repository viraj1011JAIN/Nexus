"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, X, Loader2, Check, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";

export interface UnsplashPhoto {
  id: string;
  thumbUrl: string;
  fullUrl: string;
  regularUrl: string;
  userName: string;
  userLink: string;
  linkHtml: string;
}

interface UnsplashPickerProps {
  onSelect: (photo: UnsplashPhoto) => void;
  onClear?: () => void;
  selectedId?: string;
}

const DEFAULT_QUERIES = ["architecture", "nature", "technology", "ocean", "mountains", "city"];

export function UnsplashPicker({ onSelect, onClear, selectedId }: UnsplashPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("nature");
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPhotos = useCallback(async (q: string, p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/unsplash?query=${encodeURIComponent(q)}&page=${p}`
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to load photos");
        return;
      }
      setPhotos(p === 1 ? json.photos : (prev) => [...prev, ...json.photos]);
      setTotalPages(json.totalPages);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
}, []);

  // Fetch when the picker opens (initial load only).
  // Subsequent query changes are handled by the debounced handler below.
  useEffect(() => {
    if (!open) return;
    setPage(1);
    fetchPhotos(query, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fetchPhotos]); // intentionally exclude `query` — changes come through handleQueryChange

  // Clear pending debounce timer on unmount to avoid state updates on dead components.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchPhotos(val || "nature", 1);
    }, 500);
  };

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPhotos(query, next);
  };

  const handleSelect = (photo: UnsplashPhoto) => {
    onSelect(photo);
    setOpen(false);
  };

  return (
    <div className="relative">
      {/* Trigger */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="gap-2 text-xs"
        >
          <ImageIcon className="h-3.5 w-3.5" />
          {selectedId ? "Change Background" : "Add Background"}
        </Button>
        {selectedId && onClear && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="gap-1 text-xs text-muted-foreground"
          >
            <X className="h-3 w-3" />
            Remove
          </Button>
        )}
      </div>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-semibold text-base">Choose Board Background</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close picker"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={handleQueryChange}
                  placeholder="Search Unsplash..."
                  className="w-full pl-9 pr-4 py-2 text-sm bg-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  autoComplete="off"
                />
              </div>
              {/* Quick tags */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {DEFAULT_QUERIES.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      setQuery(tag);
                      setPage(1);
                      fetchPhotos(tag, 1);
                    }}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                      query === tag
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {error && (
                <p className="text-sm text-destructive text-center py-8">{error}</p>
              )}
              {loading && photos.length === 0 && (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              {photos.length > 0 && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((photo) => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => handleSelect(photo)}
                        className="relative group rounded-lg overflow-hidden aspect-video focus:outline-none focus:ring-2 focus:ring-primary"
                        title={`Photo by ${photo.userName}`}
                      >
                        <Image
                          src={photo.thumbUrl}
                          alt={`Photo by ${photo.userName}`}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-200"
                          sizes="(max-width: 640px) 33vw, 200px"
                        />
                        {selectedId === photo.id && (
                          <div className="absolute inset-0 bg-primary/30 flex items-center justify-center">
                            <Check className="h-6 w-6 text-white" />
                          </div>
                        )}
                        {/* Attribution overlay */}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-white text-[10px] truncate">{photo.userName}</p>
                        </div>
                      </button>
                    ))}
                  </div>

                  {page < totalPages && (
                    <div className="flex justify-center mt-4">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleLoadMore}
                        disabled={loading}
                      >
                        {loading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                        ) : null}
                        Load more
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Unsplash attribution footer */}
            <div className="px-5 py-3 border-t text-[11px] text-muted-foreground text-center">
              Photos from{" "}
              <a
                href="https://unsplash.com?utm_source=nexus&utm_medium=referral"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                Unsplash
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
