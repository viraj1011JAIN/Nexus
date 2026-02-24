"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { getAdvancedBoardAnalytics, type AdvancedBoardAnalytics } from "@/actions/analytics/get-advanced-analytics";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  TrendingUp, TrendingDown, Minus, BarChart2, Clock, Users,
  Tag, Calendar, Activity, AlertTriangle, CheckCircle2, RefreshCw,
  Layers, Target, Zap, Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

// ─── Lazy-load recharts ───────────────────────────────────────────────────────
const AreaChart = dynamic(() => import("recharts").then((m) => m.AreaChart), { ssr: false });
const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false });
const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), { ssr: false });
const Area = dynamic(() => import("recharts").then((m) => m.Area), { ssr: false });
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const RechartsTooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });
const RadarChart = dynamic(() => import("recharts").then((m) => m.RadarChart), { ssr: false });
const PolarGrid = dynamic(() => import("recharts").then((m) => m.PolarGrid), { ssr: false });
const PolarAngleAxis = dynamic(() => import("recharts").then((m) => m.PolarAngleAxis), { ssr: false });
const Radar = dynamic(() => import("recharts").then((m) => m.Radar), { ssr: false });
const Cell = dynamic(() => import("recharts").then((m) => m.Cell), { ssr: false });
const PieChart = dynamic(() => import("recharts").then((m) => m.PieChart), { ssr: false });
const Pie = dynamic(() => import("recharts").then((m) => m.Pie), { ssr: false });

// ─── Constants ────────────────────────────────────────────────────────────────

const CHART_STYLE = {
  backgroundColor: "transparent",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
};

const LIST_COLORS = [
  "#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#3b82f6",
  "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16", "#f97316",
];

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportCSV(data: AdvancedBoardAnalytics, boardName: string) {
  const r: string[] = [];
  const row = (...cells: (string | number)[]) =>
    r.push(cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","));

  // Header
  row(`Analytics Export: ${boardName}`);
  row(`Generated: ${new Date().toLocaleString()}`);
  r.push("");

  // Scores
  row("HEALTH SCORES");
  row("Metric", "Score");
  row("Health Score", data.scores.healthScore);
  row("Velocity Score", data.scores.velocityScore);
  row("Coverage Score", data.scores.coverageScore);
  row("On-time Score", data.scores.overdueScore);
  r.push("");

  // Cycle time
  row("CYCLE TIME");
  row("Metric", "Value");
  row("Average (hours)", data.cycleTime.avg);
  row("Median P50 (hours)", data.cycleTime.p50);
  row("P75 (hours)", data.cycleTime.p75);
  row("P90 (hours)", data.cycleTime.p90);
  row("Sample Count", data.cycleTime.sampleCount);
  r.push("");

  // Throughput
  row("WEEKLY THROUGHPUT");
  row("Week", "Created", "Completed");
  for (const w of data.throughput) row(w.week, w.created, w.completed);
  r.push("");

  // Lead time trend
  row("LEAD TIME TREND (WEEKLY)");
  row("Week", "Avg Hours", "Median Hours", "Sample Count");
  for (const w of data.leadTimeTrend) row(w.week, w.avgHours, w.p50, w.count);
  r.push("");

  // Member stats
  row("MEMBER ACTIVITY");
  row("Member", "Total Cards", "Completed", "Overdue", "Avg Lead Time (h)");
  for (const m of data.memberStats)
    row(m.name, m.totalCards, m.completedCards, m.overdueCards, m.avgLeadTimeHours);
  r.push("");

  // List stats
  row("LIST BOTTLENECK ANALYSIS");
  row("List", "Card Count", "Overdue", "Avg Age (days)", "Done List");
  for (const ls of data.listStats)
    row(ls.listTitle, ls.cardCount, ls.overdueCount, ls.avgAgeDays, ls.completedList ? "Yes" : "No");
  r.push("");

  // Burndown
  row("BURNDOWN DATA (LAST 30 DAYS)");
  row("Date", "Remaining", "Ideal");
  for (const b of data.burndown) row(b.date, b.remaining, b.ideal);

  const csv = r.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${boardName.replace(/\s+/g, "-")}-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ScoreRing({
  score, label, color,
}: { score: number; label: string; color: string }) {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const dash = (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-20 w-20">
        <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={radius} fill="none" strokeWidth="7"
            className="stroke-muted" />
          <circle cx="40" cy="40" r={radius} fill="none" strokeWidth="7"
            stroke={color}
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.8s ease" }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
          {score}
        </span>
      </div>
      <span className="text-xs text-muted-foreground text-center leading-tight">{label}</span>
    </div>
  );
}

function StatCard({
  title, value, sub, icon: Icon, trend, color = "text-foreground",
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "stable";
  color?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold", color)}>{value}</div>
        {sub && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            {trend === "up" && <TrendingUp className="h-3 w-3 text-green-500" />}
            {trend === "down" && <TrendingDown className="h-3 w-3 text-red-500" />}
            {trend === "stable" && <Minus className="h-3 w-3 text-yellow-500" />}
            {sub}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ChartSkeleton({ height = 300 }: { height?: number }) {
  return <Skeleton className="w-full rounded-lg" style={{ height }} />;
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab({ d }: { d: AdvancedBoardAnalytics }) {
  const radarData = [
    { subject: "Health", value: d.scores.healthScore },
    { subject: "Velocity", value: d.scores.velocityScore },
    { subject: "Coverage", value: d.scores.coverageScore },
    { subject: "On-time", value: d.scores.overdueScore },
  ];

  return (
    <div className="space-y-6">
      {/* Score rings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-indigo-500" />
            Board Health Scores
          </CardTitle>
          <CardDescription>Composite scores derived from live board data (0–100)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-8 justify-around">
            <ScoreRing score={d.scores.healthScore} label="Overall Health" color="#6366f1" />
            <ScoreRing score={d.scores.velocityScore} label="Velocity" color="#22c55e" />
            <ScoreRing score={d.scores.coverageScore} label="Coverage" color="#3b82f6" />
            <ScoreRing score={d.scores.overdueScore} label="On-time Delivery" color="#f59e0b" />
          </div>
        </CardContent>
      </Card>

      {/* Radar + coverage */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Score Radar</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                <Radar
                  name="Board"
                  dataKey="value"
                  stroke="#6366f1"
                  fill="#6366f1"
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
                <RechartsTooltip contentStyle={CHART_STYLE} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Card Coverage</CardTitle>
            <CardDescription>Open cards with assignee / due date</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {[
              { label: "Has Assignee", pct: d.coverage.assigneePercent, color: "bg-indigo-500" },
              { label: "Has Due Date", pct: d.coverage.dueDatePercent, color: "bg-blue-500" },
              { label: "Fully Covered", pct: d.coverage.withBothPercent, color: "bg-emerald-500" },
            ].map(({ label, pct, color }) => (
              <div key={label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold">{pct}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-700", color)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground pt-2">
              {d.coverage.total} open cards total ·{" "}
              {d.coverage.withAssignee} assigned ·{" "}
              {d.coverage.withDueDate} with due date
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Labels */}
      {d.topLabels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Tag className="h-4 w-4 text-indigo-500" />
              Top Labels by Card Count
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {d.topLabels.map((l) => (
                <div
                  key={l.name}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ backgroundColor: l.color + "22", color: l.color, border: `1px solid ${l.color}55` }}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: l.color }}
                  />
                  {l.name}
                  <Badge
                    variant="secondary"
                    className="ml-1 h-4 text-[10px] px-1"
                  >
                    {l.count}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Burndown & Throughput ───────────────────────────────────────────────

function BurndownTab({ d }: { d: AdvancedBoardAnalytics }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-indigo-500" />
            Burndown Chart (30 Days)
          </CardTitle>
          <CardDescription>
            Remaining open cards vs ideal linear reduction
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={d.burndown}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => format(parseISO(v), "MMM d")}
                tick={{ fontSize: 11 }}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <RechartsTooltip
                contentStyle={CHART_STYLE}
                labelFormatter={(v) => format(parseISO(v as string), "MMM d, yyyy")}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="remaining"
                name="Remaining"
                stroke="#6366f1"
                fill="#6366f133"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="ideal"
                name="Ideal"
                stroke="#22c55e"
                fill="none"
                strokeWidth={2}
                strokeDasharray="5 5"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Weekly Throughput (Last 8 Weeks)
          </CardTitle>
          <CardDescription>Cards created vs completed per week</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={d.throughput}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <RechartsTooltip contentStyle={CHART_STYLE} />
              <Legend />
              <Bar dataKey="created" name="Created" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completed" name="Completed" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab: Cycle Time ─────────────────────────────────────────────────────────

function CycleTimeTab({ d }: { d: AdvancedBoardAnalytics }) {
  const { cycleTime } = d;
  const hasData = cycleTime.sampleCount > 0;

  return (
    <div className="space-y-6">
      {/* Percentiles */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Avg Cycle Time" value={`${cycleTime.avg}h`} icon={Clock}
          sub={`${cycleTime.sampleCount} completed cards`} />
        <StatCard title="Median (P50)" value={`${cycleTime.p50}h`} icon={Activity} />
        <StatCard title="P75" value={`${cycleTime.p75}h`} icon={Activity}
          sub="75% complete within" />
        <StatCard title="P90" value={`${cycleTime.p90}h`} icon={AlertTriangle}
          sub="90% complete within" color={cycleTime.p90 > 168 ? "text-red-500" : "text-foreground"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" />
            Cycle Time Distribution
          </CardTitle>
          <CardDescription>
            {hasData
              ? `How long cards take from creation to completion (${cycleTime.sampleCount} samples)`
              : "No completed cards to analyse yet"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasData ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={cycleTime.histogram}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <RechartsTooltip contentStyle={CHART_STYLE} />
                <Bar dataKey="count" name="Cards" radius={[6, 6, 0, 0]}>
                  {cycleTime.histogram.map((_, i) => (
                    <Cell
                      key={`cell-${i}`}
                      fill={["#22c55e", "#3b82f6", "#f59e0b", "#f97316", "#ef4444"][i]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              Move cards to your "Done" list to start collecting cycle time data.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Percentile visual */}
      {/* Lead time trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            Lead Time Trend (Weekly)
          </CardTitle>
          <CardDescription>
            Average hours from card creation to completion per week — a falling line means the team is getting faster
          </CardDescription>
        </CardHeader>
        <CardContent>
          {d.leadTimeTrend.some((w) => w.count > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={d.leadTimeTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="h" />
                <RechartsTooltip
                  contentStyle={CHART_STYLE}
                  formatter={(v: unknown) => [`${v}h`, ""]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="avgHours"
                  name="Avg Lead Time"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#6366f1" }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="p50"
                  name="Median (P50)"
                  stroke="#22c55e"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3, fill: "#22c55e" }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              Move cards to your &ldquo;Done&rdquo; list to start collecting lead time data.
            </div>
          )}
        </CardContent>
      </Card>

      {hasData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Cycle Time Percentile Bar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative h-8 bg-gradient-to-r from-emerald-400 via-yellow-400 to-red-500 rounded-full overflow-hidden">
              {[
                { p: cycleTime.p50, label: "P50", pos: 50 },
                { p: cycleTime.p75, label: "P75", pos: 75 },
                { p: cycleTime.p90, label: "P90", pos: 90 },
              ].map(({ p, label, pos }) => (
                <div
                  key={label}
                  className="absolute top-0 h-full w-0.5 bg-white"
                  style={{ left: `${pos}%` }}
                >
                  <span className="absolute -top-6 -translate-x-1/2 text-[10px] font-semibold whitespace-nowrap">
                    {label}: {p}h
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
              <span>Fast</span>
              <span>Slow</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Flow ────────────────────────────────────────────────────────────────

function FlowTab({ d }: { d: AdvancedBoardAnalytics }) {
  const maxCardCount = d.listStats.reduce((m, s) => Math.max(m, s.cardCount), 0);

  return (
    <div className="space-y-6">
      {/* Cumulative flow */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-500" />
            Cumulative Flow (Last 14 Days)
          </CardTitle>
          <CardDescription>
            Total card count per list over time · widening bands indicate backlog growth
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={d.cumulativeFlow}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => format(parseISO(v), "MMM d")}
                tick={{ fontSize: 11 }}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <RechartsTooltip
                contentStyle={CHART_STYLE}
                labelFormatter={(v) => format(parseISO(v as string), "MMM d, yyyy")}
              />
              <Legend />
              {d.listNames.map((name, i) => (
                <Area
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stackId="1"
                  stroke={LIST_COLORS[i % LIST_COLORS.length]}
                  fill={LIST_COLORS[i % LIST_COLORS.length]}
                  fillOpacity={0.6}
                  strokeWidth={1.5}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* List bottleneck table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            List Bottleneck Analysis
          </CardTitle>
          <CardDescription>
            High card count + high avg age = potential bottleneck
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {d.listStats.map((ls, i) => {
              const isHot =
                !ls.completedList && (ls.overdueCount > 0 || ls.avgAgeDays > 7);
              return (
                <div
                  key={ls.listId}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm border",
                    isHot
                      ? "border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800"
                      : ls.completedList
                      ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800"
                      : "border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700",
                  )}
                >
                  <div
                    className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: LIST_COLORS[i % LIST_COLORS.length] }}
                  />
                  <span className="font-medium min-w-[120px] truncate">{ls.listTitle}</span>
                  <div className="flex-1 flex items-center gap-4 text-xs text-muted-foreground">
                    <span>
                      <strong className="text-foreground">{ls.cardCount}</strong> cards
                    </span>
                    <span>
                      avg age <strong className={cn(ls.avgAgeDays > 14 ? "text-red-500" : "text-foreground")}>
                        {ls.avgAgeDays}d
                      </strong>
                    </span>
                    {ls.overdueCount > 0 && (
                      <span className="text-red-500 flex items-center gap-0.5">
                        <AlertTriangle className="h-3 w-3" />
                        {ls.overdueCount} overdue
                      </span>
                    )}
                    {ls.completedList && (
                      <span className="text-emerald-600 flex items-center gap-0.5">
                        <CheckCircle2 className="h-3 w-3" />
                        Done list
                      </span>
                    )}
                  </div>
                  {/* Mini capacity bar */}
                  <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden hidden sm:block">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        ls.cardCount > 10 ? "bg-red-400" : ls.cardCount > 5 ? "bg-amber-400" : "bg-emerald-400",
                      )}
                      style={{
                        width: `${Math.min(100, (ls.cardCount / Math.max(1, maxCardCount)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab: Patterns ────────────────────────────────────────────────────────────

function PatternsTab({ d }: { d: AdvancedBoardAnalytics }) {
  // Day-of-week totals
  const maxDow = Math.max(...d.creationPattern.map((x) => x.count), 1);

  return (
    <div className="space-y-6">
      {/* Day-of-week heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-indigo-500" />
            Card Creation by Day of Week
          </CardTitle>
          <CardDescription>When does your team create the most work?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-32">
            {d.creationPattern.map(({ day, count }) => {
              const pct = (count / maxDow) * 100;
              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-semibold text-muted-foreground">{count}</span>
                  <div className="w-full rounded-t-md bg-indigo-500 transition-all duration-700"
                    style={{ height: `${Math.max(4, pct)}%`, opacity: 0.3 + pct / 140 }}
                  />
                  <span className="text-[10px] text-muted-foreground">{day}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Day-of-week chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-blue-500" />
            Creation Pattern (Chart)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={d.creationPattern}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <RechartsTooltip contentStyle={CHART_STYLE} />
              <Bar dataKey="count" name="Cards Created" radius={[6, 6, 0, 0]}>
                {d.creationPattern.map((_, i) => (
                  <Cell
                    key={i}
                    fill={[
                      "#818cf8", "#6366f1", "#4f46e5", "#4338ca", "#3730a3",
                      "#6366f1", "#818cf8",
                    ][i]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top labels pie */}
      {d.topLabels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-indigo-500" />
              Label Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center gap-6">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={d.topLabels.map((l) => ({ name: l.name, value: l.count }))}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) =>
                      (percent ?? 0) > 0.05
                        ? `${name} ${(((percent ?? 0) * 100)).toFixed(0)}%`
                        : ""
                    }
                    labelLine={false}
                  >
                    {d.topLabels.map((l, i) => (
                      <Cell key={i} fill={l.color || LIST_COLORS[i % LIST_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={CHART_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1.5 min-w-[140px]">
                {d.topLabels.map((l) => (
                  <div key={l.name} className="flex items-center gap-2 text-xs">
                    <span
                      className="h-2.5 w-2.5 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: l.color }}
                    />
                    <span className="truncate text-muted-foreground">{l.name}</span>
                    <span className="ml-auto font-semibold">{l.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Members ────────────────────────────────────────────────────────────

function MembersTab({ d }: { d: AdvancedBoardAnalytics }) {
  if (d.memberStats.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        No assigned cards yet — assign cards to team members to unlock member analytics.
      </div>
    );
  }

  const membersWithCompletions = d.memberStats.filter((m) => m.completedCards > 0);

  return (
    <div className="space-y-6">
      {/* Contribution overview cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Members Tracked"
          value={d.memberStats.length}
          icon={Users}
          sub="with at least 1 assigned card"
        />
        <StatCard
          title="Total Assigned"
          value={d.memberStats.reduce((s, m) => s + m.totalCards, 0)}
          icon={Activity}
          sub="cards across all members"
        />
        <StatCard
          title="Team Completion Rate"
          value={
            d.memberStats.reduce((s, m) => s + m.totalCards, 0) > 0
              ? `${
                  Math.round(
                    (d.memberStats.reduce((s, m) => s + m.completedCards, 0) /
                      d.memberStats.reduce((s, m) => s + m.totalCards, 0)) *
                      100,
                  )
                }%`
              : "—"
          }
          icon={CheckCircle2}
          sub="completed / total assigned"
        />
      </div>

      {/* Stacked bar: total vs completed vs overdue per member */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-500" />
            Member Contribution
          </CardTitle>
          <CardDescription>Total, completed, and overdue cards per member</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(200, d.memberStats.length * 44)}>
            <BarChart data={d.memberStats} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
              <RechartsTooltip contentStyle={CHART_STYLE} />
              <Legend />
              <Bar dataKey="totalCards" name="Total" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              <Bar dataKey="completedCards" name="Completed" fill="#22c55e" radius={[0, 4, 4, 0]} />
              <Bar dataKey="overdueCards" name="Overdue" fill="#ef4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Lead time by member */}
      {membersWithCompletions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              Avg Lead Time by Member
            </CardTitle>
            <CardDescription>Average hours from card creation to completion (members with completions only)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(160, membersWithCompletions.length * 44)}>
              <BarChart data={membersWithCompletions} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11 }} unit="h" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                <RechartsTooltip
                  contentStyle={CHART_STYLE}
                  formatter={(v: unknown) => [`${v}h`, "Avg Lead Time"]}
                />
                <Bar dataKey="avgLeadTimeHours" name="Avg Lead Time" radius={[0, 4, 4, 0]}>
                  {membersWithCompletions.map((_, i) => (
                    <Cell key={i} fill={LIST_COLORS[i % LIST_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Detail table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Member Detail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {d.memberStats.map((m, i) => {
              const completionPct =
                m.totalCards > 0 ? Math.round((m.completedCards / m.totalCards) * 100) : 0;
              return (
                <div
                  key={m.name}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm dark:border-slate-700"
                >
                  <div
                    className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: LIST_COLORS[i % LIST_COLORS.length] }}
                  >
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium min-w-[110px] truncate">{m.name}</span>
                  <div className="flex-1 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    <span>
                      <strong className="text-foreground">{m.totalCards}</strong> total
                    </span>
                    <span>
                      <strong className="text-emerald-600">{m.completedCards}</strong> done
                    </span>
                    {m.overdueCards > 0 && (
                      <span className="text-red-500 flex items-center gap-0.5">
                        <AlertTriangle className="h-3 w-3" />
                        {m.overdueCards} overdue
                      </span>
                    )}
                    {m.completedCards > 0 && (
                      <span>avg {m.avgLeadTimeHours}h lead time</span>
                    )}
                  </div>
                  {/* Completion progress bar */}
                  <div className="flex items-center gap-2 hidden sm:flex">
                    <span className="text-xs text-muted-foreground w-8 text-right">{completionPct}%</span>
                    <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                        style={{ width: `${completionPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface AdvancedAnalyticsProps {
  boardId: string;
  boardName: string;
}

export function AdvancedAnalytics({ boardId, boardName }: AdvancedAnalyticsProps) {
  const [data, setData] = useState<AdvancedBoardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    const result = await getAdvancedBoardAnalytics(boardId);

    if (result.data) {
      setData(result.data);
    } else {
      setError(result.error ?? "Failed to load analytics");
    }

    setLoading(false);
    setRefreshing(false);
  }, [boardId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
        <ChartSkeleton />
        <div className="grid gap-4 md:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertTriangle className="h-8 w-8 text-red-400" />
        <p className="text-muted-foreground">{error ?? "No analytics data available"}</p>
        <Button variant="outline" size="sm" onClick={() => load()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-indigo-500" />
            Advanced Analytics
          </h2>
          <p className="text-muted-foreground text-sm mt-0.5">{boardName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCSV(data, boardName)}
            className="gap-2"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => load(true)}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Health Score"
          value={`${data.scores.healthScore}/100`}
          icon={Activity}
          color={data.scores.healthScore >= 70 ? "text-emerald-600" : data.scores.healthScore >= 40 ? "text-amber-600" : "text-red-600"}
          sub="composite board health"
        />
        <StatCard
          title="Avg Cycle Time"
          value={`${data.cycleTime.avg}h`}
          icon={Clock}
          sub={`${data.cycleTime.sampleCount} completed cards`}
        />
        <StatCard
          title="Coverage"
          value={`${data.coverage.withBothPercent}%`}
          icon={Users}
          sub="cards with assignee + due date"
          trend={data.coverage.withBothPercent >= 70 ? "up" : "down"}
        />
        <StatCard
          title="On-time Score"
          value={`${data.scores.overdueScore}/100`}
          icon={CheckCircle2}
          color={data.scores.overdueScore >= 80 ? "text-emerald-600" : "text-red-600"}
          sub="higher = fewer overdue"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="burndown" className="text-xs">Burndown</TabsTrigger>
          <TabsTrigger value="cycletime" className="text-xs">Cycle Time</TabsTrigger>
          <TabsTrigger value="flow" className="text-xs">Flow</TabsTrigger>
          <TabsTrigger value="patterns" className="text-xs">Patterns</TabsTrigger>
          <TabsTrigger value="members" className="text-xs">Members</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab d={data} />
        </TabsContent>

        <TabsContent value="burndown" className="mt-4">
          <BurndownTab d={data} />
        </TabsContent>

        <TabsContent value="cycletime" className="mt-4">
          <CycleTimeTab d={data} />
        </TabsContent>

        <TabsContent value="flow" className="mt-4">
          <FlowTab d={data} />
        </TabsContent>

        <TabsContent value="patterns" className="mt-4">
          <PatternsTab d={data} />
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          <MembersTab d={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
