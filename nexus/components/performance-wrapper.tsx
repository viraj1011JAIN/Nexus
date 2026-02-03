"use client";

import { useEffect } from "react";
import { useReportWebVitals } from "next/web-vitals";

/**
 * Performance monitoring wrapper
 * Reports Web Vitals and monitors performance
 */
export function PerformanceWrapper({ children }: { children: React.ReactNode }) {
  // Report Web Vitals
  useReportWebVitals((metric) => {
    const { name, value, rating, id } = metric;

    // Only log in development
    if (process.env.NODE_ENV === "development") {
      const emoji = rating === "good" ? "✅" : rating === "needs-improvement" ? "⚠️" : "❌";
      console.log(`${emoji} ${name}: ${value.toFixed(2)} (${rating})`);
    }

    // Send to analytics in production
    if (process.env.NODE_ENV === "production") {
      // Example: Send to your analytics service
      // window.gtag?.("event", name, {
      //   value: Math.round(value),
      //   metric_id: id,
      //   metric_value: value,
      //   metric_rating: rating,
      // });
    }
  });

  // Monitor FPS in development
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    let frames = 0;
    let lastTime = performance.now();
    let lowFpsCount = 0;

    function measureFPS() {
      frames++;
      const currentTime = performance.now();

      if (currentTime >= lastTime + 1000) {
        const fps = Math.round((frames * 1000) / (currentTime - lastTime));
        frames = 0;
        lastTime = currentTime;

        if (fps < 30) {
          lowFpsCount++;
          if (lowFpsCount > 3) {
            console.warn(`⚠️ Consistent low FPS: ${fps}fps`);
          }
        } else {
          lowFpsCount = 0;
        }
      }

      requestAnimationFrame(measureFPS);
    }

    const rafId = requestAnimationFrame(measureFPS);

    return () => cancelAnimationFrame(rafId);
  }, []);

  // Log navigation timing
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const logNavTiming = () => {
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;

      if (navigation) {
        console.log("🚀 Navigation Performance:");
        console.log(`  DNS: ${(navigation.domainLookupEnd - navigation.domainLookupStart).toFixed(0)}ms`);
        console.log(`  TCP: ${(navigation.connectEnd - navigation.connectStart).toFixed(0)}ms`);
        console.log(`  Request: ${(navigation.responseStart - navigation.requestStart).toFixed(0)}ms`);
        console.log(`  Response: ${(navigation.responseEnd - navigation.responseStart).toFixed(0)}ms`);
        console.log(`  DOM Load: ${(navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart).toFixed(0)}ms`);
        console.log(`  ⚡ Total: ${(navigation.loadEventEnd - navigation.fetchStart).toFixed(0)}ms`);
      }
    };

    if (document.readyState === "complete") {
      logNavTiming();
    } else {
      window.addEventListener("load", logNavTiming);
      return () => window.removeEventListener("load", logNavTiming);
    }
  }, []);

  return <>{children}</>;
}
