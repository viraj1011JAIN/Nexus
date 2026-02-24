"use client";

import { useState, useEffect } from "react";
import {
  Zap, Plus, Trash2, Play, Pause, ChevronDown, ChevronRight,
  Settings, ArrowRight, AlertCircle, Check, Loader2, Clock,
  Activity, ChevronUp, Edit3, Eye
} from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  getAutomations, createAutomation, updateAutomation, deleteAutomation, getAutomationLogs,
  type TriggerType, type ActionType, type TriggerConfig, type ActionConfig,
} from "@/actions/automation-actions";
import { Priority } from "@prisma/client";

// ─── Config Maps ──────────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<TriggerType, string> = {
  CARD_CREATED: "Card is created",
  CARD_MOVED: "Card is moved to a list",
  CARD_DELETED: "Card is deleted",
  CARD_DUE_SOON: "Card is due soon",
  CARD_OVERDUE: "Card becomes overdue",
  LABEL_ADDED: "Label is added to card",
  CHECKLIST_COMPLETED: "All checklist items completed",
  MEMBER_ASSIGNED: "Member is assigned",
  PRIORITY_CHANGED: "Priority is changed",
  CARD_TITLE_CONTAINS: "Card title contains keyword",
};

const ACTION_LABELS: Record<ActionType, string> = {
  MOVE_CARD: "Move card to list",
  SET_PRIORITY: "Set priority",
  ASSIGN_MEMBER: "Assign member",
  ADD_LABEL: "Add label",
  REMOVE_LABEL: "Remove label",
  SET_DUE_DATE_OFFSET: "Set due date (days from now)",
  POST_COMMENT: "Post a comment",
  SEND_NOTIFICATION: "Send notification to assignee",
  COMPLETE_CHECKLIST: "Mark checklist item complete",
};

const PRIORITY_OPTIONS = ["URGENT", "HIGH", "MEDIUM", "LOW", "NONE"] as Priority[];
// Actions that require a live card record — must not execute for CARD_DELETED triggers
const ACTIONS_BLOCKED_FOR_DELETED: ActionType[] = [
  "MOVE_CARD",
  "ASSIGN_MEMBER",
  "ADD_LABEL",
  "REMOVE_LABEL",
  "COMPLETE_CHECKLIST",
  "SET_PRIORITY",
  "SET_DUE_DATE_OFFSET",
  // POST_COMMENT writes a comment.cardId FK which would violate the constraint
  // if the card has already been deleted
  "POST_COMMENT",
];
// ─── Types ────────────────────────────────────────────────────────────────────

interface AutomationRecord {
  id: string;
  name: string;
  isEnabled: boolean;
  trigger: TriggerConfig;
  conditions: unknown[];
  actions: ActionConfig[];
  runCount: number;
  lastRunAt?: Date | null;
  _count: { logs: number };
}

interface AutomationBuilderProps {
  boardId?: string;
}

// ─── ActionEditor ─────────────────────────────────────────────────────────────

function ActionItem({
  action,
  onChange,
  onRemove,
  index,
  triggerType,
}: {
  action: ActionConfig;
  onChange: (a: ActionConfig) => void;
  onRemove: () => void;
  index: number;
  triggerType: TriggerType;
}) {
  // When CARD_DELETED is selected, filter out actions that require a live card record
  const allowedActionEntries = (Object.entries(ACTION_LABELS) as [ActionType, string][]).filter(
    ([v]) => triggerType !== "CARD_DELETED" || !ACTIONS_BLOCKED_FOR_DELETED.includes(v)
  );
  return (
    <div className="flex items-start gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
      <div className="flex-shrink-0 h-5 w-5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-[10px] font-bold text-indigo-600 mt-0.5">
        {index + 1}
      </div>
      <div className="flex-1 space-y-2">
        <Select
          value={action.type || ""}
          onValueChange={(v) => onChange({ type: v as ActionType })}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Choose action..." />
          </SelectTrigger>
          <SelectContent>
            {allowedActionEntries.map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Action-specific fields */}
        {action.type === "SET_PRIORITY" && (
          <Select
            value={action.priority ?? ""}
            onValueChange={(v) => onChange({ ...action, priority: v as Priority })}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Priority..." />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {action.type === "SET_DUE_DATE_OFFSET" && (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={-365}
              max={365}
              className="h-8 text-sm w-24"
              placeholder="0"
              value={action.daysOffset ?? ""}
              onChange={(e) => onChange({ ...action, daysOffset: parseInt(e.target.value) || 0 })}
            />
            <span className="text-xs text-muted-foreground">days from trigger date</span>
          </div>
        )}

        {(action.type === "POST_COMMENT") && (
          <Input
            className="h-8 text-sm"
            placeholder="Comment text..."
            value={action.comment ?? ""}
            onChange={(e) => onChange({ ...action, comment: e.target.value })}
          />
        )}

        {action.type === "SEND_NOTIFICATION" && (
          <Input
            className="h-8 text-sm"
            placeholder="Notification message..."
            value={action.notificationMessage ?? ""}
            onChange={(e) => onChange({ ...action, notificationMessage: e.target.value })}
          />
        )}
      </div>
      <button
        aria-label="Remove action"
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive transition-colors mt-0.5"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── CreateAutomationDialog ───────────────────────────────────────────────────

function CreateAutomationDialog({
  open,
  onClose,
  boardId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  boardId?: string;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState<TriggerType>("CARD_CREATED");
  const [triggerExtras, setTriggerExtras] = useState<Partial<TriggerConfig>>({});
  const [actionList, setActionList] = useState<ActionConfig[]>([{ type: "SET_PRIORITY" }]);
  const [saving, setSaving] = useState(false);

  // Determine the first allowed action type for the current trigger
  const firstAllowedActionType = (trigger: TriggerType): ActionType => {
    const blocked = trigger === "CARD_DELETED" ? ACTIONS_BLOCKED_FOR_DELETED : [];
    const allowed = (Object.keys(ACTION_LABELS) as ActionType[]).find((t) => !blocked.includes(t));
    return allowed ?? "SEND_NOTIFICATION";
  };

  const handleTriggerChange = (v: string) => {
    const next = v as TriggerType;
    setTriggerType(next);
    // When switching to CARD_DELETED, remove any actions that cannot run on a deleted card.
    if (next === "CARD_DELETED") {
      setActionList((prev) => {
        const filtered = prev.filter((a) => !ACTIONS_BLOCKED_FOR_DELETED.includes(a.type));
        // Ensure at least one valid action remains after filtering.
        return filtered.length > 0 ? filtered : [{ type: firstAllowedActionType(next) }];
      });
    }
  };

  const handleAddAction = () => {
    // Default new action to a type that is valid for the current trigger.
    setActionList((prev) => [...prev, { type: firstAllowedActionType(triggerType) }]);
  };

  const handleSave = async () => {
    if (!name.trim() || !actionList.length) return;
    // Prevent saving blocked action types (e.g. if the user somehow bypasses the UI filter).
    const invalidAction = actionList.find(
      (a) => triggerType === "CARD_DELETED" && ACTIONS_BLOCKED_FOR_DELETED.includes(a.type)
    );
    if (invalidAction) {
      toast.error(`Action "${ACTION_LABELS[invalidAction.type] ?? invalidAction.type}" cannot be used with the CARD_DELETED trigger.`);
      return;
    }
    setSaving(true);
    try {
      const result = await createAutomation({
        boardId,
        name: name.trim(),
        trigger: { type: triggerType, ...triggerExtras },
        conditions: [],
        actions: actionList,
      });
      if (result.error) { toast.error(result.error); return; }
      toast.success("Automation created!");
      onCreated();
      onClose();
      setName("");
      setTriggerType("CARD_CREATED");
      setTriggerExtras({});
      setActionList([{ type: "SET_PRIORITY" }]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Create Automation
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="auto-name">Automation name</Label>
            <Input
              id="auto-name"
              placeholder="e.g. Move done cards, Auto-assign urgent"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Trigger */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-amber-400" />
              When this happens (trigger)
            </Label>
            <Select value={triggerType} onValueChange={handleTriggerChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(TRIGGER_LABELS) as [TriggerType, string][]).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Trigger-specific extras */}
            {triggerType === "CARD_DUE_SOON" && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={30}
                  className="h-8 text-sm w-24"
                  placeholder="2"
                  value={triggerExtras.daysBeforeDue ?? ""}
                  onChange={(e) => setTriggerExtras({ ...triggerExtras, daysBeforeDue: parseInt(e.target.value) || 2 })}
                />
                <span className="text-xs text-muted-foreground">days before due date</span>
              </div>
            )}

            {triggerType === "CARD_TITLE_CONTAINS" && (
              <Input
                className="h-8 text-sm"
                placeholder="Keyword..."
                value={triggerExtras.keyword ?? ""}
                onChange={(e) => setTriggerExtras({ ...triggerExtras, keyword: e.target.value })}
              />
            )}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-indigo-500" />
              Do this (actions)
            </Label>
            <div className="space-y-2">
              {actionList.map((action, i) => (
                <ActionItem
                  key={i}
                  index={i}
                  action={action}
                  triggerType={triggerType}
                  onChange={(a) => {
                    const next = [...actionList];
                    next[i] = a;
                    setActionList(next);
                  }}
                  onRemove={() => setActionList((prev) => prev.filter((_, idx) => idx !== i))}
                />
              ))}
            </div>
            <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={handleAddAction}>
              <Plus className="h-3.5 w-3.5" />
              Add another action
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
            Create Automation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── AutomationCard ───────────────────────────────────────────────────────────

function AutomationCard({
  automation,
  onToggle,
  onDelete,
  onViewLogs,
}: {
  automation: AutomationRecord;
  onToggle: () => void;
  onDelete: () => void;
  onViewLogs: () => void;
}) {
  const trigger = automation.trigger as TriggerConfig;

  return (
    <div className={cn(
      "border rounded-xl p-4 bg-white dark:bg-slate-900 transition-all",
      automation.isEnabled
        ? "border-slate-200 dark:border-slate-700 shadow-sm"
        : "border-dashed border-slate-300 dark:border-slate-600 opacity-60",
    )}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn(
          "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0",
          automation.isEnabled
            ? "bg-amber-100 dark:bg-amber-900/30"
            : "bg-slate-100 dark:bg-slate-800"
        )}>
          <Zap className={cn("h-4 w-4", automation.isEnabled ? "text-amber-500" : "text-slate-400")} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
              {automation.name}
            </p>
            {!automation.isEnabled && (
              <Badge variant="secondary" className="text-xs h-4 px-1.5">Paused</Badge>
            )}
          </div>

          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              {TRIGGER_LABELS[trigger.type] ?? trigger.type}
            </span>
            <ArrowRight className="h-3 w-3" />
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              {(automation.actions as ActionConfig[]).length} action{(automation.actions as ActionConfig[]).length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              {automation.runCount} runs
            </span>
            {automation.lastRunAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last: {format(new Date(automation.lastRunAt), "MMM d, HH:mm")}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Switch
            checked={automation.isEnabled}
            onCheckedChange={onToggle}
          />
          <Button
            variant="ghost"
            size="sm"
            aria-label="View logs"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={onViewLogs}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Delete automation"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── LogsDialog ───────────────────────────────────────────────────────────────

function LogsDialog({
  automationId,
  name,
  open,
  onClose,
}: {
  automationId: string;
  name: string;
  open: boolean;
  onClose: () => void;
}) {
  const [logs, setLogs] = useState<{ id: string; success: boolean; error?: string | null; ranAt: Date; cardId?: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getAutomationLogs(automationId).then((result) => {
      if (result.data) setLogs(result.data as typeof logs);
    }).catch((e) => {
      console.error("[LOGS_DIALOG]", e);
      toast.error("Failed to load automation logs.");
      setLogs([]);
    }).finally(() => {
      setLoading(false);
    });
  }, [open, automationId]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[70vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Activity className="h-4 w-4 text-indigo-500" />
            Run Logs: {name}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No runs yet.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className={cn(
                "flex items-start gap-3 p-2.5 rounded-lg text-xs",
                log.success ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-red-50 dark:bg-red-950/20"
              )}>
                {log.success
                  ? <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  : <AlertCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5" />}
                <div className="flex-1">
                  <p className={log.success ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}>
                    {log.success ? "Ran successfully" : log.error ?? "Failed"}
                  </p>
                  <p className="text-muted-foreground mt-0.5">{format(new Date(log.ranAt), "MMM d, yyyy HH:mm:ss")}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── AutomationBuilder (main) ─────────────────────────────────────────────────

export function AutomationBuilder({ boardId }: AutomationBuilderProps) {
  const [automations, setAutomations] = useState<AutomationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [logsFor, setLogsFor] = useState<{ id: string; name: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const result = await getAutomations(boardId);
    if (result.data) setAutomations(result.data as unknown as AutomationRecord[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [boardId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = async (auto: AutomationRecord) => {
    setAutomations((prev) => prev.map((a) => a.id === auto.id ? { ...a, isEnabled: !a.isEnabled } : a));
    const result = await updateAutomation(auto.id, { isEnabled: !auto.isEnabled });
    if (result.error) {
      setAutomations((prev) => prev.map((a) => a.id === auto.id ? { ...a, isEnabled: auto.isEnabled } : a));
      toast.error(result.error);
    }
  };

  const handleDelete = async (id: string) => {
    const result = await deleteAutomation(id);
    if (result.error) { toast.error(result.error); return; }
    setAutomations((prev) => prev.filter((a) => a.id !== id));
    toast.success("Automation deleted.");
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Automations
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Automate repetitive tasks with trigger-action rules
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          New Automation
        </Button>
      </div>

      {/* List */}
      {automations.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-10 text-center">
          <Zap className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No automations yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            Create rules that automatically perform actions when conditions are met — like moving cards or setting priorities.
          </p>
          <Button onClick={() => setShowCreate(true)} size="sm" className="mt-4 gap-1.5">
            <Plus className="h-4 w-4" />
            Create your first automation
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {automations.map((auto) => (
            <AutomationCard
              key={auto.id}
              automation={auto}
              onToggle={() => handleToggle(auto)}
              onDelete={() => handleDelete(auto.id)}
              onViewLogs={() => setLogsFor({ id: auto.id, name: auto.name })}
            />
          ))}
        </div>
      )}

      <CreateAutomationDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        boardId={boardId}
        onCreated={load}
      />

      {logsFor && (
        <LogsDialog
          automationId={logsFor.id}
          name={logsFor.name}
          open={!!logsFor}
          onClose={() => setLogsFor(null)}
        />
      )}
    </div>
  );
}
