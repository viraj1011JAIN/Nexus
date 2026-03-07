/**
 * Board page loading skeleton — shown instantly via React Suspense streaming
 * while the server fetches board data (lists, cards, etc.) from the database.
 * Matches the visual structure of the board page to prevent layout shift.
 */
export default function BoardLoading() {
  return (
    <div className="h-dvh relative flex flex-col overflow-hidden dark:bg-[#0D0C14] bg-[#F4F1ED]">
      {/* Background blobs (match board page) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-30 left-[10%] w-150 h-150 rounded-full bg-[radial-gradient(circle,rgba(123,47,247,0.07)_0%,transparent_70%)] blur-2xl" />
        <div className="absolute -bottom-25 right-[5%] w-125 h-125 rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.05)_0%,transparent_70%)] blur-2xl" />
      </div>

      {/* Board header skeleton */}
      <div className="relative z-30 h-14 shrink-0 flex items-center gap-3 px-4 border-b border-black/6 dark:border-white/6 bg-black/5 dark:bg-black/20 backdrop-blur-sm">
        <div className="h-5.5 w-40 bg-black/8 dark:bg-white/10 rounded-lg animate-pulse" />
        <div className="flex-1" />
        <div className="flex gap-2">
          <div className="h-8 w-20 rounded-lg bg-black/8 dark:bg-white/10 animate-pulse" />
          <div className="h-8 w-8 rounded-lg bg-black/8 dark:bg-white/10 animate-pulse" />
          <div className="h-8 w-8 rounded-lg bg-black/8 dark:bg-white/10 animate-pulse" />
          <div className="h-8 w-8 rounded-lg bg-black/8 dark:bg-white/10 animate-pulse" />
        </div>
      </div>

      {/* Tabs + kanban area */}
      <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
        {/* Tab bar skeleton — reuses same dimensions as board-tabs-client.tsx BoardLoadingSkeleton */}
        <div className="h-11 shrink-0 flex items-center gap-1.5 px-4 border-b border-black/6 dark:border-white/6">
          {["w-13", "w-11", "w-16", "w-16", "w-13", "w-16", "w-20"].map((w, i) => (
            <div key={i} className={`${w} h-6.5 rounded-full bg-black/5 dark:bg-white/6 animate-pulse`} />
          ))}
        </div>

        {/* Kanban column skeletons */}
        <div className="flex-1 flex gap-3 p-4 overflow-hidden">
          {/* Column 1 */}
          <div className="shrink-0 w-68 flex flex-col gap-2">
            <div className="h-9 rounded-[10px] bg-black/5 dark:bg-white/6 animate-pulse" />
            <div className="h-20 rounded-2xl bg-black/4 dark:bg-white/5 animate-pulse" />
            <div className="h-14 rounded-2xl bg-black/4 dark:bg-white/5 animate-pulse" />
            <div className="h-16 rounded-2xl bg-black/4 dark:bg-white/5 animate-pulse" />
            <div className="h-12 rounded-2xl bg-black/4 dark:bg-white/5 animate-pulse" />
          </div>
          {/* Column 2 */}
          <div className="shrink-0 w-68 flex flex-col gap-2">
            <div className="h-9 rounded-[10px] bg-black/5 dark:bg-white/6 animate-pulse" />
            <div className="h-14 rounded-2xl bg-black/4 dark:bg-white/5 animate-pulse" />
            <div className="h-20 rounded-2xl bg-black/4 dark:bg-white/5 animate-pulse" />
            <div className="h-14 rounded-2xl bg-black/4 dark:bg-white/5 animate-pulse" />
            <div className="h-16 rounded-2xl bg-black/4 dark:bg-white/5 animate-pulse" />
          </div>
          {/* Column 3 */}
          <div className="shrink-0 w-68 flex flex-col gap-2">
            <div className="h-9 rounded-[10px] bg-black/5 dark:bg-white/6 animate-pulse" />
            <div className="h-16 rounded-2xl bg-black/4 dark:bg-white/5 animate-pulse" />
            <div className="h-12 rounded-2xl bg-black/4 dark:bg-white/5 animate-pulse" />
            <div className="h-20 rounded-2xl bg-black/4 dark:bg-white/5 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
