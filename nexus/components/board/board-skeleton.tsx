"use client";

export function BoardCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden h-80">
      <div className="h-32 bg-linear-to-br from-gray-200 to-gray-300 animate-pulse" />
      <div className="p-6 space-y-4">
        <div className="h-6 bg-gray-200 rounded animate-pulse w-3/4" />
        <div className="flex items-center gap-4">
          <div className="h-4 bg-gray-200 rounded animate-pulse w-20" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-32" />
        </div>
        <div className="flex gap-2 mt-4">
          <div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse" />
          <div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse" />
          <div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export function BoardListSkeleton() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        {/* Hero Skeleton */}
        <div className="mb-12 space-y-3">
          <div className="h-14 bg-linear-to-r from-gray-200 to-gray-300 rounded-lg w-96 animate-pulse" />
          <div className="h-5 bg-gray-200 rounded w-32 animate-pulse" />
        </div>

        {/* Create Form Skeleton */}
        <div className="mb-12 flex gap-4 max-w-2xl">
          <div className="flex-1 h-16 bg-gray-200 rounded-xl animate-pulse" />
          <div className="h-16 w-40 bg-linear-to-r from-gray-200 to-gray-300 rounded-lg animate-pulse" />
        </div>

        {/* Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <BoardCardSkeleton />
          <BoardCardSkeleton />
          <BoardCardSkeleton />
        </div>
      </div>
    </div>
  );
}
