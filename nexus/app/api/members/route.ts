import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

/**
 * GET /api/members?query=john
 * Returns org members matching the query — used by @mention suggestion.
 */
export async function GET(req: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query")?.trim().toLowerCase() ?? "";

  const members = await db.organizationUser.findMany({
    where: {
      organizationId: orgId,
      isActive: true,
      ...(query
        ? {
            user: {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { email: { contains: query, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true, imageUrl: true, clerkUserId: true } },
    },
    take: 10,
    orderBy: { user: { name: "asc" } },
  });

  const results = members.map((m) => ({
    id: m.user.clerkUserId,
    dbId: m.user.id,
    name: m.user.name,
    email: m.user.email,
    imageUrl: m.user.imageUrl,
  }));

  return NextResponse.json(results);
}
