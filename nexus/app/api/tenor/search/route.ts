import { NextRequest, NextResponse } from "next/server";

// Multi-provider GIF API support
// Supports: Giphy (recommended), Klipy
const GIPHY_API_KEY = process.env.GIPHY_API_KEY || "";
const KLIPY_API_KEY = process.env.KLIPY_API_KEY || "";

interface GifResult {
  id: string;
  media_formats: {
    tinygif: { url: string };
    gif: { url: string };
  };
  content_description: string;
}

function normalizeGiphyResult(item: any): GifResult {
  return {
    id: item.id,
    media_formats: {
      tinygif: { url: item.images.fixed_height_small.url },
      gif: { url: item.images.original.url },
    },
    content_description: item.title || "GIF",
  };
}

function normalizeKlipyResult(item: any): GifResult {
  return {
    id: item.id,
    media_formats: {
      tinygif: { url: item.media[1]?.tinygif?.url || item.media[0]?.gif?.url },
      gif: { url: item.media[0]?.gif?.url },
    },
    content_description: item.title || "GIF",
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q") || "";
  const limit = searchParams.get("limit") || "20";

  // If no search query, return empty results
  if (!query.trim()) {
    return NextResponse.json({ results: [] });
  }

  try {
    // Try Giphy first (easiest setup, best API)
    if (GIPHY_API_KEY && GIPHY_API_KEY.length > 0) {
      console.log(`[GIF API] Searching Giphy for: "${query}"`);
      const url = new URL("https://api.giphy.com/v1/gifs/search");
      url.searchParams.set("api_key", GIPHY_API_KEY);
      url.searchParams.set("q", query);
      url.searchParams.set("limit", limit);
      url.searchParams.set("rating", "g"); // Family-friendly

      const response = await fetch(url.toString(), {
        next: { revalidate: 3600 },
      });

      if (response.ok) {
        const data = await response.json();
        if (!data.data || !Array.isArray(data.data)) {
          console.error('[GIF API] Invalid Giphy response format:', data);
          return NextResponse.json({ results: [] });
        }
        const results = data.data.map(normalizeGiphyResult);
        console.log(`[GIF API] Found ${results.length} GIFs from Giphy`);
        return NextResponse.json({ results });
      } else {
        console.error(`[GIF API] Giphy search error: ${response.status} ${response.statusText}`);
      }
    }

    // Try Klipy
    if (KLIPY_API_KEY) {
      const url = new URL("https://api.klipy.com/v1/gifs/search");
      url.searchParams.set("key", KLIPY_API_KEY);
      url.searchParams.set("q", query);
      url.searchParams.set("limit", limit);

      const response = await fetch(url.toString(), {
        next: { revalidate: 3600 },
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({
          results: data.results.map(normalizeKlipyResult),
        });
      }
    }

    // No API keys configured
    console.warn("No GIF API key configured. Set GIPHY_API_KEY (recommended) or KLIPY_API_KEY.");
    return NextResponse.json({ results: [] });
  } catch (error) {
    console.error("[GIF API] Fatal search error:", error);
    if (error instanceof Error) {
      console.error("[GIF API] Error details:", error.message, error.stack);
    }
    return NextResponse.json({ results: [], error: "Failed to search GIFs" });
  }
}
