import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createApi } from "unsplash-js";

// Unsplash API client (server-side only — access key never exposed to client)
function getUnsplashClient() {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    throw new Error("UNSPLASH_ACCESS_KEY environment variable is not set");
  }
  // `fetch` is available globally in Node 18+ / Next.js edge runtime
  return createApi({ accessKey, fetch: globalThis.fetch });
}

/** Escape HTML entities to prevent XSS in generated attribution HTML. */
function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Allow only https:// URLs to prevent protocol-injection in href attributes. */
function escUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? url : "https://unsplash.com";
  } catch {
    return "https://unsplash.com";
  }
}

/**
 * GET /api/unsplash?query=mountains&page=1
 * Returns paginated Unsplash photos for board background selection.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query")?.trim() || "nature landscape";
  const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(rawPage) ? Math.max(1, rawPage) : 1;
  const perPage = 12;

  try {
    const unsplash = getUnsplashClient();
    const result = await unsplash.search.getPhotos({
      query,
      page,
      perPage,
      orientation: "landscape",
    });

    if (result.errors) {
      return NextResponse.json({ error: result.errors[0] }, { status: 500 });
    }

    const photos = result.response.results.map((photo) => ({
      id: photo.id,
      thumbUrl: photo.urls.small,
      fullUrl: photo.urls.full,
      regularUrl: photo.urls.regular,
      userName: photo.user.name,
      userLink: photo.user.links.html,
      // Attribution HTML required by Unsplash guidelines (HTML-escaped to prevent XSS)
      linkHtml: `Photo by <a href="${escUrl(photo.user.links.html)}?utm_source=nexus&utm_medium=referral" target="_blank" rel="noopener">${escHtml(photo.user.name)}</a> on <a href="https://unsplash.com?utm_source=nexus&utm_medium=referral" target="_blank" rel="noopener">Unsplash</a>`,
    }));

    return NextResponse.json({
      photos,
      total: result.response.total,
      totalPages: result.response.total_pages,
      page,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unsplash API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
