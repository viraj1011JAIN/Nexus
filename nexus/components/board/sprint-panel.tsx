"use client";

import { useState, useEffect, useCallback } from "react";
import {
  GitBranch,
  Plus,
  Play,
  CheckCircle2,
  Trash2,
  ChevronDown,
  ChevronRight,
  Calendar,
  Target,
  Loader2,
  BarChart2,
  Inbox,
  MoveRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  getSprintsForBoard,
  getBacklogCards,
  createSprint,
  startSprint,
  completeSprint,
  deleteSprint,
  addCardToSprint,
} from "@/actions/sprint-actions";
import { format, differenceInDays } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SprintCard {
  id: string;
  title: string;
  storyPoints?: number | null;
  priority?: string | null;
  dueDate?: Date | string | null;
  list?: { title: string } | null;
}

interface Sprint {
  id: string;
  name: string;
  goal?: string | null;
  status: string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  completedAt?: Date | string | null;
  cards: SprintCard[];
  _count?: { cards: number };
}

interface BacklogCard {
  id: string;
  title: string;
  storyPoints?: number | null;
  priority?: string | null;
  dueDate?: Date | string | null;
  order: number;
  list: { title: string; id: string } | null;
}

// ─── Status Helpers ───────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  PLANNING: { label: "Planning", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  ACTIVE: { label: "Active", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  COMPLETED: { label: "Completed", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
};

// ─── Burndown Chart ───────────────────────────────────────────────────────────

function BurndownChart({ sprint }: { sprint: Sprint }) {
  if (sprint.status !== "ACTIVE" && sprint.status !== "COMPLETED") return null;
  if (!sprint.startDate || !sprint.endDate) return null;

  const start = new Date(sprint.startDate);
  const end = new Date(sprint.endDate);
  const totalDays = Math.max(1, differenceInDays(end, start));
  const totalPoints = sprint.cards.reduce((s, c) => s + (c.storyPoints ?? 0), 0);
  // Infer completion from list title (Done/Completed lists)
  const isDoneList = (c: SprintCard) =>
    /done|complet|finish/i.test(c.list?.title ?? "");
  const completedPoints = sprint.cards.filter(isDoneList).reduce((s, c) => s + (c.storyPoints ?? 0), 0);
  const remainingPoints = totalPoints - completedPoints;

  // Build ideal line
  const idealData = Array.from({ length: totalDays + 1 }, (_, i) => ({
    day: `Day ${i}`,
    ideal: Math.round(totalPoints - (totalPoints / totalDays) * i),
    actual: i === 0 ? totalPoints : i === totalDays ? remainingPoints : undefined,
  }));

  // Fill in linear interpolation for actual
  if (idealData.length > 1) {
    idealData[idealData.length - 1].actual = remainingPoints;
  }

  return (
    <div className="mt-4 bg-white dark:bg-slate-800 rounded-lg border p-4">
      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
        <BarChart2 className="h-4 w-4 text-blue-500" />
        Burndown Chart
      </h4>
      <div className="h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={idealData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="ideal"
              stroke="#94a3b8"
              strokeDasharray="4 4"
              dot={false}
              name="Ideal"
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 4, fill: "#3b82f6" }}
              connectNulls
              name="Actual"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Sprint Card ──────────────────────────────────────────────────────────────

function SprintCard({
  sprint,
  onStart,
  onComplete,
  onDelete,
  canStartSprint,
}: {
  sprint: Sprint;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  canStartSprint: boolean;
}) {
  const [open, setOpen] = useState(sprint.status === "ACTIVE");

  const totalCards = sprint.cards.length;
  const isCardDone = (c: SprintCard) => /done|complet|finish/i.test(c.list?.title ?? "");
  const doneCards = sprint.cards.filter(isCardDone).length;
  const totalPoints = sprint.cards.reduce((s, c) => s + (c.storyPoints ?? 0), 0);
  const donePoints = sprint.cards.filter(isCardDone).reduce((s, c) => s + (c.storyPoints ?? 0), 0);
  const progress = totalCards > 0 ? Math.round((doneCards / totalCards) * 100) : 0;

  const statusInfo = STATUS_BADGE[sprint.status] ?? STATUS_BADGE.PLANNING;

  return (
    <div className="bg-white dark:bg-slate-800 border rounded-xl overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
            {open ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
            <GitBranch className="h-4 w-4 text-blue-500 flex-shrink-0" />
            <span className="font-medium text-sm flex-1 truncate">{sprint.name}</span>
            <Badge className={cn("text-xs", statusInfo.className)}>{statusInfo.label}</Badge>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-3">
            {sprint.goal && (
              <p className="text-sm text-muted-foreground italic flex items-start gap-2">
                <Target className="h-3 w-3 mt-0.5 flex-shrink-0" />
                {sprint.goal}
              </p>
            )}

            {(sprint.startDate || sprint.endDate) && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {sprint.startDate ? format(new Date(sprint.startDate), "MMM d") : "—"}
                  {" → "}
                  {sprint.endDate ? format(new Date(sprint.endDate), "MMM d") : "—"}
                </span>
              </div>
            )}

            {/* Progress */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{doneCards}/{totalCards} cards</span>
                <span>{totalPoints > 0 ? `${donePoints}/${totalPoints} pts` : "No estimates"}</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>

            {/* Card list */}
            {sprint.cards.length > 0 && (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {sprint.cards.map((card) => (
                  <div
                    key={card.id}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs",
                      isCardDone(card)
                        ? "text-muted-foreground line-through"
                        : "text-foreground"
                    )}
                  >
                    <CheckCircle2
                      className={cn("h-3 w-3 flex-shrink-0", isCardDone(card) ? "text-green-500" : "text-muted-foreground/30")}
                    />
                    <span className="flex-1 truncate">{card.title}</span>
                    {card.storyPoints ? (
                      <Badge variant="outline" className="text-[10px] h-4 px-1">
                        {card.storyPoints}
                      </Badge>
                    ) : null}
                    {card.list?.title && (
                      <span className="text-muted-foreground/60 truncate max-w-[80px]">{card.list.title}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {sprint.cards.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">
                No cards assigned to this sprint yet.
              </p>
            )}

            {/* Burndown chart */}
            <BurndownChart sprint={sprint} />

            {/* Actions */}
            <Separator />
            <div className="flex items-center gap-2 pt-1">
              {sprint.status === "PLANNING" && canStartSprint && (
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-xs gap-1"
                  onClick={() => onStart(sprint.id)}
                >
                  <Play className="h-3 w-3" /> Start Sprint
                </Button>
              )}
              {sprint.status === "ACTIVE" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50"
                  onClick={() => onComplete(sprint.id)}
                >
                  <CheckCircle2 className="h-3 w-3" /> Complete Sprint
                </Button>
              )}
              {sprint.status !== "ACTIVE" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1 text-destructive hover:text-destructive ml-auto"
                  onClick={() => onDelete(sprint.id)}
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </Button>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ─── Main Sprint Panel ────────────────────────────────────────────────────────

export function SprintPanel({ boardId }: { boardId: string }) {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [backlogCards, setBacklogCards] = useState<BacklogCard[]>([]);
  const [backlogOpen, setBacklogOpen] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [movingCard, setMovingCard] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [sprintsResult, backlogResult] = await Promise.all([
      getSprintsForBoard(boardId),
      getBacklogCards(boardId),
    ]);
    if (sprintsResult.data) setSprints(sprintsResult.data as Sprint[]);
    if (backlogResult.data) setBacklogCards(backlogResult.data as unknown as BacklogCard[]);
    setLoading(false);
  }, [boardId]);

  useEffect(() => { load(); }, [load]);

  const handleMoveToSprint = async (cardId: string, sprintId: string) => {
    setMovingCard(cardId);
    const result = await addCardToSprint(cardId, sprintId);
    if (result.error) { toast.error(result.error); }
    else { toast.success("Card moved to sprint!"); await load(); }
    setMovingCard(null);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const result = await createSprint(
        boardId,
        name.trim(),
        goal || undefined,
        startDate || undefined,
        endDate || undefined
      );
      if (result.error) { toast.error(result.error); return; }
      toast.success("Sprint created!");
      setName(""); setGoal(""); setStartDate(""); setEndDate("");
      setShowCreate(false);
      await load();
    } finally {
      setCreating(false);
    }
  };

  const handleStart = async (id: string) => {
    const result = await startSprint(id);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Sprint started!");
    await load();
  };

  const handleComplete = async (id: string) => {
    const result = await completeSprint(id);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Sprint completed! Incomplete cards moved to backlog.");
    await load();
  };

  const handleDelete = async (id: string) => {
    const result = await deleteSprint(id);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Sprint deleted.");
    await load();
  };

  const hasActiveSprint = sprints.some((s) => s.status === "ACTIVE");

  const grouped = {
    ACTIVE: sprints.filter((s) => s.status === "ACTIVE"),
    PLANNING: sprints.filter((s) => s.status === "PLANNING"),
    COMPLETED: sprints.filter((s) => s.status === "COMPLETED"),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-blue-500" /> Sprints
        </h3>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="h-3 w-3" /> New Sprint
        </Button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && sprints.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <GitBranch className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No sprints yet.</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Create a sprint to plan your iteration.
          </p>
        </div>
      )}

      {!loading && (
        <ScrollArea className="pr-1">
          <div className="space-y-3">
            {/* ── Backlog Section ─────────────────────────────────────── */}
            <Collapsible open={backlogOpen} onOpenChange={setBacklogOpen}>
              <div className="flex items-center justify-between rounded-lg border border-dashed border-slate-200 dark:border-slate-700 px-3 py-2">
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                    {backlogOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <Inbox className="h-4 w-4 text-slate-400" />
                    Backlog
                    <span className="ml-1 text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full">
                      {backlogCards.length}
                    </span>
                  </button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent>
                {backlogCards.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground/60">
                    <p className="text-xs">No unassigned cards. All cards are in sprints.</p>
                  </div>
                ) : (
                  <div className="mt-1 space-y-1 pl-2">
                    {backlogCards.map((card) => {
                      const planningsprints = sprints.filter((s) => s.status === "PLANNING" || s.status === "ACTIVE");
                      return (
                        <div
                          key={card.id}
                          className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent transition-colors text-sm"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="block truncate text-sm font-medium text-card-foreground">{card.title}</span>
                            {card.list && (
                              <span className="text-xs text-muted-foreground">{card.list.title}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            {planningsprints.length > 0 && (
                              <div className="flex items-center gap-1">
                                {planningsprints.slice(0, 3).map((s) => (
                                  <Button
                                    key={s.id}
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 text-xs gap-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                    disabled={movingCard === card.id}
                                    onClick={() => handleMoveToSprint(card.id, s.id)}
                                  >
                                    {movingCard === card.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <MoveRight className="h-3 w-3" />
                                    )}
                                    {s.name}
                                  </Button>
                                ))}
                              </div>
                            )}
                            {card.storyPoints != null && (
                              <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                                {card.storyPoints}pt
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

            {(grouped.ACTIVE.length > 0 || grouped.PLANNING.length > 0) && <Separator />}

            {grouped.ACTIVE.map((s) => (
              <SprintCard key={s.id} sprint={s} onStart={handleStart} onComplete={handleComplete} onDelete={handleDelete} canStartSprint={!hasActiveSprint} />
            ))}
            {grouped.PLANNING.map((s) => (
              <SprintCard key={s.id} sprint={s} onStart={handleStart} onComplete={handleComplete} onDelete={handleDelete} canStartSprint={!hasActiveSprint} />
            ))}
            {grouped.COMPLETED.length > 0 && (
              <>
                <Separator />
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide px-1">Completed</p>
                {grouped.COMPLETED.map((s) => (
                  <SprintCard key={s.id} sprint={s} onStart={handleStart} onComplete={handleComplete} onDelete={handleDelete} canStartSprint={!hasActiveSprint} />
                ))}
              </>
            )}
          </div>
        </ScrollArea>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-blue-500" /> Create Sprint
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Sprint Name *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sprint 1"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Goal (optional)</label>
              <Textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="What do you want to achieve?"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Start Date</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">End Date</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !name.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Sprint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
