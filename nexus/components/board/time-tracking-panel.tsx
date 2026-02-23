"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, Plus, Trash2, Loader2, Timer, Edit2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  getTimeLogs,
  logTime,
  updateTimeLog,
  deleteTimeLog,
} from "@/actions/time-tracking-actions";
import { format } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimeLogEntry {
  id: string;
  minutes: number;
  description?: string | null;
  loggedAt: Date | string;
  user: {
    id: string;
    name: string;
    imageUrl?: string | null;
  };
}

interface TimeData {
  logs: TimeLogEntry[];
  totalMinutes: number;
  estimatedMinutes?: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function parseTimeInput(input: string): number | null {
  const trimmed = input.trim().toLowerCase();
  // Accept "2h", "1h30m", "90m", "90", "1.5h", "1.5"
  const hoursOnly = trimmed.match(/^(\d+(?:\.\d+)?)\s*h$/);
  if (hoursOnly) return Math.round(parseFloat(hoursOnly[1]) * 60);
  const minsOnly = trimmed.match(/^(\d+)\s*m?$/);
  if (minsOnly) return parseInt(minsOnly[1], 10);
  const hoursAndMins = trimmed.match(/^(\d+)\s*h\s*(\d+)\s*m?$/);
  if (hoursAndMins) return parseInt(hoursAndMins[1], 10) * 60 + parseInt(hoursAndMins[2], 10);
  return null;
}

// ─── Log Row ──────────────────────────────────────────────────────────────────

function TimeLogRow({
  entry,
  currentUserId,
  onDelete,
  onUpdate,
}: {
  entry: TimeLogEntry;
  currentUserId?: string;
  onDelete: (id: string) => void;
  onUpdate: (id: string, minutes: number, description?: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editTime, setEditTime] = useState(formatMinutes(entry.minutes));
  const [editDesc, setEditDesc] = useState(entry.description ?? "");
  const isOwn = entry.user.id === currentUserId;

  const handleSave = () => {
    const mins = parseTimeInput(editTime);
    if (!mins || mins <= 0) { toast.error("Invalid time format. Use e.g. '2h', '90m', '1h30m'"); return; }
    onUpdate(entry.id, mins, editDesc || undefined);
    setEditing(false);
  };

  return (
    <div className="group flex items-start gap-3 py-2.5">
      <Avatar className="h-7 w-7 flex-shrink-0 mt-0.5">
        <AvatarImage src={entry.user.imageUrl ?? ""} />
        <AvatarFallback className="text-xs">{entry.user.name?.[0] ?? "?"}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
                className="h-7 text-sm w-24"
                placeholder="2h, 90m…"
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
              <Input
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="h-7 text-sm flex-1"
                placeholder="Description"
              />
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="default" className="h-6 text-xs" onClick={handleSave}>
                <Check className="h-3 w-3 mr-1" /> Save
              </Button>
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditing(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{entry.user.name}</span>
              <Badge variant="secondary" className="text-xs h-5 font-mono">
                {formatMinutes(entry.minutes)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {format(new Date(entry.loggedAt), "MMM d, yyyy")}
              </span>
            </div>
            {entry.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{entry.description}</p>
            )}
          </>
        )}
      </div>

      {isOwn && !editing && (
        <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setEditing(true)}
          >
            <Edit2 className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={() => onDelete(entry.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface TimeTrackingPanelProps {
  cardId: string;
  currentUserId?: string;
}

export function TimeTrackingPanel({ cardId, currentUserId }: TimeTrackingPanelProps) {
  const [data, setData] = useState<TimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [inputTime, setInputTime] = useState("");
  const [inputDesc, setInputDesc] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getTimeLogs(cardId);
    if (result.data) setData(result.data as TimeData);
    setLoading(false);
  }, [cardId]);

  useEffect(() => { load(); }, [load]);

  const handleLog = async () => {
    const mins = parseTimeInput(inputTime);
    if (!mins || mins <= 0) {
      toast.error("Invalid time. Use formats like '2h', '90m', '1h30m'");
      return;
    }
    setSaving(true);
    try {
      const result = await logTime(cardId, mins, inputDesc || undefined);
      if (result.error) { toast.error(result.error); return; }
      toast.success(`Logged ${formatMinutes(mins)}`);
      setInputTime(""); setInputDesc("");
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteTimeLog(id);
    await load();
  };

  const handleUpdate = async (id: string, minutes: number, description?: string) => {
    await updateTimeLog(id, minutes, description);
    await load();
  };

  const progress =
    data?.estimatedMinutes && data.estimatedMinutes > 0
      ? Math.min(100, Math.round((data.totalMinutes / data.estimatedMinutes) * 100))
      : null;

  const isOvertime =
    data?.estimatedMinutes && data.estimatedMinutes > 0
      ? data.totalMinutes > data.estimatedMinutes
      : false;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Timer className="h-4 w-4 text-purple-500" /> Time Tracking
          </h3>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={() => setShowForm((v) => !v)}
          >
            <Plus className="h-3 w-3" /> Log Time
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-6 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Logged</p>
                <p className={cn("font-mono font-semibold", isOvertime && "text-red-500")}>
                  {formatMinutes(data?.totalMinutes ?? 0)}
                </p>
              </div>
              {data?.estimatedMinutes && (
                <div>
                  <p className="text-xs text-muted-foreground">Estimated</p>
                  <p className="font-mono font-semibold text-muted-foreground">
                    {formatMinutes(data.estimatedMinutes)}
                  </p>
                </div>
              )}
              {progress !== null && (
                <div>
                  <p className="text-xs text-muted-foreground">Progress</p>
                  <p className={cn("font-semibold text-sm", isOvertime ? "text-red-500" : "text-green-600")}>
                    {progress}%
                  </p>
                </div>
              )}
            </div>

            {progress !== null && (
              <Progress
                value={Math.min(progress, 100)}
                className={cn("h-2", isOvertime && "[&>div]:bg-red-500")}
              />
            )}
          </>
        )}
      </div>

      {/* Log form */}
      {showForm && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border p-4 space-y-3">
          <h4 className="text-sm font-medium">Log Time Spent</h4>
          <div className="flex gap-2">
            <Input
              value={inputTime}
              onChange={(e) => setInputTime(e.target.value)}
              placeholder="e.g. 2h, 90m, 1h30m"
              className="w-36 font-mono"
              onKeyDown={(e) => e.key === "Enter" && handleLog()}
            />
            <Input
              value={inputDesc}
              onChange={(e) => setInputDesc(e.target.value)}
              placeholder="What did you work on? (optional)"
              className="flex-1"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleLog} disabled={saving || !inputTime.trim()}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Clock className="h-3 w-3 mr-2" />}
              Log Time
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Formats: <span className="font-mono">2h</span>, <span className="font-mono">90m</span>, <span className="font-mono">1h30m</span>, <span className="font-mono">1.5h</span>
          </p>
        </div>
      )}

      {/* History */}
      {!loading && data && data.logs.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border p-4">
          <h4 className="text-sm font-medium mb-3">History</h4>
          <div className="space-y-0 divide-y">
            {data.logs.map((entry) => (
              <TimeLogRow
                key={entry.id}
                entry={entry}
                currentUserId={currentUserId}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
              />
            ))}
          </div>
        </div>
      )}

      {!loading && data && data.logs.length === 0 && !showForm && (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No time logged yet.</p>
        </div>
      )}
    </div>
  );
}
