"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import NextImage from "next/image";
import dynamic from "next/dynamic";
import { Card, AuditLog, List, Label, Priority } from "@prisma/client";
import {
  X,
  MoreHorizontal,
  Copy,
  Trash2,
  MessageSquare,
  Clock,
  AlertCircle,
  FileText,
  Paperclip,
  Image as ImageIcon,
  CheckSquare,
  Timer,
  Link2,
  Settings2,
  Sparkles,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useUser, useOrganization } from "@clerk/nextjs";
import { format, isPast, differenceInHours } from "date-fns";

import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCardModal } from "@/hooks/use-card-modal";
import { getCard } from "@/actions/get-card";
import { updateCard } from "@/actions/update-card";
import { Activity } from "./activity";
import { getAuditLogs } from "@/actions/get-audit-logs";
import { RichTextEditor } from "@/components/rich-text-editor";
// Dynamic imports for components that directly import server actions.
// Static imports would pull server-action stub chunks into the client bundle;
// when Turbopack invalidates those stubs on HMR the factory becomes stale,
// producing "module factory is not available". Lazy-loading via next/dynamic
// ensures each HMR cycle resolves a fresh factory.
const LabelManager = dynamic(() =>
  import("@/components/label-manager").then((m) => ({ default: m.LabelManager }))
);
const AssigneePicker = dynamic(() =>
  import("@/components/assignee-picker").then((m) => ({ default: m.AssigneePicker }))
);
const TimeTrackingPanel = dynamic(() =>
  import("@/components/board/time-tracking-panel").then((m) => ({ default: m.TimeTrackingPanel }))
);
const CustomFieldsPanel = dynamic(() =>
  import("@/components/board/custom-fields-panel").then((m) => ({ default: m.CustomFieldsPanel }))
);
import { SmartDueDate } from "@/components/smart-due-date";
import { RichComments, type Comment } from "@/components/rich-comments";
import { CardCoverPicker } from "@/components/board/card-cover-picker";
const AttachmentsTab = dynamic(() =>
  import("./attachments").then((m) => ({ default: m.AttachmentsTab }))
);
const ChecklistsTab = dynamic(() =>
  import("./checklists").then((m) => ({ default: m.ChecklistsTab }))
);
const DependenciesTab = dynamic(() =>
  import("./dependencies").then((m) => ({ default: m.DependenciesTab }))
);
import { KeyboardShortcutsModal } from "@/components/keyboard-shortcuts-modal";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { getOrganizationLabels, getCardLabels } from "@/actions/label-actions";
import { getOrganizationMembers } from "@/actions/assignee-actions";
import { useTheme } from "@/components/theme-provider";

import { 
  updateCardPriority, 
  setDueDate, 
  clearDueDate,
  createComment,
  updateComment,
  deleteComment,
  addReaction,
  removeReaction 
} from "@/actions/phase3-actions";
import { generateCardDescription } from "@/actions/ai-actions";
import { ErrorBoundary } from "@/components/error-boundary-realtime";
import type { CardLabel } from "@/hooks/use-optimistic-card";

type CardWithRelations = Card & {
  list: List;
  assignee?: {
    id: string;
    name: string;
    imageUrl: string | null;
  } | null;
  checklists?: Array<{ items: Array<{ id: string; isComplete: boolean }> }>;
};

export const CardModal = () => {
  const params = useParams();
  
  const organizationId = params.organizationId as string;
  const boardId = params.boardId as string;

  const { membership } = useOrganization();
  
  const id = useCardModal((state) => state.id);
  const isOpen = useCardModal((state) => state.isOpen);
  const onClose = useCardModal((state) => state.onClose);

  const [cardData, setCardData] = useState<CardWithRelations | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [title, setTitle] = useState("");
  const [activeTab, setActiveTab] = useState("description");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [charCount, setCharCount] = useState(0);
  
  const [orgLabels, setOrgLabels] = useState<Label[]>([]);
  const [cardLabels, setCardLabels] = useState<CardLabel[]>([]);
  const [orgMembers, setOrgMembers] = useState<Array<{ id: string; name: string; imageUrl: string | null; email: string }>>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachmentCount, setAttachmentCount] = useState(0);
  const [priorityOpen, setPriorityOpen] = useState(false);

  // AI state (TASK-022)
  const [aiDescLoading, setAiDescLoading] = useState(false);

  // Refs for keyboard-shortcut-triggered picker opens (TASK-016)
  const labelWrapperRef = useRef<HTMLDivElement>(null);
  const assigneeWrapperRef = useRef<HTMLDivElement>(null);
  const dueDateWrapperRef = useRef<HTMLDivElement>(null);

  const { user } = useUser();
  const titleInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (id && isOpen) {
      const fetchData = async () => {
        const card = await getCard(id);
        if (card) {
          setCardData(card as unknown as CardWithRelations);
          setTitle(card.title);
          setCharCount(card.description?.length || 0);
          
          if (organizationId) {
            const [labels, cardLabelsList, members] = await Promise.all([
              getOrganizationLabels(),
              getCardLabels(id),
              getOrganizationMembers(),
            ]);
            
            setOrgLabels(labels);
            setCardLabels(cardLabelsList);
            setOrgMembers(members);
          }
        }

        const logs = await getAuditLogs(id);
        setAuditLogs(logs);
      };
      fetchData();
    }
  }, [id, isOpen, organizationId]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const onSaveTitle = async () => {
    if (!cardData) return;
    if (title.trim() === cardData.title.trim()) {
      setIsEditingTitle(false);
      return;
    }

    const result = await updateCard({
      boardId: boardId,
      id: cardData.id,
      title: title
    });
    
    if (result.error) {
      toast.error(result.error);
      setTitle(cardData.title);
    } else {
      setCardData({ ...cardData, title });
      toast.success("Title updated");
    }
    setIsEditingTitle(false);
  };

  const handleSaveDescription = async (html: string) => {
    if (!cardData) return;

    setSaveStatus("saving");
    const result = await updateCard({
      boardId: boardId,
      id: cardData.id,
      description: html
    });

    if (result.error) {
      setSaveStatus("error");
      throw new Error(result.error);
    }

    setCardData({ ...cardData, description: html });
    setCharCount(html.length);
    setSaveStatus("saved");
  };

  const refreshCardData = async () => {
    if (!id) return;
    
    const [card, logs, cardLabelsList] = await Promise.all([
      getCard(id),
      getAuditLogs(id),
      getCardLabels(id),
    ]);
    
    if (card) {
      setCardData(card as unknown as CardWithRelations);
      setAuditLogs(logs);
      setCardLabels(cardLabelsList);
    }
  };

  const handleGenerateDescription = async () => {
    if (!cardData) return;
    // Confirm before overwriting a non-empty existing description.
    if (cardData.description?.trim()) {
      const confirmed = window.confirm(
        "This will replace the current description with AI-generated content. Continue?"
      );
      if (!confirmed) return;
    }
    setAiDescLoading(true);
    try {
      const result = await generateCardDescription({
        title: cardData.title,
        context: cardData.list?.title,
      });
      if (result.error) { toast.error(result.error); return; }
      if (result.data?.description) {
        await handleSaveDescription(result.data.description);
        toast.success("Description generated");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate description");
    } finally {
      setAiDescLoading(false);
    }
  };

  const handlePriorityChange = async (priority: Priority) => {
    if (!cardData) return;
    
    const result = await updateCardPriority({
      id: cardData.id,
      boardId: boardId,
      priority,
      autoEscalated: false,
    });

    if (result.error) {
      toast.error(result.error);
      return;
    }

    setCardData({ ...cardData, priority });
    toast.success("Priority updated");
  };

  const handleDueDateChange = async (date: Date | null) => {
    if (!cardData) return;

    if (date) {
      const result = await setDueDate({
        id: cardData.id,
        boardId: boardId,
        dueDate: date.toISOString(),
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setCardData({ ...cardData, dueDate: date });
      toast.success("Due date set");
    } else {
      const result = await clearDueDate({
        id: cardData.id,
        boardId: boardId,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setCardData({ ...cardData, dueDate: null });
      toast.success("Due date cleared");
    }
  };

  const handleCoverChange = async (type: "color" | "image" | "none", value: string | null) => {
    if (!cardData) return;

    const update =
      type === "color"
        ? { coverColor: value, coverImageUrl: null }
        : type === "image"
        ? { coverImageUrl: value, coverColor: null }
        : { coverColor: null, coverImageUrl: null };

    const result = await updateCard({ boardId, id: cardData.id, ...update });

    if (result.error) {
      toast.error(result.error);
      return;
    }

    setCardData({ ...cardData, ...update });
    if (type === "none") toast.success("Cover removed");
  };

  const handleCreateComment = async (text: string, parentId: string | null = null) => {
    if (!cardData || !user) return;

    const result = await createComment({
      cardId: cardData.id,
      boardId: boardId,
      text,
      parentId,
      mentions: [],
      isDraft: false,
    });

    if (result.error) {
      toast.error(result.error);
      return;
    }

    if (result.data) {
      setComments((prev) => [...prev, result.data as Comment]);
    }
  };

  const handleUpdateComment = async (commentId: string, text: string) => {
    if (!cardData) return;

    const result = await updateComment({
      id: commentId,
      boardId: boardId,
      text,
    });

    if (result.error) {
      toast.error(result.error);
      return;
    }

    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, text } : c))
    );
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!cardData) return;

    const result = await deleteComment({
      id: commentId,
      boardId: boardId,
    });

    if (result.error) {
      toast.error(result.error);
      return;
    }

    setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  const handleAddReaction = async (commentId: string, emoji: string) => {
    if (!cardData || !user) return;

    const result = await addReaction({
      commentId,
      boardId: boardId,
      emoji,
    });

    if (result.error) {
      toast.error(result.error);
      return;
    }

    if (result.data) {
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? { ...c, reactions: [...c.reactions, result.data as any] }
            : c
        )
      );
    }
  };

  const handleRemoveReaction = async (reactionId: string) => {
    if (!cardData) return;

    const result = await removeReaction({
      id: reactionId,
      boardId: boardId,
    });

    if (result.error) {
      toast.error(result.error);
      return;
    }

    setComments((prev) =>
      prev.map((c) => ({
        ...c,
        reactions: c.reactions.filter((r) => r.id !== reactionId),
      }))
    );
  };

  // ── Card modal keyboard shortcuts (TASK-016) ──────────────────────────────
  // Shortcuts are only active while this modal is open and card data is loaded.
  const cardModalShortcuts = useMemo(() => {
    if (!isOpen || !cardData) return [];
    return [
      { key: "p", description: "Set priority",         action: () => setPriorityOpen(true),                                          ignoreInInput: true },
      { key: "l", description: "Open label picker",    action: () => labelWrapperRef.current?.querySelector<HTMLElement>("button")?.click(),    ignoreInInput: true },
      { key: "a", description: "Open assignee picker", action: () => assigneeWrapperRef.current?.querySelector<HTMLElement>("button")?.click(), ignoreInInput: true },
      { key: "d", description: "Open due date picker", action: () => dueDateWrapperRef.current?.querySelector<HTMLElement>("button")?.click(),  ignoreInInput: true },
    ];
  }, [isOpen, cardData]);
  useKeyboardShortcuts(cardModalShortcuts);

  // ── theme tokens ─────────────────────────────────────────────────────────
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted && resolvedTheme === "dark";

  const priorityMeta: Record<string, {
    label: string; dotDark: string; dotLight: string;
    bgDark: string; bgLight: string; borderDark: string; borderLight: string;
  }> = {
    URGENT: { label:"Urgent",  dotDark:"#FF4365", dotLight:"#EF4444", bgDark:"rgba(255,67,101,0.12)",   bgLight:"rgba(239,68,68,0.08)",   borderDark:"rgba(255,67,101,0.3)",  borderLight:"rgba(239,68,68,0.25)" },
    HIGH:   { label:"High",    dotDark:"#FF8C42", dotLight:"#F59E0B", bgDark:"rgba(255,140,66,0.12)",   bgLight:"rgba(245,158,11,0.08)",   borderDark:"rgba(255,140,66,0.3)",  borderLight:"rgba(245,158,11,0.25)" },
    MEDIUM: { label:"Medium",  dotDark:"#F5C518", dotLight:"#06B6D4", bgDark:"rgba(245,197,24,0.12)",   bgLight:"rgba(6,182,212,0.08)",    borderDark:"rgba(245,197,24,0.3)",  borderLight:"rgba(6,182,212,0.25)" },
    LOW:    { label:"Low",     dotDark:"#4FFFB0", dotLight:"#10B981", bgDark:"rgba(79,255,176,0.12)",   bgLight:"rgba(16,185,129,0.08)",   borderDark:"rgba(79,255,176,0.3)",  borderLight:"rgba(16,185,129,0.25)" },
  };

  const T = isDark ? {
    modal:        "#13121C",
    surface:      "rgba(255,255,255,0.04)",
    surfaceHover: "rgba(255,255,255,0.07)",
    border:       "rgba(255,255,255,0.08)",
    borderMed:    "rgba(255,255,255,0.13)",
    text:         "#F1EEF8",
    textMid:      "rgba(255,255,255,0.62)",
    textMuted:    "rgba(255,255,255,0.32)",
    tabActive:    "rgba(123,47,247,0.15)",
    tabActiveTxt: "#C084FC",
    inputBg:      "rgba(255,255,255,0.05)",
    divider:      "rgba(255,255,255,0.07)",
    sidebarBg:    "rgba(255,255,255,0.02)",
    metaLabel:    "rgba(255,255,255,0.35)",
    badgeBg:      "rgba(255,255,255,0.08)",
    scrollbar:    "rgba(255,255,255,0.1)",
    coverOverlay: "linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(13,12,20,0.82) 100%)",
  } : {
    modal:        "#FFFDF9",
    surface:      "rgba(0,0,0,0.03)",
    surfaceHover: "rgba(0,0,0,0.055)",
    border:       "rgba(0,0,0,0.07)",
    borderMed:    "rgba(0,0,0,0.13)",
    text:         "#0F0D0B",
    textMid:      "#5A5550",
    textMuted:    "#9A8F85",
    tabActive:    "rgba(123,47,247,0.08)",
    tabActiveTxt: "#7B2FF7",
    inputBg:      "rgba(0,0,0,0.03)",
    divider:      "rgba(0,0,0,0.07)",
    sidebarBg:    "rgba(0,0,0,0.014)",
    metaLabel:    "#9A8F85",
    badgeBg:      "rgba(0,0,0,0.05)",
    scrollbar:    "rgba(0,0,0,0.1)",
    coverOverlay: "linear-gradient(to bottom, rgba(0,0,0,0.06) 0%, rgba(255,253,249,0.75) 100%)",
  };

  const TABS = [
    { id:"description", label:"Description", icon:<FileText className="h-3.5 w-3.5" /> },
    { id:"activity",    label:"Activity",    icon:<MessageSquare className="h-3.5 w-3.5" />, badge: auditLogs.length || null },
    { id:"comments",    label:"Comments",    icon:<MessageSquare className="h-3.5 w-3.5" />, badge: comments.length || null },
    { id:"attachments", label:"Files",       icon:<Paperclip className="h-3.5 w-3.5" />,     badge: attachmentCount || null },
    { id:"checklists",  label:"Checklist",   icon:<CheckSquare className="h-3.5 w-3.5" /> },
    { id:"time",        label:"Time",        icon:<Timer className="h-3.5 w-3.5" /> },
    { id:"dependencies",label:"Links",       icon:<Link2 className="h-3.5 w-3.5" /> },
    { id:"fields",      label:"Fields",      icon:<Settings2 className="h-3.5 w-3.5" /> },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="p-0 gap-0 border-none overflow-hidden"
        style={{
          width: "min(1080px, 95vw)",
          maxHeight: "90vh",
          background: T.modal,
          borderRadius: 20,
          boxShadow: isDark
            ? "0 32px 80px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.05)"
            : "0 32px 80px rgba(0,0,0,0.14), 0 8px 32px rgba(0,0,0,0.07)",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@600;700;800&display=swap');
          .cm-scrollbar::-webkit-scrollbar { width:4px; height:4px; }
          .cm-scrollbar::-webkit-scrollbar-thumb { background:${T.scrollbar}; border-radius:4px; }
          .cm-scrollbar::-webkit-scrollbar-track { background:transparent; }
          .cm-tab-scroll::-webkit-scrollbar { height:0; }
          .cm-meta-row { transition:background 0.13s ease; border-radius:9px; }
          .cm-meta-row:hover { background:${T.surfaceHover}; }
          .cm-action-btn { transition:background 0.15s ease,border-color 0.15s ease; }
          .cm-action-btn:hover { background:${T.surfaceHover} !important; }
          @keyframes cmModalIn {
            from { opacity:0; transform:scale(0.97) translateY(10px); }
            to   { opacity:1; transform:scale(1) translateY(0); }
          }
          @keyframes cmFadeUp {
            from { opacity:0; transform:translateY(7px); }
            to   { opacity:1; transform:translateY(0); }
          }
          .cm-anim-modal { animation: cmModalIn 0.28s cubic-bezier(0.34,1.15,0.64,1) both; }
          .cm-anim-fade  { animation: cmFadeUp 0.22s ease both; }
        `}</style>

        <DialogTitle className="sr-only">Card Details</DialogTitle>

        {/* ── LOADING ── */}
        {!cardData ? (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", minHeight:360 }}>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
              <div style={{ width:34, height:34, borderRadius:"50%", border:"3px solid #7B2FF7", borderTopColor:"transparent", animation:"spin 0.8s linear infinite" }} />
              <p style={{ fontSize:13, color:T.textMuted }}>Loading card…</p>
            </div>
          </div>
        ) : (
          <div className="cm-anim-modal" style={{ display:"flex", flexDirection:"column", height:"100%", maxHeight:"90vh", overflow:"hidden" }}>

            {/* ══ COVER ══ */}
            <div style={{ position:"relative", height:148, flexShrink:0, overflow:"hidden" }}>
              {(cardData.coverImageUrl || cardData.coverColor) ? (
                <>
                  {cardData.coverImageUrl
                    ? <NextImage src={cardData.coverImageUrl} alt="" width={600} height={148} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
                    : <div style={{ width:"100%", height:"100%", background: cardData.coverColor ?? "#7B2FF7" }} />
                  }
                  <div style={{ position:"absolute", inset:0, background: T.coverOverlay }} />
                </>
              ) : (
                <div style={{
                  width:"100%", height:"100%",
                  background: isDark
                    ? "linear-gradient(135deg,#1a0533 0%,#0D0C14 60%,#071422 100%)"
                    : "linear-gradient(135deg,#f4f1fd 0%,#fffdf9 60%,#f0f7ff 100%)",
                  borderBottom:`1px solid ${T.divider}`,
                }}/>
              )}

              {/* Breadcrumb */}
              <div style={{ position:"absolute", bottom:12, left:18, display:"flex", alignItems:"center", gap:5 }}>
                <span style={{ fontSize:11, color: cardData.coverImageUrl ? "rgba(255,255,255,0.55)" : T.textMuted }}>{cardData.list?.title ?? "Board"}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke={cardData.coverImageUrl ? "rgba(255,255,255,0.4)" : T.textMuted} strokeWidth="2" width="10" height="10"><polyline points="9 18 15 12 9 6"/></svg>
                <span style={{
                  fontSize:10.5, fontWeight:600,
                  color: cardData.coverImageUrl ? "rgba(255,255,255,0.8)" : T.textMid,
                  background: cardData.coverImageUrl ? "rgba(0,0,0,0.28)" : T.surface,
                  backdropFilter:"blur(8px)", padding:"2px 8px", borderRadius:20,
                  border:`1px solid ${cardData.coverImageUrl ? "rgba(255,255,255,0.15)" : T.border}`,
                }}>#{cardData.id.slice(-8)}</span>
              </div>

              {/* Priority pill */}
              {cardData.priority && (() => {
                const pm = priorityMeta[cardData.priority];
                const dot = isDark ? pm.dotDark : pm.dotLight;
                return (
                  <div style={{
                    position:"absolute", top:12, left:18,
                    display:"flex", alignItems:"center", gap:5,
                    padding:"4px 10px", borderRadius:20,
                    background: cardData.coverImageUrl ? "rgba(0,0,0,0.32)" : isDark ? pm.bgDark : pm.bgLight,
                    backdropFilter:"blur(10px)",
                    border:`1px solid ${cardData.coverImageUrl ? "rgba(255,255,255,0.15)" : isDark ? pm.borderDark : pm.borderLight}`,
                  }}>
                    <div style={{ width:6, height:6, borderRadius:"50%", background:dot, boxShadow:`0 0 6px ${dot}55` }}/>
                    <span style={{ fontSize:10.5, fontWeight:700, color: cardData.coverImageUrl ? "rgba(255,255,255,0.9)" : dot, letterSpacing:"0.04em", textTransform:"uppercase" }}>
                      {pm.label}
                    </span>
                  </div>
                );
              })()}

              {/* Close */}
              <DialogClose asChild>
                <button style={{
                  position:"absolute", top:10, right:12,
                  width:30, height:30, borderRadius:9,
                  background: cardData.coverImageUrl ? "rgba(0,0,0,0.38)" : T.surface,
                  backdropFilter:"blur(8px)",
                  border:`1px solid ${cardData.coverImageUrl ? "rgba(255,255,255,0.15)" : T.border}`,
                  color: cardData.coverImageUrl ? "rgba(255,255,255,0.75)" : T.textMid,
                  display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer",
                  transition:"background 0.15s ease",
                }}>
                  <X className="h-3.5 w-3.5"/>
                </button>
              </DialogClose>
            </div>

            {/* ══ TWO-COLUMN BODY ══ */}
            <div style={{ display:"flex", flex:1, minHeight:0, overflow:"hidden" }}>

              {/* ── LEFT PANEL ── */}
              <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", borderRight:`1px solid ${T.divider}`, overflow:"hidden" }}>

                {/* Title + meta + action bar + tabs — static header */}
                <div style={{ padding:"18px 22px 0", flexShrink:0 }}>

                  {/* Title */}
                  {isEditingTitle ? (
                    <textarea
                      ref={titleInputRef}
                      aria-label="Card title"
                      value={title}
                      onChange={e => { setTitle(e.target.value); e.currentTarget.style.height="auto"; e.currentTarget.style.height=e.currentTarget.scrollHeight+"px"; }}
                      onBlur={onSaveTitle}
                      onKeyDown={e => {
                        if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); onSaveTitle(); }
                        if (e.key==="Escape") { setTitle(cardData.title); setIsEditingTitle(false); }
                      }}
                      rows={1}
                      style={{
                        width:"100%", background:"transparent",
                        border:`1px solid rgba(123,47,247,0.45)`, borderRadius:9,
                        padding:"4px 8px", color:T.text, fontSize:21, fontWeight:700,
                        fontFamily:"'Playfair Display', serif",
                        letterSpacing:"-0.02em", lineHeight:1.3, resize:"none", minHeight:48,
                        boxShadow:"0 0 0 3px rgba(123,47,247,0.1)", outline:"none",
                      }}
                    />
                  ) : (
                    <h1
                      onClick={() => setIsEditingTitle(true)}
                      style={{
                        fontSize:21, fontWeight:700,
                        fontFamily:"'Playfair Display', serif",
                        letterSpacing:"-0.02em", lineHeight:1.3,
                        color:T.text, cursor:"text",
                        padding:"4px 8px 4px 0", borderRadius:9,
                        transition:"background 0.13s ease",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background=T.surfaceHover}
                      onMouseLeave={e => e.currentTarget.style.background="transparent"}
                    >{title}</h1>
                  )}

                  {/* Dates */}
                  <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:6, paddingLeft:1 }}>
                    <Clock className="h-3 w-3" style={{ color:T.textMuted }} />
                    <span style={{ fontSize:11, color:T.textMuted }}>
                      Created {new Date(cardData.createdAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                    </span>
                    <span style={{ color:T.textMuted, fontSize:10 }}>·</span>
                    <span style={{ fontSize:11, color:T.textMuted }}>
                      Updated {new Date(cardData.updatedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                    </span>
                  </div>

                  {/* Action bar */}
                  <div style={{
                    display:"flex", alignItems:"center", gap:6, marginTop:12,
                    paddingBottom:12, borderBottom:`1px solid ${T.divider}`,
                    flexWrap:"wrap",
                  }}>
                    {/* Labels */}
                    <div ref={labelWrapperRef} style={{ display:"contents" }}>
                      <ErrorBoundary fallback={
                        <button style={{ padding:"5px 11px", borderRadius:8, border:`1px solid ${T.border}`, background:T.surface, color:T.textMid, fontSize:12, cursor:"not-allowed", fontFamily:"inherit" }}>Labels</button>
                      }>
                        <LabelManager cardId={cardData.id} orgId={organizationId} availableLabels={orgLabels} cardLabels={cardLabels} onLabelsChange={refreshCardData} />
                      </ErrorBoundary>
                    </div>

                    {/* Assignee */}
                    <div ref={assigneeWrapperRef} style={{ display:"contents" }}>
                      <ErrorBoundary fallback={
                        <button style={{ padding:"5px 11px", borderRadius:8, border:`1px solid ${T.border}`, background:T.surface, color:T.textMid, fontSize:12, cursor:"not-allowed", fontFamily:"inherit" }}>Assign</button>
                      }>
                        <AssigneePicker cardId={cardData.id} orgId={organizationId} currentAssignee={cardData.assignee || null} availableUsers={orgMembers} onAssigneeChange={refreshCardData} />
                      </ErrorBoundary>
                    </div>

                    {/* Due date */}
                    <div ref={dueDateWrapperRef} style={{ display:"contents" }}>
                      <ErrorBoundary fallback={
                        <button style={{ padding:"5px 11px", borderRadius:8, border:`1px solid ${T.border}`, background:T.surface, color:T.textMid, fontSize:12, cursor:"not-allowed", fontFamily:"inherit" }}>Due date</button>
                      }>
                        <SmartDueDate dueDate={cardData.dueDate} onDateChange={handleDueDateChange} priority={cardData.priority} animated editable />
                      </ErrorBoundary>
                    </div>

                    {/* Cover picker */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="cm-action-btn" style={{
                          display:"flex", alignItems:"center", gap:5,
                          padding:"5px 11px", borderRadius:8,
                          border:`1px solid ${(cardData.coverColor || cardData.coverImageUrl) ? "rgba(123,47,247,0.35)" : T.border}`,
                          background: (cardData.coverColor || cardData.coverImageUrl) ? "rgba(123,47,247,0.1)" : T.surface,
                          color: (cardData.coverColor || cardData.coverImageUrl) ? "#A78BFA" : T.textMid,
                          fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"inherit",
                        }}>
                          <ImageIcon className="h-3 w-3" />
                          Cover
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-4" align="start">
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-3">Card Cover</p>
                        <CardCoverPicker currentColor={cardData.coverColor} currentImage={cardData.coverImageUrl} onSelect={handleCoverChange} />
                      </PopoverContent>
                    </Popover>

                    {/* More */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="cm-action-btn" style={{
                          display:"flex", alignItems:"center", justifyContent:"center",
                          width:30, height:30, borderRadius:8,
                          border:`1px solid ${T.border}`, background:T.surface,
                          color:T.textMid, cursor:"pointer",
                        }}>
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied"); }} className="cursor-pointer">
                          <Copy className="h-4 w-4 mr-2" /> Copy link
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600 cursor-pointer">
                          <Trash2 className="h-4 w-4 mr-2" /> Delete card
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Tabs */}
                  <div className="cm-tab-scroll" style={{ display:"flex", gap:1, marginTop:2, overflowX:"auto", paddingBottom:0 }}>
                    {TABS.map(tab => {
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          style={{
                            display:"flex", alignItems:"center", gap:5,
                            padding:"9px 11px", borderRadius:"9px 9px 0 0",
                            border:"none", cursor:"pointer", fontFamily:"inherit",
                            background: isActive ? T.tabActive : "transparent",
                            color: isActive ? T.tabActiveTxt : T.textMuted,
                            fontSize:12, fontWeight: isActive ? 600 : 400,
                            whiteSpace:"nowrap", position:"relative",
                            transition:"color 0.13s ease, background 0.13s ease",
                          }}
                        >
                          {tab.icon}
                          {tab.label}
                          {(tab.badge ?? 0) > 0 && (
                            <span style={{
                              fontSize:9, fontWeight:700, padding:"1px 5px", borderRadius:20,
                              background: isActive ? "rgba(123,47,247,0.25)" : T.badgeBg,
                              color: isActive ? T.tabActiveTxt : T.textMuted,
                            }}>{tab.badge}</span>
                          )}
                          {isActive && (
                            <div style={{
                              position:"absolute", bottom:0, left:"50%", transform:"translateX(-50%)",
                              width:"55%", height:2,
                              background:"linear-gradient(90deg,#7B2FF7,#C01CC4)", borderRadius:4,
                            }}/>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ height:1, background:T.divider }} />
                </div>

                {/* ── SCROLLABLE TAB CONTENT ── */}
                <div className="cm-scrollbar" style={{ flex:1, overflowY:"auto", padding:"18px 22px 24px" }}>

                  {/* DESCRIPTION */}
                  {activeTab === "description" && (
                    <div className="cm-anim-fade">
                      <ErrorBoundary fallback={
                        <div style={{ padding:20, textAlign:"center", background:"rgba(239,68,68,0.05)", borderRadius:12, border:"1px solid rgba(239,68,68,0.15)" }}>
                          <AlertCircle className="h-7 w-7 mx-auto mb-2" style={{ color:"#EF4444" }} />
                          <p style={{ fontSize:12, color:"#EF4444" }}>Editor unavailable. Refresh to try again.</p>
                        </div>
                      }>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                          <span style={{ fontSize:12, fontWeight:600, color:T.textMid }}>Description</span>
                          <button
                            onClick={handleGenerateDescription}
                            disabled={aiDescLoading}
                            style={{
                              display:"flex", alignItems:"center", gap:5,
                              padding:"4px 10px", borderRadius:20,
                              background:"rgba(123,47,247,0.1)", border:"1px solid rgba(123,47,247,0.2)",
                              color:"#A78BFA", fontSize:11.5, fontWeight:600, cursor:"pointer", fontFamily:"inherit",
                              opacity: aiDescLoading ? 0.6 : 1,
                            }}
                          >
                            {aiDescLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                            {aiDescLoading ? "Generating…" : "AI Generate"}
                          </button>
                        </div>
                        <div style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#fff", borderRadius:12, border:`1px solid ${T.border}`, overflow:"hidden" }}>
                          <RichTextEditor
                            content={cardData.description || ""}
                            onSave={handleSaveDescription}
                            placeholder="Add a detailed description…"
                            editable
                            minHeight="180px"
                            showToolbar
                            enableAutoSave
                            characterLimit={10000}
                          />
                        </div>
                        {!cardData.description && (
                          <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:8, paddingLeft:2 }}>
                            <span style={{ fontSize:11, color:T.textMuted }}>💡 Tip: Type</span>
                            <kbd style={{ padding:"1px 6px", background:T.surface, border:`1px solid ${T.border}`, borderRadius:5, fontSize:11, color:T.textMid, fontFamily:"monospace" }}>/</kbd>
                            <span style={{ fontSize:11, color:T.textMuted }}>for commands</span>
                          </div>
                        )}
                      </ErrorBoundary>
                    </div>
                  )}

                  {/* ACTIVITY */}
                  {activeTab === "activity" && (
                    <div className="cm-anim-fade">
                      {/* Section header */}
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
                        <MessageSquare className="h-3.5 w-3.5" style={{ color:T.textMuted }} />
                        <span style={{ fontSize:12.5, fontWeight:600, color:T.text }}>Audit Log</span>
                        <span style={{ fontSize:9.5, fontWeight:700, padding:"1px 6px", borderRadius:20, background:T.badgeBg, color:T.textMuted }}>{auditLogs.length}</span>
                      </div>
                      <Activity items={auditLogs} />
                    </div>
                  )}

                  {/* COMMENTS */}
                  {activeTab === "comments" && (
                    <div className="cm-anim-fade">
                      {/* Section header */}
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
                        <MessageSquare className="h-3.5 w-3.5" style={{ color:T.textMuted }} />
                        <span style={{ fontSize:12.5, fontWeight:600, color:T.text }}>Comments</span>
                        {comments.length > 0 && (
                          <span style={{ fontSize:9.5, fontWeight:700, padding:"1px 6px", borderRadius:20, background:T.badgeBg, color:T.textMuted }}>{comments.length}</span>
                        )}
                      </div>

                      <ErrorBoundary fallback={
                        <div style={{ padding:20, textAlign:"center", background:"rgba(239,68,68,0.05)", borderRadius:12, border:"1px solid rgba(239,68,68,0.15)" }}>
                          <AlertCircle className="h-7 w-7 mx-auto mb-2" style={{ color:"#EF4444" }} />
                          <p style={{ fontSize:12, color:"#EF4444" }}>Comments unavailable. Refresh to try again.</p>
                        </div>
                      }>
                        {/* Wrapper applies the card-modal surface + scroll */}
                        <div style={{
                          background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)",
                          border:`1px solid ${T.border}`, borderRadius:14,
                          overflow:"hidden",
                          display:"flex", flexDirection:"column",
                        }}>
                          {user ? (
                            <RichComments
                              cardId={cardData.id}
                              comments={comments}
                              currentUserId={user.id}
                              currentUserName={user.fullName || user.username || "Unknown"}
                              currentUserImage={user.imageUrl || null}
                              onCreateComment={handleCreateComment}
                              onUpdateComment={handleUpdateComment}
                              onDeleteComment={handleDeleteComment}
                              onAddReaction={handleAddReaction}
                              onRemoveReaction={handleRemoveReaction}
                              typingUsers={[]}
                              editable
                              listMaxHeight="340px"
                            />
                          ) : (
                            <div style={{ padding:24, textAlign:"center" }}>
                              <p style={{ fontSize:12, color:T.textMuted }}>Sign in to view comments.</p>
                            </div>
                          )}
                        </div>
                      </ErrorBoundary>
                    </div>
                  )}

                  {/* ATTACHMENTS */}
                  {activeTab === "attachments" && (
                    <div className="cm-anim-fade">
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
                        <Paperclip className="h-3.5 w-3.5" style={{ color:T.textMuted }} />
                        <span style={{ fontSize:12.5, fontWeight:600, color:T.text }}>Files</span>
                        {attachmentCount > 0 && <span style={{ fontSize:9.5, fontWeight:700, padding:"1px 6px", borderRadius:20, background:T.badgeBg, color:T.textMuted }}>{attachmentCount}</span>}
                      </div>
                      <AttachmentsTab cardId={cardData.id} boardId={boardId} onCountChange={setAttachmentCount} />
                    </div>
                  )}

                  {/* CHECKLISTS */}
                  {activeTab === "checklists" && (
                    <div className="cm-anim-fade">
                      <ChecklistsTab cardId={cardData.id} boardId={boardId} cardTitle={cardData.title} />
                    </div>
                  )}

                  {/* TIME */}
                  {activeTab === "time" && (
                    <div className="cm-anim-fade">
                      <ErrorBoundary fallback={<p style={{ fontSize:12, color:T.textMuted }}>Unable to load time tracking.</p>}>
                        <TimeTrackingPanel cardId={cardData.id} currentUserId={user?.id} />
                      </ErrorBoundary>
                    </div>
                  )}

                  {/* DEPENDENCIES / LINKS */}
                  {activeTab === "dependencies" && (
                    <div className="cm-anim-fade">
                      <DependenciesTab cardId={cardData.id} boardId={boardId} />
                    </div>
                  )}

                  {/* CUSTOM FIELDS */}
                  {activeTab === "fields" && (
                    <div className="cm-anim-fade">
                      <ErrorBoundary fallback={<p style={{ fontSize:12, color:T.textMuted }}>Unable to load custom fields.</p>}>
                        <CustomFieldsPanel boardId={boardId} cardId={cardData.id} isAdmin={membership?.role === "org:admin"} />
                      </ErrorBoundary>
                    </div>
                  )}
                </div>

                {/* ── MODAL FOOTER ── */}
                <div style={{
                  flexShrink:0, borderTop:`1px solid ${T.divider}`,
                  padding:"9px 22px", display:"flex", alignItems:"center", justifyContent:"space-between",
                }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <span style={{ fontSize:11, color:T.textMuted }}>{charCount.toLocaleString()} / 10,000 chars</span>
                    <KeyboardShortcutsModal />
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    {saveStatus === "saving" && (
                      <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:T.textMid }}>
                        <div style={{ width:6, height:6, borderRadius:"50%", background:"#60A5FA", animation:"cmPulse 1s ease-in-out infinite" }}/>
                        Saving…
                      </div>
                    )}
                    {saveStatus === "saved" && (
                      <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, fontWeight:600, color:"#10B981" }}>
                        <div style={{ width:6, height:6, borderRadius:"50%", background:"#10B981" }}/>
                        All changes saved
                      </div>
                    )}
                    {saveStatus === "error" && (
                      <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, fontWeight:600, color:"#EF4444" }}>
                        <div style={{ width:6, height:6, borderRadius:"50%", background:"#EF4444" }}/>
                        Failed to save
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── RIGHT SIDEBAR ── */}
              <div
                className="cm-scrollbar"
                style={{
                  width:228, flexShrink:0,
                  background:T.sidebarBg, borderLeft:`1px solid ${T.divider}`,
                  overflowY:"auto", display:"flex", flexDirection:"column",
                }}
              >
                <div style={{ padding:"18px 14px", display:"flex", flexDirection:"column", gap:0 }}>

                  {/* ─ DETAILS ─ */}
                  <p style={{ fontSize:9, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:T.metaLabel, marginBottom:8, paddingLeft:8 }}>Details</p>

                  {/* Priority */}
                  {cardData.priority && (() => {
                    const pm = priorityMeta[cardData.priority];
                    const dot = isDark ? pm.dotDark : pm.dotLight;
                    const bg  = isDark ? pm.bgDark  : pm.bgLight;
                    const bdr = isDark ? pm.borderDark : pm.borderLight;
                    return (
                      <DropdownMenu open={priorityOpen} onOpenChange={setPriorityOpen}>
                        <DropdownMenuTrigger asChild>
                          <div className="cm-meta-row" style={{ padding:"8px", marginBottom:2, cursor:"pointer" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:5 }}>
                              <svg viewBox="0 0 24 24" fill="none" stroke={T.metaLabel} strokeWidth="1.8" width="11" height="11"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                              <span style={{ fontSize:10.5, color:T.metaLabel, fontWeight:500 }}>Priority</span>
                            </div>
                            <div style={{ display:"inline-flex", alignItems:"center", gap:5, marginLeft:18, padding:"3px 9px", borderRadius:20, background:bg, border:`1px solid ${bdr}` }}>
                              <div style={{ width:5, height:5, borderRadius:"50%", background:dot }}/>
                              <span style={{ fontSize:11, fontWeight:600, color:dot }}>{pm.label}</span>
                            </div>
                          </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-44">
                          {(["URGENT","HIGH","MEDIUM","LOW"] as const).map(p => (
                            <DropdownMenuItem key={p} onClick={() => handlePriorityChange(p)} className="cursor-pointer text-sm">
                              <div style={{ width:7, height:7, borderRadius:"50%", background: isDark ? priorityMeta[p].dotDark : priorityMeta[p].dotLight, marginRight:8 }}/>
                              {priorityMeta[p].label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    );
                  })()}

                  {/* Assignee */}
                  {cardData.assignee && (
                    <div className="cm-meta-row" style={{ padding:"8px", marginBottom:2 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:5 }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke={T.metaLabel} strokeWidth="1.8" width="11" height="11"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        <span style={{ fontSize:10.5, color:T.metaLabel, fontWeight:500 }}>Assignee</span>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:7, marginLeft:18 }}>
                        {cardData.assignee.imageUrl ? (
                          <NextImage src={cardData.assignee.imageUrl} alt={cardData.assignee.name} width={20} height={20} style={{ borderRadius:"50%", objectFit:"cover" }} />
                        ) : (
                          <div style={{
                            width:20, height:20, borderRadius:"50%",
                            background:"linear-gradient(135deg,#7B2FF7,#F107A3)",
                            display:"flex", alignItems:"center", justifyContent:"center",
                            fontSize:8, fontWeight:700, color:"#fff",
                          }}>{cardData.assignee.name.charAt(0).toUpperCase()}</div>
                        )}
                        <span style={{ fontSize:11.5, fontWeight:500, color:T.text }}>{cardData.assignee.name}</span>
                      </div>
                    </div>
                  )}

                  {/* Due Date */}
                  {cardData.dueDate && (() => {
                    const due = new Date(cardData.dueDate);
                    const overdue = isPast(due);
                    const soon = !overdue && differenceInHours(due, new Date()) < 48;
                    const col = overdue ? "#EF4444" : soon ? "#F59E0B" : "#10B981";
                    return (
                      <div className="cm-meta-row" style={{ padding:"8px", marginBottom:2 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:5 }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke={T.metaLabel} strokeWidth="1.8" width="11" height="11"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                          <span style={{ fontSize:10.5, color:T.metaLabel, fontWeight:500 }}>Due Date</span>
                        </div>
                        <div style={{ marginLeft:18 }}>
                          <span style={{
                            display:"inline-flex", alignItems:"center", gap:4,
                            fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:20,
                            background:`${col}18`, color:col, border:`1px solid ${col}33`,
                          }}>
                            <Clock className="h-2.5 w-2.5" />
                            {format(due,"MMM d, yyyy")}
                            {overdue ? " · Overdue" : soon ? " · Soon" : ""}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Labels */}
                  {cardLabels.length > 0 && (
                    <div className="cm-meta-row" style={{ padding:"8px", marginBottom:2 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:6 }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke={T.metaLabel} strokeWidth="1.8" width="11" height="11"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                        <span style={{ fontSize:10.5, color:T.metaLabel, fontWeight:500 }}>Labels</span>
                      </div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginLeft:18 }}>
                        {cardLabels.map((lbl: CardLabel) => (
                          <span key={lbl.id} style={{
                            fontSize:9.5, fontWeight:700, padding:"2px 7px", borderRadius:20,
                            background: lbl.color ? `${lbl.color}18` : T.surface,
                            color: lbl.color ?? T.textMid,
                            border:`1px solid ${lbl.color ? `${lbl.color}30` : T.border}`,
                            letterSpacing:"0.03em", textTransform:"uppercase",
                          }}>{lbl.name}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ height:1, background:T.divider, margin:"10px 0" }}/>

                  {/* ─ PROGRESS ─ */}
                  <p style={{ fontSize:9, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:T.metaLabel, marginBottom:8, paddingLeft:8 }}>Progress</p>

                  {/* Checklist mini */}
                  {cardData.checklists && cardData.checklists.length > 0 && (() => {
                    const allItems = cardData.checklists.flatMap((cl: { items: Array<{ id: string; isComplete: boolean }> }) => cl.items);
                    const done = allItems.filter((i: { id: string; isComplete: boolean }) => i.isComplete).length;
                    const total = allItems.length;
                    const pct = total > 0 ? Math.round((done/total)*100) : 0;
                    return (
                      <div style={{ padding:"8px" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:5 }}>
                          <CheckSquare className="h-2.5 w-2.5" style={{ color:T.metaLabel }} />
                          <span style={{ fontSize:10.5, color:T.metaLabel, fontWeight:500 }}>Checklist</span>
                          <span style={{ fontSize:10, fontWeight:700, color: pct===100 ? "#10B981" : "#A78BFA", marginLeft:"auto" }}>{pct}%</span>
                        </div>
                        <div style={{ height:3, background:T.surface, borderRadius:3, overflow:"hidden", border:`1px solid ${T.border}` }}>
                          <div style={{ height:"100%", width:`${pct}%`, background: pct===100 ? "#10B981" : "linear-gradient(90deg,#7B2FF7,#C01CC4)", borderRadius:3, transition:"width 0.5s ease" }}/>
                        </div>
                        <p style={{ fontSize:10, color:T.textMuted, marginTop:3 }}>{done} of {total} tasks</p>
                      </div>
                    );
                  })()}

                  <div style={{ height:1, background:T.divider, margin:"10px 0" }}/>

                  {/* ─ ACTIONS ─ */}
                  <p style={{ fontSize:9, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:T.metaLabel, marginBottom:8, paddingLeft:8 }}>Actions</p>

                  <button
                    className="cm-action-btn"
                    onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied"); }}
                    style={{
                      width:"100%", padding:"7px 10px", borderRadius:9, marginBottom:4,
                      border:`1px solid ${T.border}`, background:T.surface,
                      color:T.textMid, fontSize:11.5, fontWeight:500, cursor:"pointer",
                      fontFamily:"inherit", display:"flex", alignItems:"center", gap:6,
                    }}
                  >
                    <Copy className="h-3 w-3" /> Copy link
                  </button>

                  <button
                    className="cm-action-btn"
                    style={{
                      width:"100%", padding:"7px 10px", borderRadius:9,
                      border:"1px solid rgba(239,68,68,0.22)", background:"rgba(239,68,68,0.06)",
                      color:"#EF4444", fontSize:11.5, fontWeight:500, cursor:"pointer",
                      fontFamily:"inherit", display:"flex", alignItems:"center", gap:6,
                      transition:"background 0.15s ease",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background="rgba(239,68,68,0.12)"}
                    onMouseLeave={e => e.currentTarget.style.background="rgba(239,68,68,0.06)"}
                  >
                    <Trash2 className="h-3 w-3" /> Delete card
                  </button>

                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
