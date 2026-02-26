"use client";

import { useEffect, useState } from "react";
import { getBoardAnalytics } from "@/actions/analytics/get-board-analytics";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRealtimeAnalytics } from "@/hooks/use-realtime-analytics";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  CheckCircle2,
  Clock,
  AlertCircle,
  Minus,
  BarChart2,
  LayoutDashboard,
} from "lucide-react";
import { format } from "date-fns";

// Lazy load charts for better initial load performance
const LineChart = dynamic(
  () => import("recharts").then((mod) => mod.LineChart),
  { ssr: false }
);
const BarChart = dynamic(
  () => import("recharts").then((mod) => mod.BarChart),
  { ssr: false }
);
const PieChart = dynamic(
  () => import("recharts").then((mod) => mod.PieChart),
  { ssr: false }
);
const Bar = dynamic(() => import("recharts").then((mod) => mod.Bar), {
  ssr: false,
});
const Line = dynamic(() => import("recharts").then((mod) => mod.Line), {
  ssr: false,
});
const Pie = dynamic(() => import("recharts").then((mod) => mod.Pie), {
  ssr: false,
});
const Cell = dynamic(() => import("recharts").then((mod) => mod.Cell), {
  ssr: false,
});
const XAxis = dynamic(() => import("recharts").then((mod) => mod.XAxis), {
  ssr: false,
});
const YAxis = dynamic(() => import("recharts").then((mod) => mod.YAxis), {
  ssr: false,
});
const CartesianGrid = dynamic(
  () => import("recharts").then((mod) => mod.CartesianGrid),
  { ssr: false }
);
const Tooltip = dynamic(() => import("recharts").then((mod) => mod.Tooltip), {
  ssr: false,
});
const Legend = dynamic(() => import("recharts").then((mod) => mod.Legend), {
  ssr: false,
});
const ResponsiveContainer = dynamic(
  () => import("recharts").then((mod) => mod.ResponsiveContainer),
  { ssr: false }
);

// Lazy load ExportPDF for code splitting
const ExportPDF = dynamic(() =>
  import("./export-pdf").then((mod) => mod.ExportPDF)
);

// Lazy load Advanced Analytics (heavy charting)
const AdvancedAnalytics = dynamic(() =>
  import("./advanced-analytics").then((mod) => mod.AdvancedAnalytics)
);

interface AnalyticsDashboardProps {
  boardId: string;
  boardName: string;
  /** orgId required for tenant-isolated analytics channel */
  orgId: string;
}

const DATE_RANGES = [
  { label: "7d",  days: 7  },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "60d", days: 60 },
  { label: "All", days: 0  },
] as const;

export function AnalyticsDashboard({ boardId, boardName, orgId }: AnalyticsDashboardProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"basic" | "advanced">("basic");
  const [timeRange, setTimeRange] = useState<number>(14);
  const { isConnected } = useRealtimeAnalytics(boardId, orgId);

  const fetchMetrics = async (days = timeRange) => {
    setLoading(true);
    const { data, error } = await getBoardAnalytics(boardId, days);
    if (data) {
      setMetrics(data);
    } else if (error) {
      console.error("Analytics error:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMetrics(timeRange);

    // Listen for real-time updates
    const handleRefresh = () => fetchMetrics(timeRange);
    window.addEventListener("refresh-analytics", handleRefresh);

    return () => {
      window.removeEventListener("refresh-analytics", handleRefresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, timeRange]);

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-80 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No analytics data available</p>
      </div>
    );
  }

  const COLORS = {
    urgent: "#ef4444",
    high: "#f97316",
    medium: "#eab308",
    low: "#22c55e",
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header with Export */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h2>
          <p className="text-muted-foreground mt-1">{boardName}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Date range selector (basic view only) */}
          {view === "basic" && (
            <div
              className="flex items-center rounded-lg border bg-muted/50 p-0.5 gap-0.5"
              role="group"
              aria-label="Date range"
            >
              {DATE_RANGES.map(({ label, days }) => (
                <button
                  key={label}
                  onClick={() => {
                    setTimeRange(days);
                  }}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                    timeRange === days
                      ? "bg-background shadow text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {/* View toggle */}
          <div className="flex items-center rounded-lg border p-0.5 gap-0.5">
            <Button
              variant={view === "basic" ? "default" : "ghost"}
              size="sm"
              className="h-7 gap-1.5 text-xs px-2.5"
              onClick={() => setView("basic")}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Basic
            </Button>
            <Button
              variant={view === "advanced" ? "default" : "ghost"}
              size="sm"
              className="h-7 gap-1.5 text-xs px-2.5"
              onClick={() => setView("advanced")}
            >
              <BarChart2 className="h-3.5 w-3.5" />
              Advanced
            </Button>
          </div>
          {/* Real-time indicator */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div
              className={`h-2 w-2 rounded-full ${
                isConnected ? "bg-green-500 animate-pulse" : "bg-gray-400"
              }`}
            />
            {isConnected ? "Live" : "Offline"}
          </div>
          {view === "basic" && <ExportPDF metrics={metrics} boardName={boardName} />}
        </div>
      </div>

      {/* Advanced Analytics View */}
      {view === "advanced" && (
        <AdvancedAnalytics boardId={boardId} boardName={boardName} />
      )}

      {/* Basic Analytics View */}
      {view !== "advanced" && (
      <>
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cards</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.overview.totalCards}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.overview.inProgressCards} in progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.overview.completedCards}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.overview.completionRate}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Time</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.velocity.avgCompletionTimeHours}h
            </div>
            <p className="text-xs text-muted-foreground">per card</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${metrics.overview.overdueCards > 0 ? 'text-red-500' : ''}`}>
              {metrics.overview.overdueCards}
            </div>
            <p className="text-xs text-muted-foreground">cards past due</p>
          </CardContent>
        </Card>
      </div>

      {/* Velocity Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Velocity Trend ({timeRange === 0 ? "All Time" : `Last ${timeRange} Days`})
            {metrics.velocity.trend === "up" && (
              <TrendingUp className="h-4 w-4 text-green-500" />
            )}
            {metrics.velocity.trend === "down" && (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            {metrics.velocity.trend === "stable" && (
              <Minus className="h-4 w-4 text-yellow-500" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">This Week:</span>
              <span className="ml-2 font-semibold">{metrics.velocity.cardsCreatedThisWeek} created</span>
              <span className="mx-2">·</span>
              <span className="font-semibold text-green-600">{metrics.velocity.cardsCompletedThisWeek} completed</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics.timeline}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(value) => format(new Date(value), "MMM d")}
                className="text-xs"
              />
              <YAxis className="text-xs" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                labelFormatter={(value) => format(new Date(value), "MMM d, yyyy")}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="created"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Created"
                dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="completed"
                stroke="#22c55e"
                strokeWidth={2}
                name="Completed"
                dot={{ fill: "#22c55e", strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Priority Distribution & Member Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Priority Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: "Urgent", value: metrics.priorityDistribution.urgent },
                    { name: "High", value: metrics.priorityDistribution.high },
                    { name: "Medium", value: metrics.priorityDistribution.medium },
                    { name: "Low", value: metrics.priorityDistribution.low },
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    (percent ?? 0) > 0 ? `${name} ${((percent ?? 0) * 100).toFixed(0)}%` : ""
                  }
                  outerRadius={90}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {Object.entries(COLORS).map(([_key, color], index) => (
                    <Cell key={`cell-${index}`} fill={color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Contributors</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.memberActivity.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.memberActivity.slice(0, 5)}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="userName" 
                    className="text-xs"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="cardsCompleted" fill="#22c55e" name="Completed" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cardsCreated" fill="#3b82f6" name="Created" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-75">
                <p className="text-sm text-muted-foreground">No assigned members yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </>
      )}
    </div>
  );
}
