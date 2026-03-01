import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

// Bundle analyzer: run `ANALYZE=true npm run build` to inspect output
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false, // write HTML report, don't auto-open browser
});

const nextConfig: NextConfig = {
  // Performance optimizations
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  // Skip internal Next.js URL normalization that runs on every proxy
  // invocation — saves ~0.5 ms per request in local dev.
  skipProxyUrlNormalize: true,
  skipTrailingSlashRedirect: true,

  // Allow cross-origin requests from ngrok tunnels (dev only)
  allowedDevOrigins: [
    "*.ngrok-free.app",
    "*.ngrok.io",
    "*.ngrok.app",
  ],
  
  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },

  // HTTP caching + security headers
  // Security headers are also set in middleware.ts for all dynamic routes.
  // Duplicating the minimal set here ensures static assets not processed by
  // middleware still receive them.
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-DNS-Prefetch-Control", value: "on" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];

    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // In production, JS chunk filenames include a content hash so 1-year
        // immutable caching is safe. In development (Turbopack), chunk filenames
        // like _920085a8._.js can keep the SAME NAME after source edits, meaning
        // the browser would serve a year-old stale bundle → hydration mismatch.
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: process.env.NODE_ENV === "production"
              ? "public, max-age=31536000, immutable"
              : "no-store",
          },
        ],
      },
      {
        // Cache public images / fonts for 1 day
        source: "/(.*)\\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|otf|eot)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
      {
        // API routes must never be stored by shared caches — individual route
        // handlers set their own cache policy when appropriate.
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
        ],
      },
    ];
  },
  
  // Production-level image optimization with lazy loading
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 3600,
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'plus.unsplash.com',
      },
      // Clerk user profile photos
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
      {
        protocol: 'https',
        hostname: '*.clerk.com',
      },
      // Google OAuth avatars (e.g. lh3.googleusercontent.com)
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
      // GitHub OAuth avatars
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
  
  // Experimental performance features
  experimental: {
    // Server-side compile performance (build + dev)
    parallelServerCompiles: true,
    parallelServerBuildTraces: true,

    // Tree-shake large icon/animation/editor packages — real npm packages only
    optimizePackageImports: [
      // Icons & animation — large barrel exports
      'lucide-react',
      'framer-motion',
      // Tiptap editor packages
      '@tiptap/react',
      '@tiptap/starter-kit',
      '@tiptap/extension-character-count',
      '@tiptap/extension-code-block-lowlight',
      '@tiptap/extension-highlight',
      '@tiptap/extension-image',
      '@tiptap/extension-link',
      '@tiptap/extension-mention',
      '@tiptap/extension-placeholder',
      '@tiptap/extension-task-item',
      '@tiptap/extension-task-list',
      '@tiptap/extension-text-align',
      '@tiptap/extension-underline',
      // Radix UI — each package is a barrel
      '@radix-ui/react-avatar',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-label',
      '@radix-ui/react-popover',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-separator',
      '@radix-ui/react-slot',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-visually-hidden',
      // DnD Kit
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/utilities',
      // Charts & data vis
      'recharts',
      // Other large barrel-export packages
      'date-fns',
      'emoji-picker-react',
      'cmdk',
    ],
  },

  // React Compiler — auto-memoizes every component, hook, and function.
  // Eliminates the need for manual React.memo / useMemo / useCallback across
  // the entire codebase. Requires `react-compiler-runtime` (installed).
  reactCompiler: true,

  // Keep Prisma, OpenAI, and native binaries on the server side —
  // prevents Turbopack from inlining Node.js-only code into client bundles.
  // `sharp` is the high-performance image processing library used by
  // Next.js <Image> — marking it external skips bundling its native bindings.
  serverExternalPackages: ['@prisma/client', 'prisma', 'openai', 'sharp'],

  // Disable browser source maps in production (reduces bundle exposure)
  productionBrowserSourceMaps: false,
  
};

export default withBundleAnalyzer(nextConfig);
