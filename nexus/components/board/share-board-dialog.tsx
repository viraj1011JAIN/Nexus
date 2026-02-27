"use client";

import { useState, useEffect } from "react";
import {
  Share2, Copy, Check, Globe, Loader2,
  ExternalLink, Trash2, Settings,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  getBoardShareLink,
  createBoardShareLink,
  revokeBoardShareLink,
  updateBoardShareSettings,
} from "@/actions/board-share-actions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShareData {
  id: string;
  token: string;
  isActive: boolean;
  allowComments: boolean;
  allowCopyCards: boolean;
  expiresAt?: Date | null;
  viewCount: number;
}

interface ShareBoardDialogProps {
  boardId: string;
  boardTitle: string;
  open: boolean;
  onClose: () => void;
}

// ─── ShareBoardDialog ─────────────────────────────────────────────────────────

export function ShareBoardDialog({ boardId, boardTitle, open, onClose }: ShareBoardDialogProps) {
  const [share, setShare] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [updating, setUpdating] = useState(false);

  const shareUrl = share
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/shared/${share.token}`
    : "";

  useEffect(() => {
    if (!open) return;
    loadShare();
  }, [open, boardId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadShare = async () => {
    setLoading(true);
    try {
      const result = await getBoardShareLink(boardId);
      if (result.data) setShare(result.data as unknown as ShareData);
      else setShare(null);
    } catch (e) {
      console.error("[LOAD_SHARE]", e);
      setShare(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const result = await createBoardShareLink({
        boardId,
        allowComments: false,
        allowCopyCards: false,
        expiresAt: expiresAt || undefined,
      });
      if (result.error) { toast.error(result.error); return; }
      setShare(result.data as unknown as ShareData);
      toast.success("Share link created!");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    setRevoking(true);
    try {
      const result = await revokeBoardShareLink(boardId);
      if (result.error) { toast.error(result.error); return; }
      setShare(null);
      toast.success("Share link revoked.");
    } finally {
      setRevoking(false);
    }
  };

  const handleToggle = async (field: "allowComments" | "allowCopyCards", value: boolean) => {
    if (!share || updating) return;
    setUpdating(true);
    const prev = share;
    setShare({ ...share, [field]: value });
    try {
      const result = await updateBoardShareSettings(share.id, { [field]: value });
      if (result.error) {
        setShare(prev);
        toast.error(result.error);
      }
    } catch (e) {
      console.error("[TOGGLE_SHARE_SETTING]", e);
      setShare(prev);
      toast.error("Failed to update settings.");
    } finally {
      setUpdating(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }).catch((e) => {
      console.error("[COPY_LINK]", e);
      setCopied(false);
      toast.error("Failed to copy link.");
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-indigo-500" />
            Share &ldquo;{boardTitle}&rdquo;
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !share ? (
            /* No share link yet */
            <div className="text-center space-y-4 py-4">
              <div className="h-14 w-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto">
                <Globe className="h-6 w-6 text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-medium">No public link yet</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Create a shareable read-only link for this board
                </p>
              </div>

              <div className="text-left space-y-2">
                <Label htmlFor="expires" className="text-xs text-muted-foreground">
                  Expire link on (optional)
                </Label>
                <Input
                  id="expires"
                  type="date"
                  className="h-8 text-sm"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>

              <Button onClick={handleCreate} disabled={creating} className="w-full">
                {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Globe className="h-4 w-4 mr-2" />}
                Create Share Link
              </Button>
            </div>
          ) : (
            /* Existing share link */
            <>
              {/* Link display */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active · {share.viewCount} view{share.viewCount !== 1 ? "s" : ""}
                  {share.expiresAt && (
                    <span className="text-muted-foreground ml-auto">
                      Expires {format(new Date(share.expiresAt), "MMM d, yyyy")}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={shareUrl}
                    className="h-8 text-xs font-mono bg-slate-50 dark:bg-slate-800"
                  />
                  <Button size="sm" variant="outline" className="h-8 px-2.5 flex-shrink-0" onClick={copyLink}>
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 px-2.5 flex-shrink-0" asChild>
                    <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Settings */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Settings className="h-3.5 w-3.5" />
                  Permissions
                </p>

                <div className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium">Allow comments</p>
                    <p className="text-xs text-muted-foreground">Viewers can leave comments on cards</p>
                  </div>
                  <Switch
                    checked={share.allowComments}
                    disabled={updating}
                    onCheckedChange={(v) => handleToggle("allowComments", v)}
                  />
                </div>

                <div className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium">Allow card copying</p>
                    <p className="text-xs text-muted-foreground">Viewers can copy cards to their boards</p>
                  </div>
                  <Switch
                    checked={share.allowCopyCards}
                    disabled={updating}
                    onCheckedChange={(v) => handleToggle("allowCopyCards", v)}
                  />
                </div>
              </div>

              <Separator />

              {/* Danger zone */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600">Revoke link</p>
                  <p className="text-xs text-muted-foreground">Existing link will stop working</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 gap-1.5"
                  onClick={handleRevoke}
                  disabled={revoking}
                >
                  {revoking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Revoke
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
