"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Key,
  Plus,
  Trash2,
  ShieldOff,
  Copy,
  Check,
  Eye,
  EyeOff,
  Loader2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  getApiKeys,
  createApiKey,
  revokeApiKey,
  deleteApiKey,
} from "@/actions/api-key-actions";
import { API_SCOPES } from "@/lib/api-key-constants";
import { format, isPast } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiKeyData {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt?: Date | string | null;
  expiresAt?: Date | string | null;
  revokedAt?: Date | string | null;
  createdAt: Date | string;
  user: { id: string; name: string };
}

interface CreatedKeyData {
  id: string;
  name: string;
  rawKey: string;
  keyPrefix: string;
  scopes: string[];
  expiresAt?: Date | string | null;
  createdAt: Date | string;
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

// ─── Key Row ──────────────────────────────────────────────────────────────────

function ApiKeyRow({
  apiKey,
  onRevoke,
  onDelete,
}: {
  apiKey: ApiKeyData;
  onRevoke: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const isRevoked = !!apiKey.revokedAt;
  const isExpired = apiKey.expiresAt ? isPast(new Date(apiKey.expiresAt)) : false;
  const isActive = !isRevoked && !isExpired;

  return (
    <div className={cn("border rounded-xl p-4 space-y-3", !isActive && "opacity-60")}>
      <div className="flex items-start gap-3">
        <Key className={cn("h-4 w-4 mt-0.5 flex-shrink-0", isActive ? "text-green-500" : "text-muted-foreground")} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{apiKey.name}</span>
            {isRevoked && <Badge variant="destructive" className="text-xs">Revoked</Badge>}
            {isExpired && !isRevoked && <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-300">Expired</Badge>}
            {isActive && <Badge variant="outline" className="text-xs text-green-600 border-green-300">Active</Badge>}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            <code className="font-mono">{apiKey.keyPrefix}••••••••</code>
            <span>Created {format(new Date(apiKey.createdAt), "MMM d, yyyy")}</span>
            {apiKey.lastUsedAt && (
              <span>Last used {format(new Date(apiKey.lastUsedAt), "MMM d, yyyy")}</span>
            )}
            {apiKey.expiresAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {isExpired ? "Expired" : "Expires"} {format(new Date(apiKey.expiresAt), "MMM d, yyyy")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Scopes */}
      <div className="flex flex-wrap gap-1.5 pl-7">
        {apiKey.scopes.map((s) => (
          <Badge key={s} variant="secondary" className="text-xs font-mono">{s}</Badge>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pl-7 pt-1">
        {isActive && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-yellow-700 border-yellow-300">
                <ShieldOff className="h-3 w-3" /> Revoke
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
                <AlertDialogDescription>
                  Revoking <strong>&ldquo;{apiKey.name}&rdquo;</strong> will immediately invalidate it.
                  Any integrations using this key will stop working.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90"
                  onClick={() => onRevoke(apiKey.id)}
                >
                  Revoke Key
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-destructive hover:text-destructive">
              <Trash2 className="h-3 w-3" /> Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete API Key</AlertDialogTitle>
              <AlertDialogDescription>
                Permanently delete <strong>&ldquo;{apiKey.name}&rdquo;</strong>?
                {isActive && " This will immediately revoke access."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                onClick={() => onDelete(apiKey.id)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ApiKeysSettings() {
  const [keys, setKeys] = useState<ApiKeyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState("");
  const [createdKey, setCreatedKey] = useState<CreatedKeyData | null>(null);
  const [showKey, setShowKey] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getApiKeys();
    if (result.data) setKeys(result.data as ApiKeyData[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!name.trim() || selectedScopes.length === 0) return;
    setCreating(true);
    try {
      const result = await createApiKey(
        name.trim(),
        selectedScopes,
        expiresAt ? new Date(expiresAt).toISOString() : undefined
      );
      if (result.error) { toast.error(result.error); return; }
      if (result.data) {
        setCreatedKey(result.data as CreatedKeyData);
        setName(""); setSelectedScopes([]); setExpiresAt("");
        await load();
      }
    } finally {
      setCreating(false);
    }
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const handleRevoke = async (id: string) => {
    const result = await revokeApiKey(id);
    if (result.error) { toast.error(result.error); return; }
    toast.success("API key revoked.");
    await load();
  };

  const handleDelete = async (id: string) => {
    const result = await deleteApiKey(id);
    if (result.error) { toast.error(result.error); return; }
    toast.success("API key deleted.");
    setKeys((prev) => prev.filter((k) => k.id !== id));
  };

  const activeKeys = keys.filter((k) => !k.revokedAt && (!k.expiresAt || !isPast(new Date(k.expiresAt))));
  const inactiveKeys = keys.filter((k) => k.revokedAt || (k.expiresAt && isPast(new Date(k.expiresAt))));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Key className="h-5 w-5 text-green-500" /> API Keys
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Generate keys to access the Nexus REST API from external applications.
          </p>
        </div>
        <Button onClick={() => { setShowCreate(true); setCreatedKey(null); }} className="gap-1">
          <Plus className="h-4 w-4" /> Generate Key
        </Button>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && keys.length === 0 && (
        <div className="text-center py-16 text-muted-foreground border rounded-xl">
          <Key className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No API keys yet.</p>
        </div>
      )}

      {!loading && (
        <div className="space-y-3">
          {activeKeys.map((k) => (
            <ApiKeyRow key={k.id} apiKey={k} onRevoke={handleRevoke} onDelete={handleDelete} />
          ))}
          {inactiveKeys.length > 0 && (
            <>
              <Separator />
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Revoked / Expired</p>
              {inactiveKeys.map((k) => (
                <ApiKeyRow key={k.id} apiKey={k} onRevoke={handleRevoke} onDelete={handleDelete} />
              ))}
            </>
          )}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={(v) => { setShowCreate(v); if (!v) { setCreatedKey(null); setShowKey(false); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate API Key</DialogTitle>
            <DialogDescription>
              API keys grant programmatic access to your organization&apos;s data.
            </DialogDescription>
          </DialogHeader>

          {createdKey ? (
            <div className="space-y-4 py-2">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg p-4">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4" /> Save your key — shown only once!
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
                  After closing this dialog, you&apos;ll only see the key prefix.
                </p>
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-md border px-3 py-2">
                  <code className={cn("text-xs font-mono flex-1 break-all", showKey ? "" : "blur-sm select-none")}>
                    {createdKey.rawKey}
                  </code>
                  <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => setShowKey((v) => !v)}>
                    {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </Button>
                  <CopyButton value={createdKey.rawKey} className="flex-shrink-0" />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Key Name *</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Integration"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Scopes *</label>
                <div className="space-y-2">
                  {API_SCOPES.map((scope) => (
                    <label key={scope.value} className="flex items-start gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedScopes.includes(scope.value)}
                        onCheckedChange={() => toggleScope(scope.value)}
                        className="mt-0.5"
                      />
                      <div>
                        <span className="text-sm font-medium">{scope.label}</span>
                        <p className="text-xs text-muted-foreground">{scope.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Expiry Date (optional)</label>
                <Input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setCreatedKey(null); }}>
              {createdKey ? "Close" : "Cancel"}
            </Button>
            {!createdKey && (
              <Button
                onClick={handleCreate}
                disabled={creating || !name.trim() || selectedScopes.length === 0}
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Generate Key
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
