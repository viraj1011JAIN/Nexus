"use client";

import React, { useEffect } from "react";

/**
 * Production-level performance monitoring
 * Tracks Web Vitals and reports to console (dev) or analytics (prod)
 */

interface WebVitalsMetric {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  delta: number;
  id: string;
}

export function usePerformanceMonitoring(enabled = process.env.NODE_ENV === "development") {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    // Monitor FPS
    let frames = 0;
    let lastTime = performance.now();
    let fps = 60;

    function measureFPS() {
      frames++;
      const currentTime = performance.now();
      
      if (currentTime >= lastTime + 1000) {
        fps = Math.round((frames * 1000) / (currentTime - lastTime));
        frames = 0;
        lastTime = currentTime;

        if (fps < 30) {
          console.warn(`⚠️ Low FPS detected: ${fps}fps`);
        }
      }

      requestAnimationFrame(measureFPS);
    }

    measureFPS();

    // Monitor long tasks
    if ("PerformanceObserver" in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              console.warn(`⚠️ Long task detected: ${entry.duration.toFixed(2)}ms`, entry);
            }
          }
        });

        observer.observe({ entryTypes: ["longtask"] });

        return () => observer.disconnect();
      } catch (e) {
        // Long task API not supported
      }
    }
  }, [enabled]);
}

/**
 * Report Web Vitals
 */
export function reportWebVitals(metric: WebVitalsMetric) {
  const { name, value, rating } = metric;

  // Log to console in development
  if (process.env.NODE_ENV === "development") {
    const emoji = rating === "good" ? "✅" : rating === "needs-improvement" ? "⚠️" : "❌";
    console.log(`${emoji} ${name}: ${value.toFixed(2)}ms (${rating})`);
  }

  // Send to analytics in production
  if (process.env.NODE_ENV === "production") {
    // Example: Send to your analytics service
    // analytics.track('web-vitals', { name, value, rating });
  }
}

/**
 * Performance monitoring component
 * Add to your layout to track performance metrics
 */
export function PerformanceMonitor({ children }: { children: React.ReactNode }) {
  usePerformanceMonitoring();

  useEffect(() => {
    // Track navigation performance
    if (typeof window !== "undefined" && window.performance) {
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;

      if (navigation) {
        console.log("📊 Navigation Performance:");
        console.log(`  DNS: ${(navigation.domainLookupEnd - navigation.domainLookupStart).toFixed(2)}ms`);
        console.log(`  TCP: ${(navigation.connectEnd - navigation.connectStart).toFixed(2)}ms`);
        console.log(`  Request: ${(navigation.responseStart - navigation.requestStart).toFixed(2)}ms`);
        console.log(`  Response: ${(navigation.responseEnd - navigation.responseStart).toFixed(2)}ms`);
        console.log(`  DOM: ${(navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart).toFixed(2)}ms`);
        console.log(`  Load: ${(navigation.loadEventEnd - navigation.loadEventStart).toFixed(2)}ms`);
        console.log(`  Total: ${(navigation.loadEventEnd - navigation.fetchStart).toFixed(2)}ms`);
      }
    }
  }, []);

  return children as React.ReactElement;
}

/**
 * Measure component render time
 */
export function measureRender(componentName: string) {
  if (process.env.NODE_ENV !== "development") return () => {};

  const startTime = performance.now();

  return () => {
    const endTime = performance.now();
    const renderTime = endTime - startTime;

    if (renderTime > 16) {
      console.warn(`⚠️ Slow render: ${componentName} took ${renderTime.toFixed(2)}ms`);
    }
  };
}

/**
 * Hook to measure component render time
 */
export function useRenderTime(componentName: string) {
  useEffect(() => {
    const endMeasure = measureRender(componentName);
    return endMeasure;
  });
}
