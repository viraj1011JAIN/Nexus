import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://nexus.app";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/privacy", "/terms"],
        disallow: [
          "/dashboard",
          "/board/",
          "/roadmap",
          "/search",
          "/settings/",
          "/billing/",
          "/onboarding/",
          "/select-org",
          "/api/",
          "/_next/",
        ],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
    host: appUrl,
  };
}
