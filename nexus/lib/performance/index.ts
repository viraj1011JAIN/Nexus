/**
 * NEXUS Performance Utilities
 * 
 * Production-level performance optimization tools
 */

// Lazy Loading Components
export { LazyLoad, LazyImage, LazyComponent } from "@/components/lazy-load";

// Virtual Scrolling
export { VirtualScroll, DynamicVirtualScroll } from "@/components/virtual-scroll";

// Smooth Scrolling
export { SmoothScroll, smoothScrollTo, ScrollToTop } from "@/components/smooth-scroll";

// Performance Monitoring
export {
  usePerformanceMonitoring,
  reportWebVitals,
  PerformanceMonitor,
  measureRender,
  useRenderTime,
} from "@/lib/performance";
