/**
 * TASK-024 — Global Search Page (/search)
 *
 * Server-side rendered shell + Client component for interactive search UX.
 */

import { Suspense } from "react";
import { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SearchClient } from "./search-client";

export const metadata: Metadata = {
  title: "Search | Nexus",
  description: "Search cards, boards and lists across your workspace",
};

export default async function SearchPage() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) redirect("/sign-in");

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Search</h1>
      <Suspense fallback={<div className="h-40 rounded-xl bg-muted animate-pulse" />}>
        <SearchClient />
      </Suspense>
    </div>
  );
}
