import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const isDev = process.env.NODE_ENV === "development";

// Bundle analyzer: run `ANALYZE=true npm run build` to inspect output
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false, // write HTML report, don't auto-open browser
});

const nextConfig: NextConfig = {
  // Performance optimizations
  reactStrictMode: true, // enable double-render checks in dev (intentional)
  poweredByHeader: false,
  compress: true,
  
  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  
  // Production-level image optimization with lazy loading
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
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
  
  // Experimental performance features (Next.js 13.5+)
  experimental: {
    // Tree-shake large icon/animation/editor packages — real npm packages only
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      '@tiptap/react',
      '@tiptap/starter-kit',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      'date-fns',
    ],
  },

  // Keep Prisma and native deps on the server side — prevents bundling issues
  serverExternalPackages: ['@prisma/client', 'prisma'],

  // Disable browser source maps in production (reduces bundle exposure)
  productionBrowserSourceMaps: false,
  
};

export default withBundleAnalyzer(nextConfig);
