"use client";

import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";

interface VirtualScrollProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => ReactNode;
  overscan?: number;
  className?: string;
  onScroll?: (scrollTop: number) => void;
}

/**
 * Production-level virtual scrolling for massive lists
 * Only renders visible items + overscan for ultra-smooth performance
 * 
 * Perfect for:
 * - Large data tables
 * - Infinite scroll lists
 * - Activity feeds
 * - Board cards
 */
export function VirtualScroll<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 3,
  className = "",
  onScroll,
}: VirtualScrollProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate visible range
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = items.slice(startIndex, endIndex + 1);
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  // Optimized scroll handler with RAF
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const newScrollTop = containerRef.current.scrollTop;
    setScrollTop(newScrollTop);
    onScroll?.(newScrollTop);
  }, [onScroll]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let rafId: number | null = null;

    const onScrollRAF = () => {
      if (rafId) return;

      rafId = requestAnimationFrame(() => {
        handleScroll();
        rafId = null;
      });
    };

    container.addEventListener("scroll", onScrollRAF, { passive: true });

    return () => {
      container.removeEventListener("scroll", onScrollRAF);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [handleScroll]);

  return (
    <div
      ref={containerRef}
      className={`virtual-scroll overflow-auto ${className}`}
      style={{
        height: containerHeight,
        contain: "strict",
        willChange: "scroll-position",
      }}
    >
      <div
        style={{
          height: totalHeight,
          position: "relative",
        }}
      >
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            willChange: "transform",
          }}
        >
          {visibleItems.map((item, index) => (
            <div
              key={startIndex + index}
              style={{
                height: itemHeight,
                contain: "layout style paint",
              }}
            >
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Dynamic height virtual scroll for variable-height items
 */
interface DynamicVirtualScrollProps<T> {
  items: T[];
  estimatedItemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => ReactNode;
  overscan?: number;
  className?: string;
}

export function DynamicVirtualScroll<T>({
  items,
  estimatedItemHeight,
  containerHeight,
  renderItem,
  overscan = 3,
  className = "",
}: DynamicVirtualScrollProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const [itemHeights, setItemHeights] = useState<Map<number, number>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Measure item heights
  useEffect(() => {
    const newHeights = new Map<number, number>();
    
    itemRefs.current.forEach((element, index) => {
      if (element) {
        newHeights.set(index, element.offsetHeight);
      }
    });

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItemHeights(newHeights);
  }, [items]);

  // Calculate positions
  const itemOffsets: number[] = [];
  let totalHeight = 0;

  items.forEach((_, index) => {
    itemOffsets[index] = totalHeight;
    const height = itemHeights.get(index) || estimatedItemHeight;
    totalHeight += height;
  });

  // Find visible range
  let startIndex = 0;
  let endIndex = items.length - 1;

  for (let i = 0; i < items.length; i++) {
    if (itemOffsets[i] <= scrollTop) startIndex = i;
    if (itemOffsets[i] <= scrollTop + containerHeight) endIndex = i;
  }

  startIndex = Math.max(0, startIndex - overscan);
  endIndex = Math.min(items.length - 1, endIndex + overscan);

  const visibleItems = items.slice(startIndex, endIndex + 1);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    setScrollTop(containerRef.current.scrollTop);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let rafId: number | null = null;

    const onScrollRAF = () => {
      if (rafId) return;

      rafId = requestAnimationFrame(() => {
        handleScroll();
        rafId = null;
      });
    };

    container.addEventListener("scroll", onScrollRAF, { passive: true });

    return () => {
      container.removeEventListener("scroll", onScrollRAF);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [handleScroll]);

  return (
    <div
      ref={containerRef}
      className={`virtual-scroll overflow-auto ${className}`}
      style={{
        height: containerHeight,
        contain: "strict",
      }}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        {visibleItems.map((item, i) => {
          const index = startIndex + i;
          return (
            <div
              key={index}
              ref={(el) => {
                if (el) itemRefs.current.set(index, el);
              }}
              style={{
                position: "absolute",
                top: itemOffsets[index],
                width: "100%",
                contain: "layout style paint",
              }}
            >
              {renderItem(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
