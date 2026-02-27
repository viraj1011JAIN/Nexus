"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Webhook,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  getWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  rotateWebhookSecret,
} from "@/actions/webhook-actions";
import { WEBHOOK_EVENTS } from "@/lib/webhook-constants";
import { format } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WebhookDelivery {
  id: string;
  event: string;
  statusCode?: number | null;
  success: boolean;
  duration?: number | null;
  attemptedAt: Date | string;
}

interface WebhookData {
  id: string;
  url: string;
  events: string[];
  isEnabled: boolean;
  createdAt: Date | string;
  _count?: { deliveries: number };
  deliveries: WebhookDelivery[];
}

// ─── CopyButton ───────────────────────────────────────────────────────────────

function CopyButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="ghost" size="icon" className={cn("h-7 w-7", className)} onClick={handleCopy}>
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

// ─── Webhook Row ──────────────────────────────────────────────────────────────

function WebhookRow({
  webhook,
  onToggle,
  onDelete,
  onRotateSecret: _onRotateSecret,
}: {
  webhook: WebhookData;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
  onRotateSecret: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const handleRotate = async () => {
    setRotating(true);
    try {
      const result = await rotateWebhookSecret(webhook.id);
      if (result.error) { toast.error(result.error); return; }
      if (result.data) {
        setNewSecret(result.data.secret);
        toast.success("Secret rotated! Save it now — it won't be shown again.");
      }
    } finally {
      setRotating(false);
    }
  };

  return (
    <div className="border rounded-xl overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors">
            {open ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
            <Webhook className="h-4 w-4 text-blue-500 flex-shrink-0" />
            <span className="flex-1 text-sm font-mono truncate">{webhook.url}</span>
            <Switch
              checked={webhook.isEnabled}
              onCheckedChange={(v) => {
                onToggle(webhook.id, v);
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-shrink-0"
            />
            <Badge
              variant={webhook.isEnabled ? "default" : "secondary"}
              className={cn("flex-shrink-0 text-xs", webhook.isEnabled ? "bg-green-100 text-green-700 border-green-200" : "")}
            >
              {webhook.isEnabled ? "Active" : "Paused"}
            </Badge>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4 border-t pt-4">
            {/* Events */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Subscribed Events</p>
              <div className="flex flex-wrap gap-1.5">
                {webhook.events.map((e) => (
                  <Badge key={e} variant="outline" className="text-xs">{e}</Badge>
                ))}
              </div>
            </div>

            {/* Recent Deliveries */}
            {webhook.deliveries.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                  Recent Deliveries ({webhook._count?.deliveries ?? 0} total)
                </p>
                <div className="space-y-1.5">
                  {webhook.deliveries.map((d) => (
                    <div key={d.id} className="flex items-center gap-2 text-xs">
                      {d.success ? (
                        <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
                      )}
                      <span className="flex-1 truncate text-muted-foreground">{d.event}</span>
                      {d.statusCode && (
                        <span className={cn("font-mono", d.statusCode < 400 ? "text-green-600" : "text-red-600")}>
                          {d.statusCode}
                        </span>
                      )}
                      {d.duration && (
                        <span className="text-muted-foreground/60">{d.duration}ms</span>
                      )}
                      <span className="text-muted-foreground/60">
                        {format(new Date(d.attemptedAt), "MMM d HH:mm")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Secret */}
            {newSecret && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1.5">
                  ⚠ New signing secret — save it now!
                </p>
                <div className="flex items-center gap-2">
                  <code className={cn("text-xs font-mono flex-1 truncate", showSecret ? "" : "blur-sm")}>
                    {newSecret}
                  </code>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowSecret((v) => !v)}>
                    {showSecret ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </Button>
                  <CopyButton value={newSecret} />
                </div>
              </div>
            )}

            {/* Actions */}
            <Separator />
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={handleRotate}
                disabled={rotating}
              >
                {rotating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Rotate Secret
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-destructive hover:text-destructive ml-auto"
                onClick={() => onDelete(webhook.id)}
              >
                <Trash2 className="h-3 w-3" /> Delete
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function WebhooksSettings() {
  const [webhooks, setWebhooks] = useState<WebhookData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getWebhooks();
    if (result.data) setWebhooks(result.data as WebhookData[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!url.trim() || selectedEvents.length === 0) return;
    setCreating(true);
    try {
      const result = await createWebhook(url.trim(), selectedEvents);
      if (result.error) { toast.error(result.error); return; }
      if (result.data) {
        setCreatedSecret(result.data.secret);
        toast.success("Webhook created! Save the secret.");
        setUrl(""); setSelectedEvents([]);
        await load();
      }
    } finally {
      setCreating(false);
    }
  };

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    await updateWebhook(id, { isEnabled: enabled });
    setWebhooks((prev) => prev.map((w) => (w.id === id ? { ...w, isEnabled: enabled } : w)));
  };

  const handleDelete = async (id: string) => {
    const result = await deleteWebhook(id);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Webhook deleted.");
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
  };

  const handleRotateSecret = async (_id: string) => {
    // Handled inside WebhookRow component
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Webhook className="h-5 w-5 text-blue-500" /> Webhooks
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Receive HTTP POST notifications when events happen in your organization.
          </p>
        </div>
        <Button
          onClick={() => { setShowCreate(true); setCreatedSecret(null); }}
          className="gap-1"
        >
          <Plus className="h-4 w-4" /> Add Webhook
        </Button>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && webhooks.length === 0 && (
        <div className="text-center py-16 text-muted-foreground border rounded-xl">
          <Webhook className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No webhooks configured yet.</p>
        </div>
      )}

      {!loading && (
        <div className="space-y-3">
          {webhooks.map((w) => (
            <WebhookRow
              key={w.id}
              webhook={w}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onRotateSecret={handleRotateSecret}
            />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Webhook</DialogTitle>
            <DialogDescription>
              We&apos;ll send a POST request with a JSON payload to your endpoint.
            </DialogDescription>
          </DialogHeader>

          {createdSecret ? (
            <div className="space-y-4 py-2">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg p-4">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">
                  ✅ Webhook created — save your signing secret now!
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
                  This secret is shown only once. Use it to verify webhook signatures.
                </p>
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-md border px-3 py-2">
                  <code className="text-xs font-mono flex-1 break-all">{createdSecret}</code>
                  <CopyButton value={createdSecret} />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Endpoint URL *</label>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://your-server.com/webhooks/nexus"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Events to Subscribe *</label>
                <div className="grid grid-cols-2 gap-2">
                  {WEBHOOK_EVENTS.map((event) => (
                    <label key={event.value} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedEvents.includes(event.value)}
                        onCheckedChange={() => toggleEvent(event.value)}
                      />
                      <span className="text-sm">{event.label}</span>
                    </label>
                  ))}
                </div>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => setSelectedEvents(WEBHOOK_EVENTS.map((e) => e.value))}
                >
                  Select all
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              {createdSecret ? "Close" : "Cancel"}
            </Button>
            {!createdSecret && (
              <Button
                onClick={handleCreate}
                disabled={creating || !url.trim() || selectedEvents.length === 0}
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create Webhook
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
