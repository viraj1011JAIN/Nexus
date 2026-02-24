"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Globe, Eye, Lock, Calendar, Users, Flag, AlertTriangle,
  Copy, Check, ExternalLink, Share2, Layers
} from "lucide-react";
import { format, isPast, isToday, parseISO, isValid } from "date-fns";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SharedCard {
  id: string;
  title: string;
  priority?: string | null;
  dueDate?: Date | string | null;
  coverColor?: string | null;
  assignee?: { name: string; imageUrl?: string | null } | null;
  labels?: Array<{ label: { name: string; color: string } }>;
}

interface SharedList {
  id: string;
  title: string;
  cards: SharedCard[];
}

interface SharedBoard {
  id: string;
  title: string;
  imageFullUrl?: string | null;
  imageThumbUrl?: string | null;
  lists: SharedList[];
}

interface SharedBoardViewProps {
  board: SharedBoard;
  share: {
    id: string;
    allowComments: boolean;
    allowCopyCards: boolean;
    viewCount: number;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  URGENT: { label: "Urgent", color: "text-red-600", dot: "bg-red-500" },
  HIGH: { label: "High", color: "text-orange-500", dot: "bg-orange-500" },
  MEDIUM: { label: "Medium", color: "text-yellow-600", dot: "bg-yellow-400" },
  LOW: { label: "Low", color: "text-blue-500", dot: "bg-blue-400" },
  NONE: { label: "", color: "", dot: "bg-slate-300" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDate(d: Date | string | null | undefined): Date | null {
  if (!d) return null;
  const parsed = typeof d === "string" ? parseISO(d) : d;
  return isValid(parsed) ? parsed : null;
}

// ─── SharedCardTile ───────────────────────────────────────────────────────────

function SharedCardTile({ card }: { card: SharedCard }) {
  const dueDate = getDate(card.dueDate);
  const isOverdue = dueDate ? isPast(dueDate) && !isToday(dueDate) : false;
  const p = PRIORITY_CONFIG[card.priority ?? "NONE"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-lg border p-3 bg-white dark:bg-slate-800 shadow-sm",
        isOverdue && "border-red-200 dark:border-red-800",
        !isOverdue && (card.coverColor ? "" : "border-slate-200 dark:border-slate-700"),
      )}
      style={!isOverdue && card.coverColor ? { borderTopWidth: 3, borderTopColor: card.coverColor } : {}}
    >
      {/* Labels */}
      {card.labels && card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {card.labels.slice(0, 3).map((cl, i) => (
            <span
              key={i}
              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium text-white"
              style={{ backgroundColor: cl.label.color }}
            >
              {cl.label.name}
            </span>
          ))}
        </div>
      )}

      {/* Title */}
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-snug">
        {card.title}
      </p>

      {/* Footer */}
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        {card.priority && card.priority !== "NONE" && p && (
          <span className={cn("flex items-center gap-1 text-xs", p.color)}>
            <Flag className="h-2.5 w-2.5" />
            {p.label}
          </span>
        )}

        {dueDate && (
          <span className={cn(
            "flex items-center gap-1 text-xs",
            isOverdue ? "text-red-500 font-semibold" : "text-muted-foreground"
          )}>
            {isOverdue && <AlertTriangle className="h-2.5 w-2.5" />}
            <Calendar className="h-2.5 w-2.5" />
            {format(dueDate, "MMM d")}
          </span>
        )}

        {card.assignee && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
            {card.assignee.imageUrl ? (
              <Image src={card.assignee.imageUrl} alt={card.assignee.name} width={16} height={16} className="rounded-full" />
            ) : (
              <div className="h-4 w-4 rounded-full bg-indigo-200 flex items-center justify-center text-[9px] font-bold text-indigo-700">
                {card.assignee.name.trim().charAt(0).toUpperCase() || "?"}
              </div>
            )}
            <span className="truncate max-w-[60px]">{card.assignee.name}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── SharedBoardView ──────────────────────────────────────────────────────────

export function SharedBoardView({ board, share }: SharedBoardViewProps) {
  const [copied, setCopied] = useState(false);

  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  const copyLink = () => {
    navigator.clipboard.writeText(currentUrl).then(() => {
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    }).catch((e) => {
      console.error("[COPY_LINK]", e);
      toast.error("Failed to copy link.");
    });
  };

  const totalCards = board.lists.reduce((s, l) => s + l.cards.length, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <div
        className="relative h-36 flex items-end overflow-hidden"
        style={
          board.imageFullUrl
            ? { backgroundImage: `url(${board.imageFullUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
            : { background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }
        }
      >
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 px-8 pb-6 flex items-end justify-between w-full">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Globe className="h-3.5 w-3.5 text-white/70" />
              <span className="text-white/70 text-xs font-medium uppercase tracking-wide">Public Board</span>
            </div>
            <h1 className="text-2xl font-bold text-white">{board.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-white/80 text-xs bg-black/20 px-2.5 py-1 rounded-full">
              <Eye className="h-3 w-3" />
              {share.viewCount} views
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs gap-1.5 bg-white/20 hover:bg-white/30 text-white border-white/20"
              onClick={copyLink}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy link"}
            </Button>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-8 py-3">
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-indigo-500" />
            <span className="font-medium text-foreground">{board.lists.length}</span> lists
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-indigo-500" />
            <span className="font-medium text-foreground">{totalCards}</span> cards
          </span>
          <div className="ml-auto flex items-center gap-3 text-xs">
            {!share.allowComments && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Lock className="h-2.5 w-2.5" />
                Read-only
              </Badge>
            )}
            <span className="text-muted-foreground">
              Read-only view — sign up to collaborate
            </span>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" asChild>
              <a href="/">
                <ExternalLink className="h-3 w-3" />
                Open in Nexus
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Board lists */}
      <div className="p-8 overflow-x-auto">
        <div className="flex gap-5 min-w-max">
          {board.lists.map((list, i) => (
            <motion.div
              key={list.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="w-72 flex-shrink-0"
            >
              {/* List header */}
              <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {list.title}
                </h3>
                <Badge variant="secondary" className="text-xs px-1.5 h-5">
                  {list.cards.length}
                </Badge>
              </div>

              {/* Cards */}
              <div
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 p-2 space-y-2 min-h-[80px]"
              >
                {list.cards.map((card) => (
                  <SharedCardTile key={card.id} card={card} />
                ))}
                {list.cards.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-4 italic">
                    Empty list
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 dark:border-slate-700 py-6 text-center text-xs text-muted-foreground">
        <p>
          This board is shared publicly via{" "}
          <a href="/" className="text-indigo-500 hover:underline font-medium">Nexus</a>
          {" "}· Read-only view
        </p>
      </div>
    </div>
  );
}
