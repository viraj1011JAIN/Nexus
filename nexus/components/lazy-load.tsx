"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";

interface LazyLoadProps {
  children: ReactNode;
  className?: string;
  rootMargin?: string;
  threshold?: number;
  minHeight?: number;
  skeleton?: ReactNode;
  once?: boolean;
}

/**
 * Production-level lazy loading component with Intersection Observer
 * Renders children only when they enter the viewport
 * 
 * @param rootMargin - Distance from viewport to start loading (default: "200px")
 * @param threshold - Percentage of visibility to trigger (0-1)
 * @param minHeight - Minimum height for placeholder (prevents layout shift)
 * @param skeleton - Custom loading skeleton
 * @param once - Only load once (true) or re-evaluate on scroll (false)
 */
export function LazyLoad({
  children,
  className = "",
  rootMargin = "200px",
  threshold = 0.01,
  minHeight = 100,
  skeleton,
  once = true,
}: LazyLoadProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    // If already loaded and once=true, skip observer
    if (hasLoaded && once) return;

    // Intersection Observer for lazy loading
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            setHasLoaded(true);
            
            // Unobserve if once=true
            if (once) {
              observer.unobserve(element);
            }
          } else if (!once) {
            setIsVisible(false);
          }
        });
      },
      {
        rootMargin,
        threshold,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [rootMargin, threshold, once, hasLoaded]);

  return (
    <div
      ref={containerRef}
      className={`lazy-render ${className}`}
      style={{
        minHeight: !isVisible && !hasLoaded ? `${minHeight}px` : undefined,
        containIntrinsicSize: `0 ${minHeight}px`,
      }}
    >
      {isVisible ? (
        children
      ) : skeleton ? (
        skeleton
      ) : (
        <div className="w-full h-full animate-pulse bg-muted/20 rounded-lg" />
      )}
    </div>
  );
}

/**
 * Lazy load wrapper for images with built-in loading states
 */
interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  /**
   * CSS aspect-ratio value applied to the wrapper when width/height are not
   * provided and next/image's fill mode is used. Without this the wrapper
   * collapses to zero height. Defaults to "16/9".
   * @example "4/3" | "1/1" | "16/9"
   */
  aspectRatio?: string;
}

export function LazyImage({
  src,
  alt,
  className = "",
  width,
  height,
  priority = false,
  aspectRatio = "16/9",
}: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // next/image requires explicit dimensions or fill mode.
  // Use fill (requires a positioned parent) when width/height are not supplied.
  const hasDimensions = !!(width && height);

  // In fill mode the parent must have an explicit size; apply aspect-ratio so the
  // wrapper never collapses to zero height when no intrinsic dimensions are given.
  const wrapperStyle = hasDimensions ? undefined : { aspectRatio };

  return (
    <div className="relative w-full" style={wrapperStyle}>
      {!loaded && !error && !priority && (
        <div className="absolute inset-0 animate-pulse bg-muted/20 rounded" />
      )}
      {!error && (
        <Image
          src={src}
          alt={alt}
          {...(hasDimensions
            ? { width: width!, height: height! }
            : { fill: true, sizes: "(max-width: 768px) 100vw, 50vw" })}
          className={`${className}${
            priority
              ? ""
              : ` transition-opacity duration-300 ${
                  loaded ? "opacity-100" : "opacity-0"
                }`
          }`}
          priority={priority}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/20 rounded">
          <span className="text-xs text-muted-foreground">Failed to load</span>
        </div>
      )}
    </div>
  );
}

/**
 * Lazy load wrapper for dynamic imports (components)
 */
export function LazyComponent({
  children,
  fallback,
  className,
}: {
  children: ReactNode;
  fallback?: ReactNode;
  className?: string;
}) {
  return (
    <LazyLoad
      className={className}
      skeleton={
        fallback || (
          <div className="w-full h-32 animate-pulse bg-muted/20 rounded-lg" />
        )
      }
    >
      {children}
    </LazyLoad>
  );
}
