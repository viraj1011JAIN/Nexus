/**
 * Dashboard loading skeleton — shown instantly via React Suspense streaming
 * while the server fetches boards from the database.
 * Matches the visual structure of BoardList to prevent layout shift.
 */
export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6 sm:p-8 lg:p-10">

        {/* Page header */}
        <div className="mb-6">
          <div className="h-8 w-36 bg-muted rounded-lg animate-pulse" />
          <div className="h-4 w-56 bg-muted/60 rounded mt-2 animate-pulse" />
        </div>

        {/* Stats bar — 4 tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3"
            >
              <div className="w-11 h-11 rounded-xl bg-muted animate-pulse shrink-0" />
              <div className="h-3 w-20 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Create board form */}
        <div className="flex gap-2 max-w-2xl mb-8">
          <div className="flex-1 h-10.5 bg-card border border-border rounded-xl animate-pulse" />
          <div className="h-10.5 w-28 bg-muted rounded-xl animate-pulse" />
          <div className="h-10.5 w-10.5 bg-card border border-border rounded-xl animate-pulse" />
        </div>

        {/* Boards grid — 6 card skeletons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-3xl overflow-hidden"
            >
              {/* Cover image area */}
              <div className="h-36 bg-muted animate-pulse" />
              {/* Card body */}
              <div className="p-4">
                <div className="h-3.5 w-3/4 bg-muted rounded animate-pulse mb-2" />
                <div className="h-3 w-1/2 bg-muted/60 rounded animate-pulse mb-3" />
                {/* Progress bar */}
                <div className="h-1.5 w-full bg-muted/40 rounded-full animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
