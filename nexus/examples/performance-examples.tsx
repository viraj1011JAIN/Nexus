/**
 * EXAMPLE: Complete Performance Optimization Implementation
 * 
 * This file shows how to use all performance features together
 * in a real-world scenario.
 */

"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */

import { useState, useEffect } from "react";
import { LazyLoad } from "@/components/lazy-load";
import { VirtualScroll } from "@/components/virtual-scroll";
import { SmoothScroll, ScrollToTop } from "@/components/smooth-scroll";
import { usePerformanceMonitoring } from "@/lib/performance";
import { usePrefetch } from "@/lib/prefetch";

// Example: Optimized Board Dashboard
export function OptimizedBoardDashboard() {
  const [boards, setBoards] = useState<any[]>([]);

  // Monitor performance in development
  usePerformanceMonitoring(true);

  // Prefetch common routes
  usePrefetch(["/dashboard", "/settings", "/activity"]);

  useEffect(() => {
    // Fetch boards
    fetchBoards().then(setBoards);
  }, []);

  return (
    <SmoothScroll className="min-h-screen">
      <div className="container py-8">
        <h1 className="text-4xl font-bold mb-8">My Boards</h1>

        {/* Virtual scroll for large lists */}
        <VirtualScroll
          items={boards}
          itemHeight={200}
          containerHeight={800}
          overscan={3}
          renderItem={(board, index) => (
            <LazyLoad minHeight={200} once>
              <BoardCard board={board} index={index} />
            </LazyLoad>
          )}
          className="contain-strict"
        />

        {/* Scroll to top button */}
        <ScrollToTop showAt={400} />
      </div>
    </SmoothScroll>
  );
}

// Example: Optimized Card List with Lazy Loading
export function OptimizedCardList({ cards }: { cards: any[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card, _index) => (
        <LazyLoad
          key={card.id}
          minHeight={150}
          rootMargin="200px"
          threshold={0.01}
          skeleton={<CardSkeleton />}
        >
          <CardItem card={card} />
        </LazyLoad>
      ))}
    </div>
  );
}

// Example: Optimized Image Gallery
export function OptimizedImageGallery({ images }: { images: string[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {images.map((src, index) => (
        <LazyLoad
          key={src}
          minHeight={200}
          className="aspect-square"
          skeleton={<ImageSkeleton />}
        >
          <img
            src={src}
            alt={`Gallery ${index}`}
            className="w-full h-full object-cover rounded-lg gpu-accelerate fade-in-loaded"
            loading="lazy"
            decoding="async"
          />
        </LazyLoad>
      ))}
    </div>
  );
}

// Example: High-performance Activity Feed
export function OptimizedActivityFeed({ activities }: { activities: any[] }) {
  return (
    <VirtualScroll
      items={activities}
      itemHeight={80}
      containerHeight={600}
      overscan={5}
      renderItem={(activity) => (
        <div className="p-4 border-b border-border contain-layout">
          <p className="text-sm font-medium">{activity.title}</p>
          <p className="text-xs text-muted-foreground">{activity.timestamp}</p>
        </div>
      )}
      className="rounded-lg border border-border scroll-smooth"
    />
  );
}

// Skeleton Components
function CardSkeleton() {
  return (
    <div className="skeleton h-[150px] rounded-lg">
      <div className="shimmer absolute inset-0" />
    </div>
  );
}

function ImageSkeleton() {
  return (
    <div className="skeleton aspect-square rounded-lg">
      <div className="shimmer absolute inset-0" />
    </div>
  );
}

// Mock data fetch
async function fetchBoards() {
  return Array.from({ length: 100 }, (_, i) => ({
    id: i,
    title: `Board ${i}`,
    description: `Description for board ${i}`,
  }));
}

// Example component
function BoardCard({ board, index }: { board: any; index: number }) {
  return (
    <div
      className="p-6 bg-card rounded-lg border border-border contain-layout gpu-accelerate"
      style={{
        animationDelay: `${index * 50}ms`,
      }}
    >
      <h3 className="text-xl font-semibold mb-2">{board.title}</h3>
      <p className="text-muted-foreground">{board.description}</p>
    </div>
  );
}

function CardItem({ card }: { card: any }) {
  return (
    <div className="p-4 bg-card rounded-lg border border-border contain-layout">
      <h4 className="font-medium">{card.title}</h4>
      <p className="text-sm text-muted-foreground">{card.description}</p>
    </div>
  );
}

/**
 * CSS USAGE EXAMPLES:
 * 
 * 1. GPU Acceleration:
 *    <div className="gpu-accelerate">Content</div>
 * 
 * 2. Layout Containment:
 *    <div className="contain-layout">Content</div>
 * 
 * 3. Lazy Render:
 *    <div className="lazy-render">Content</div>
 * 
 * 4. Smooth Scroll:
 *    <div className="scroll-smooth overflow-auto">Content</div>
 * 
 * 5. Shimmer Loading:
 *    <div className="skeleton shimmer">Loading...</div>
 * 
 * 6. Will-change optimization:
 *    <div className="will-change-transform">Animated content</div>
 */
