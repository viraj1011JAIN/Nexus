"use client";

import { useState } from "react";
import { Link2, Plus, Trash2, X, AlertCircle } from "lucide-react";
import { DependencyType } from "@prisma/client";
import { toast } from "sonner";
import { format, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCardDependencies, addCardDependency, removeCardDependency } from "@/actions/dependency-actions";

// ─── Types ─────────────────────────────────────────────────────────────────

interface LinkedCard {
  id: string;
  title: string;
  dueDate: Date | null;
  priority: string | null;
  list: { title: string };
}

interface DependencyRecord {
  id: string;
  type: DependencyType;
  blocker?: LinkedCard;
  blocked?: LinkedCard;
}

interface DependencyPanelProps {
  cardId: string;
  boardId?: string;
  initialBlocking?: DependencyRecord[];
  initialBlockedBy?: DependencyRecord[];
}

const TYPE_LABELS: Record<DependencyType, string> = {
  BLOCKS: "blocks",
  RELATES_TO: "relates to",
  DUPLICATES: "duplicates",
};

const TYPE_COLORS: Record<DependencyType, string> = {
  BLOCKS: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  RELATES_TO: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  DUPLICATES: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

// ─── Dependency Row ─────────────────────────────────────────────────────────

function DepRow({
  dep,
  direction,
  onRemove,
}: {
  dep: DependencyRecord;
  direction: "blocking" | "blockedBy";
  onRemove: (id: string) => void;
}) {
  const linked = direction === "blocking" ? dep.blocked : dep.blocker;
  if (!linked) return null;

  const isOverdue = linked.dueDate && isPast(new Date(linked.dueDate));

  return (
    <div className="flex items-start gap-2 group/dep p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 -mx-2 transition-colors">
      <span
        className={cn(
          "shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold",
          direction === "blocking" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
        )}
      >
        {direction === "blocking" ? "blocks" : "blocked by"}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{linked.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-slate-400">{linked.list.title}</span>
          {linked.dueDate && (
            <span
              className={cn(
                "text-xs",
                isOverdue ? "text-red-500" : "text-slate-400"
              )}
            >
              {isOverdue ? "Overdue · " : "Due "}
              {format(new Date(linked.dueDate), "MMM d")}
            </span>
          )}
        </div>
      </div>

      <span className={cn("shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium", TYPE_COLORS[dep.type])}>
        {TYPE_LABELS[dep.type]}
      </span>

      <button
        onClick={() => onRemove(dep.id)}
        className="opacity-0 group-hover/dep:opacity-100 text-slate-400 hover:text-red-500 transition-all mt-0.5"
        aria-label="Remove dependency"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Panel ──────────────────────────────────────────────────────────────────

export function DependencyPanel({
  cardId,
  boardId,
  initialBlocking = [],
  initialBlockedBy = [],
}: DependencyPanelProps) {
  const [blocking, setBlocking] = useState<DependencyRecord[]>(initialBlocking);
  const [blockedBy, setBlockedBy] = useState<DependencyRecord[]>(initialBlockedBy);
  const [isAdding, setIsAdding] = useState(false);
  const [targetCardId, setTargetCardId] = useState("");
  const [depType, setDepType] = useState<DependencyType>("BLOCKS");
  const [depDirection, setDepDirection] = useState<"this_blocks" | "blocked_by_this">("this_blocks");
  const [isLoading, setIsLoading] = useState(false);

  const reload = async () => {
    const res = await getCardDependencies(cardId);
    if (res.data) {
      setBlocking(res.data.blocking as unknown as DependencyRecord[]);
      setBlockedBy(res.data.blockedBy as unknown as DependencyRecord[]);
    }
  };

  const handleAdd = async () => {
    const id = targetCardId.trim();
    if (!id) return;

    setIsLoading(true);
    const blocker = depDirection === "this_blocks" ? cardId : id;
    const blocked = depDirection === "this_blocks" ? id : cardId;

    const res = await addCardDependency({ blockerId: blocker, blockedId: blocked, type: depType, boardId });
    setIsLoading(false);

    if (res.error) { toast.error(res.error); return; }

    toast.success("Dependency added");
    setIsAdding(false);
    setTargetCardId("");
    await reload();
  };

  const handleRemove = async (id: string) => {
    const res = await removeCardDependency({ id, boardId });
    if (res.error) { toast.error(res.error); return; }

    toast.success("Dependency removed");
    setBlocking((prev) => prev.filter((d) => d.id !== id));
    setBlockedBy((prev) => prev.filter((d) => d.id !== id));
  };

  const total = blocking.length + blockedBy.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
          <Link2 className="h-4 w-4" />
          Dependencies
          {total > 0 && (
            <Badge variant="secondary" className="text-xs h-5 px-1.5">
              {total}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => setIsAdding((v) => !v)}
        >
          {isAdding ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {isAdding ? "Cancel" : "Link"}
        </Button>
      </div>

      {/* Add form */}
      {isAdding && (
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Select value={depDirection} onValueChange={(v) => setDepDirection(v as typeof depDirection)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_blocks">This card blocks…</SelectItem>
                <SelectItem value="blocked_by_this">This card blocked by…</SelectItem>
              </SelectContent>
            </Select>
            <Select value={depType} onValueChange={(v) => setDepType(v as DependencyType)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BLOCKS">Blocks</SelectItem>
                <SelectItem value="RELATES_TO">Relates to</SelectItem>
                <SelectItem value="DUPLICATES">Duplicates</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input
            placeholder="Target card ID..."
            value={targetCardId}
            onChange={(e) => setTargetCardId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") setIsAdding(false);
            }}
            className="h-8 text-xs"
          />
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-3 w-3 text-slate-400" />
            <span className="text-xs text-slate-400">Paste the target card&apos;s ID (shown in the card title area)</span>
          </div>
          <Button size="sm" className="h-7 text-xs w-full" onClick={handleAdd} disabled={!targetCardId || isLoading}>
            {isLoading ? "Adding…" : "Add dependency"}
          </Button>
        </div>
      )}

      {/* Existing dependencies */}
      {total === 0 && !isAdding && (
        <p className="text-sm text-slate-400 dark:text-slate-600 text-center py-4">
          No dependencies yet
        </p>
      )}

      {blocking.length > 0 && (
        <div className="space-y-1">
          {blocking.map((dep) => (
            <DepRow key={dep.id} dep={dep} direction="blocking" onRemove={handleRemove} />
          ))}
        </div>
      )}

      {blockedBy.length > 0 && (
        <div className="space-y-1">
          {blockedBy.map((dep) => (
            <DepRow key={dep.id} dep={dep} direction="blockedBy" onRemove={handleRemove} />
          ))}
        </div>
      )}
    </div>
  );
}
