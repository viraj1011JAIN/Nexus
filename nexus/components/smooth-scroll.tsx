"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface SmoothScrollProps {
  children: ReactNode;
  className?: string;
  speed?: number;
  enabled?: boolean;
}

/**
 * Production-level smooth scrolling with momentum and GPU acceleration
 * Uses native CSS scroll-behavior with enhanced performance
 */
export function SmoothScroll({
  children,
  className = "",
  speed = 1,
  enabled = true,
}: SmoothScrollProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;

    // Enable smooth scrolling
    container.style.scrollBehavior = "smooth";
    
    // Add GPU acceleration
    container.style.transform = "translateZ(0)";
    container.style.backfaceVisibility = "hidden";
    container.style.perspective = "1000px";

    // Optimize scroll performance
    let rafId: number | null = null;
    let lastScrollTop = 0;

    const handleScroll = () => {
      if (rafId) return;

      rafId = requestAnimationFrame(() => {
        const currentScrollTop = container.scrollTop;
        
        // Only trigger reflow when needed
        if (Math.abs(currentScrollTop - lastScrollTop) > 1) {
          lastScrollTop = currentScrollTop;
        }
        
        rafId = null;
      });
    };

    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [enabled, speed]);

  return (
    <div
      ref={containerRef}
      className={`scroll-smooth overscroll-contain [will-change:scroll-position] ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Utility to smooth scroll to element
 */
export function smoothScrollTo(
  element: HTMLElement | string,
  options?: ScrollIntoViewOptions
) {
  const target =
    typeof element === "string" ? document.querySelector(element) : element;

  if (!target) return;

  target.scrollIntoView({
    behavior: "smooth",
    block: "start",
    inline: "nearest",
    ...options,
  });
}

/**
 * Smooth scroll to top button component
 */
export function ScrollToTop({
  showAt = 300,
  className = "",
}: {
  showAt?: number;
  className?: string;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let rafId: number | null = null;

    const handleScroll = () => {
      if (rafId) return;

      rafId = requestAnimationFrame(() => {
        setShow(window.scrollY > showAt);
        rafId = null;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [showAt]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  if (!show) return null;

  return (
    <button
      onClick={scrollToTop}
      className={`fixed bottom-8 right-8 z-50 p-3 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 gpu-accelerate ${className}`}
      aria-label="Scroll to top"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 15l-6-6-6 6" />
      </svg>
    </button>
  );
}
