"use client";

/**
 * Production-level resource prefetching and preloading utilities
 * Intelligently preload resources for instant navigation
 */

/**
 * Prefetch a page/route in the background
 */
export function prefetchRoute(href: string) {
  if (typeof window === "undefined") return;

  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = href;
  link.as = "document";
  document.head.appendChild(link);
}

/**
 * Preload an image
 */
export function preloadImage(src: string, priority: "high" | "low" = "low") {
  if (typeof window === "undefined") return;

  const link = document.createElement("link");
  link.rel = "preload";
  link.href = src;
  link.as = "image";
  link.fetchPriority = priority;
  document.head.appendChild(link);
}

/**
 * Preconnect to a domain
 */
export function preconnect(url: string, crossorigin = false) {
  if (typeof window === "undefined") return;

  const link = document.createElement("link");
  link.rel = "preconnect";
  link.href = url;
  if (crossorigin) link.crossOrigin = "anonymous";
  document.head.appendChild(link);
}

/**
 * DNS prefetch
 */
export function dnsPrefetch(url: string) {
  if (typeof window === "undefined") return;

  const link = document.createElement("link");
  link.rel = "dns-prefetch";
  link.href = url;
  document.head.appendChild(link);
}

/**
 * Prefetch on hover (intelligent prefetching)
 */
export function usePrefetchOnHover() {
  if (typeof window === "undefined") return;

  const handleMouseEnter = (e: MouseEvent) => {
    const target = e.target as HTMLAnchorElement;
    if (target.tagName === "A" && target.href) {
      prefetchRoute(target.href);
    }
  };

  document.addEventListener("mouseenter", handleMouseEnter, { capture: true, passive: true });

  return () => {
    document.removeEventListener("mouseenter", handleMouseEnter, { capture: true });
  };
}

/**
 * Prefetch visible links using Intersection Observer
 */
export function prefetchVisibleLinks() {
  if (typeof window === "undefined" || !("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const link = entry.target as HTMLAnchorElement;
          if (link.href) {
            prefetchRoute(link.href);
            observer.unobserve(link);
          }
        }
      });
    },
    {
      rootMargin: "50px",
    }
  );

  // Observe all links
  const links = document.querySelectorAll<HTMLAnchorElement>('a[href^="/"]');
  links.forEach((link) => observer.observe(link));

  return () => observer.disconnect();
}

/**
 * Preload critical resources
 */
export function preloadCriticalResources(resources: {
  images?: string[];
  fonts?: string[];
  scripts?: string[];
  styles?: string[];
}) {
  if (typeof window === "undefined") return;

  // Preload images
  resources.images?.forEach((src) => {
    preloadImage(src, "high");
  });

  // Preload fonts
  resources.fonts?.forEach((src) => {
    const link = document.createElement("link");
    link.rel = "preload";
    link.href = src;
    link.as = "font";
    link.type = "font/woff2";
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  });

  // Preload scripts
  resources.scripts?.forEach((src) => {
    const link = document.createElement("link");
    link.rel = "preload";
    link.href = src;
    link.as = "script";
    document.head.appendChild(link);
  });

  // Preload styles
  resources.styles?.forEach((src) => {
    const link = document.createElement("link");
    link.rel = "preload";
    link.href = src;
    link.as = "style";
    document.head.appendChild(link);
  });
}

/**
 * Hook to prefetch routes on mount
 */
export function usePrefetch(routes: string[]) {
  if (typeof window === "undefined") return;

  // Prefetch after initial load
  if (document.readyState === "complete") {
    routes.forEach(prefetchRoute);
  } else {
    window.addEventListener("load", () => {
      routes.forEach(prefetchRoute);
    });
  }
}
