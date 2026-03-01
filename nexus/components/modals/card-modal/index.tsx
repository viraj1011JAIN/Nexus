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

  // Pre-computed CSS custom-property values (avoids inline style props)
  const cmPm = cardData?.priority ? priorityMeta[cardData.priority] : null;
  const cmDot = cmPm ? (isDark ? cmPm.dotDark : cmPm.dotLight) : "#A78BFA";
  const cmPillBg = cmPm
    ? (cardData?.coverImageUrl ? "rgba(0,0,0,0.32)" : (isDark ? cmPm.bgDark : cmPm.bgLight))
    : "rgba(0,0,0,0.32)";
  const cmPillBdr = cmPm
    ? (cardData?.coverImageUrl ? "rgba(255,255,255,0.15)" : (isDark ? cmPm.borderDark : cmPm.borderLight))
    : "rgba(255,255,255,0.15)";
  const cmLblColor = cmPm ? (cardData?.coverImageUrl ? "rgba(255,255,255,0.9)" : cmDot) : "#A78BFA";
  const cmSbPillBg  = cmPm ? (isDark ? cmPm.bgDark  : cmPm.bgLight)  : "transparent";
  const cmSbPillBdr = cmPm ? (isDark ? cmPm.borderDark : cmPm.borderLight) : "transparent";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        data-cm-modal
        className="p-0 gap-0 border-none overflow-hidden"
      >
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@600;700;800&display=swap');

          /* ── Theme tokens ──────────────────────────────── */
          [data-cm-modal] {
            --cm-text:${T.text}; --cm-text-mid:${T.textMid}; --cm-text-muted:${T.textMuted};
            --cm-surface:${T.surface}; --cm-surface-hover:${T.surfaceHover};
            --cm-border:${T.border}; --cm-divider:${T.divider};
            --cm-tab-active:${T.tabActive}; --cm-tab-active-txt:${T.tabActiveTxt};
            --cm-sidebar:${T.sidebarBg}; --cm-meta-label:${T.metaLabel};
            --cm-badge-bg:${T.badgeBg}; --cm-cover-overlay:${T.coverOverlay};
            --cm-modal-bg:${T.modal};
            --cm-modal-shadow:${isDark ? "0 32px 80px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.05)" : "0 32px 80px rgba(0,0,0,0.14), 0 8px 32px rgba(0,0,0,0.07)"};
            --cm-cover-bg:${cardData?.coverColor ?? "#7B2FF7"};
            --pill-bg:${cmPillBg}; --pill-bdr:1px solid ${cmPillBdr}; --dot-color:${cmDot};
            --cm-lbl-color:${cmLblColor};
            --cm-sb-pill-bg:${cmSbPillBg}; --cm-sb-pill-bdr:${cmSbPillBdr}; --cm-sb-dot:${cmDot};
            --cm-dot-urgent:${isDark ? priorityMeta.URGENT.dotDark : priorityMeta.URGENT.dotLight};
            --cm-dot-high:${isDark ? priorityMeta.HIGH.dotDark : priorityMeta.HIGH.dotLight};
            --cm-dot-medium:${isDark ? priorityMeta.MEDIUM.dotDark : priorityMeta.MEDIUM.dotLight};
            --cm-dot-low:${isDark ? priorityMeta.LOW.dotDark : priorityMeta.LOW.dotLight};
            width: min(1080px, 95vw);
            max-height: 90vh;
            background: var(--cm-modal-bg);
            border-radius: 20px;
            box-shadow: var(--cm-modal-shadow);
            display: flex;
            flex-direction: column;
            font-family: 'DM Sans', system-ui, sans-serif;
          }

          /* ── Scrollbars ────────────────────────────────── */
          .cm-scrollbar::-webkit-scrollbar { width:4px; height:4px; }
          .cm-scrollbar::-webkit-scrollbar-thumb { background:${T.scrollbar}; border-radius:4px; }
          .cm-scrollbar::-webkit-scrollbar-track { background:transparent; }
          .cm-tab-scroll::-webkit-scrollbar { height:0; }

          /* ── Interactive states ────────────────────────── */
          .cm-meta-row { transition:background 0.13s ease; border-radius:9px; }
          .cm-meta-row:hover { background:${T.surfaceHover}; }
          .cm-action-btn { transition:background 0.15s ease,border-color 0.15s ease; }
          .cm-action-btn:hover { background:${T.surfaceHover} !important; }

          /* ── Animations ────────────────────────────────── */
          @keyframes cm-spin { to { transform:rotate(360deg); } }
          @keyframes cmPulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
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

          /* ── Layout ─────────────────────────────────────── */
          .cm-layout  { display:flex; flex-direction:column; height:100%; max-height:90vh; overflow:hidden; }
          .cm-body    { display:flex; flex:1; min-height:0; overflow:hidden; }
          .cm-left    { flex:1; min-width:0; display:flex; flex-direction:column; border-right:1px solid var(--cm-divider); overflow:hidden; }
          .cm-header  { padding:18px 22px 0; flex-shrink:0; }
          .cm-content { flex:1; overflow-y:auto; padding:18px 22px 24px; }
          .cm-footer  { flex-shrink:0; border-top:1px solid var(--cm-divider); padding:9px 22px; display:flex; align-items:center; justify-content:space-between; }
          .cm-footer-l{ display:flex; align-items:center; gap:12px; }
          .cm-footer-r{ display:flex; align-items:center; gap:6px; }
          .cm-sidebar { width:228px; flex-shrink:0; background:var(--cm-sidebar); border-left:1px solid var(--cm-divider); overflow-y:auto; display:flex; flex-direction:column; }
          .cm-sidebar-inner { padding:18px 14px; display:flex; flex-direction:column; gap:0; }

          /* ── Loading ─────────────────────────────────────── */
          .cm-loading-wrap  { display:flex; align-items:center; justify-content:center; height:100%; min-height:360px; }
          .cm-loading-inner { display:flex; flex-direction:column; align-items:center; gap:12px; }
          .cm-spinner       { width:34px; height:34px; border-radius:50%; border:3px solid #7B2FF7; border-top-color:transparent; animation:cm-spin 0.8s linear infinite; }
          .cm-loading-text  { font-size:13px; color:var(--cm-text-muted); }

          /* ── Cover ───────────────────────────────────────── */
          .cm-cover       { position:relative; height:148px; flex-shrink:0; overflow:hidden; }
          .cm-cover-fill  { width:100%; height:100%; background:var(--cm-cover-bg); }
          .cm-cover-img   { width:100%; height:100%; object-fit:cover; display:block; }
          .cm-cover-grad  { position:absolute; inset:0; background:var(--cm-cover-overlay); }
          .cm-cover-default-dark  { width:100%; height:100%; background:linear-gradient(135deg,#1a0533 0%,#0D0C14 60%,#071422 100%); border-bottom:1px solid var(--cm-divider); }
          .cm-cover-default-light { width:100%; height:100%; background:linear-gradient(135deg,#f4f1fd 0%,#fffdf9 60%,#f0f7ff 100%); border-bottom:1px solid var(--cm-divider); }

          /* ── Breadcrumb ──────────────────────────────────── */
          .cm-breadcrumb   { position:absolute; bottom:12px; left:18px; display:flex; align-items:center; gap:5px; }
          .cm-bc-list      { font-size:11px; color:var(--cm-text-muted); }
          .cm-bc-list-img  { font-size:11px; color:rgba(255,255,255,0.55); }
          .cm-bc-id        { font-size:10.5px; font-weight:600; background:var(--cm-surface); backdrop-filter:blur(8px); padding:2px 8px; border-radius:20px; border:1px solid var(--cm-border); color:var(--cm-text-mid); }
          .cm-bc-id-img    { font-size:10.5px; font-weight:600; background:rgba(0,0,0,0.28); backdrop-filter:blur(8px); padding:2px 8px; border-radius:20px; border:1px solid rgba(255,255,255,0.15); color:rgba(255,255,255,0.8); }
          .cm-close        { position:absolute; top:10px; right:12px; width:30px; height:30px; border-radius:9px; background:var(--cm-surface); backdrop-filter:blur(8px); border:1px solid var(--cm-border); color:var(--cm-text-mid); display:flex; align-items:center; justify-content:center; cursor:pointer; transition:background 0.15s ease; }
          .cm-close-img    { position:absolute; top:10px; right:12px; width:30px; height:30px; border-radius:9px; background:rgba(0,0,0,0.38); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.15); color:rgba(255,255,255,0.75); display:flex; align-items:center; justify-content:center; cursor:pointer; transition:background 0.15s ease; }

          /* ── Priority pill ───────────────────────────────── */
          .cm-priority-pill { position:absolute; top:12px; left:18px; display:flex; align-items:center; gap:5px; padding:4px 10px; border-radius:20px; backdrop-filter:blur(10px); background:var(--pill-bg,rgba(0,0,0,0.32)); border:1px solid var(--pill-bdr,rgba(255,255,255,0.15)); }
          .cm-priority-dot  { width:6px; height:6px; border-radius:50%; background:var(--dot-color,#A78BFA); box-shadow:0 0 6px var(--dot-color,#A78BFA)55; }
          .cm-priority-lbl  { font-size:10.5px; font-weight:700; color:var(--cm-lbl-color,var(--dot-color,#A78BFA)); letter-spacing:0.04em; text-transform:uppercase; }
          .cm-dropdown-dot  { width:7px; height:7px; border-radius:50%; margin-right:8px; background:var(--dot-color); }

          /* ── Title ───────────────────────────────────────── */
          .cm-title-ta { width:100%; background:transparent; border:1px solid rgba(123,47,247,0.45); border-radius:9px; padding:4px 8px; color:var(--cm-text); font-size:21px; font-weight:700; font-family:'Playfair Display',serif; letter-spacing:-0.02em; line-height:1.3; resize:none; min-height:48px; box-shadow:0 0 0 3px rgba(123,47,247,0.1); outline:none; }
          .cm-title-h1 { font-size:21px; font-weight:700; font-family:'Playfair Display',serif; letter-spacing:-0.02em; line-height:1.3; color:var(--cm-text); cursor:text; padding:4px 8px 4px 0; border-radius:9px; transition:background 0.13s ease; }

          /* ── Date row ────────────────────────────────────── */
          .cm-dates    { display:flex; align-items:center; gap:5px; margin-top:6px; padding-left:1px; }
          .cm-date-txt { font-size:11px; color:var(--cm-text-muted); }
          .cm-date-sep { color:var(--cm-text-muted); font-size:10px; }

          /* ── Action bar ──────────────────────────────────── */
          .cm-action-bar  { display:flex; align-items:center; gap:6px; margin-top:12px; padding-bottom:12px; border-bottom:1px solid var(--cm-divider); flex-wrap:wrap; }
          .cm-fallback-btn{ padding:5px 11px; border-radius:8px; border:1px solid var(--cm-border); background:var(--cm-surface); color:var(--cm-text-mid); font-size:12px; cursor:not-allowed; font-family:inherit; }

          /* ── Tabs ─────────────────────────────────────────── */
          .cm-tab-wrap        { display:flex; gap:1px; margin-top:2px; overflow-x:auto; padding-bottom:0; }
          .cm-tab-btn         { display:flex; align-items:center; gap:5px; padding:9px 11px; border-radius:9px 9px 0 0; border:none; cursor:pointer; font-family:inherit; font-size:12px; white-space:nowrap; position:relative; transition:color 0.13s ease,background 0.13s ease; }
          .cm-tab-on          { background:var(--cm-tab-active); color:var(--cm-tab-active-txt); font-weight:600; }
          .cm-tab-off         { background:transparent; color:var(--cm-text-muted); font-weight:400; }
          .cm-tab-bdg-on      { font-size:9px; font-weight:700; padding:1px 5px; border-radius:20px; background:rgba(123,47,247,0.25); color:var(--cm-tab-active-txt); }
          .cm-tab-bdg-off     { font-size:9px; font-weight:700; padding:1px 5px; border-radius:20px; background:var(--cm-badge-bg); color:var(--cm-text-muted); }
          .cm-tab-indicator   { position:absolute; bottom:0; left:50%; transform:translateX(-50%); width:55%; height:2px; background:linear-gradient(90deg,#7B2FF7,#C01CC4); border-radius:4px; }
          .cm-divider-line    { height:1px; background:var(--cm-divider); }

          /* ── Description ─────────────────────────────────── */
          .cm-err-fb   { padding:20px; text-align:center; background:rgba(239,68,68,0.05); border-radius:12px; border:1px solid rgba(239,68,68,0.15); }
          .cm-err-txt  { font-size:12px; color:#EF4444; }
          .cm-desc-hdr { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
          .cm-desc-lbl { font-size:12px; font-weight:600; color:var(--cm-text-mid); }
          .cm-ai-btn   { display:flex; align-items:center; gap:5px; padding:4px 10px; border-radius:20px; background:rgba(123,47,247,0.1); border:1px solid rgba(123,47,247,0.2); color:#A78BFA; font-size:11.5px; font-weight:600; cursor:pointer; font-family:inherit; }
          .cm-editor-wrap  { border-radius:12px; border:1px solid var(--cm-border); overflow:hidden; }
          .cm-editor-dark  { background:rgba(255,255,255,0.03); }
          .cm-editor-light { background:#fff; }
          .cm-hint     { display:flex; align-items:center; gap:6px; margin-top:8px; padding-left:2px; }
          .cm-hint-txt { font-size:11px; color:var(--cm-text-muted); }
          .cm-hint-kbd { padding:1px 6px; background:var(--cm-surface); border:1px solid var(--cm-border); border-radius:5px; font-size:11px; color:var(--cm-text-mid); font-family:monospace; }

          /* ── Section header (shared) ─────────────────────── */
          .cm-sec-hdr   { display:flex; align-items:center; gap:8px; margin-bottom:16px; }
          .cm-sec-title { font-size:12.5px; font-weight:600; color:var(--cm-text); }
          .cm-sec-count { font-size:9.5px; font-weight:700; padding:1px 6px; border-radius:20px; background:var(--cm-badge-bg); color:var(--cm-text-muted); }

          /* ── Comments wrapper ────────────────────────────── */
          .cm-comments-wrap  { border:1px solid var(--cm-border); border-radius:14px; overflow:hidden; display:flex; flex-direction:column; }
          .cm-comments-dark  { background:rgba(255,255,255,0.02); }
          .cm-comments-light { background:rgba(0,0,0,0.015); }
          .cm-signin-wrap { padding:24px; text-align:center; }
          .cm-signin-txt  { font-size:12px; color:var(--cm-text-muted); }

          /* ── Misc shared tokens ──────────────────────────── */
          .cm-muted-icon { color:var(--cm-text-muted); }
          .cm-char-txt   { font-size:11px; color:var(--cm-text-muted); }
          .cm-badge-sm   { font-size:9.5px; font-weight:700; padding:1px 6px; border-radius:20px; background:var(--cm-badge-bg); color:var(--cm-text-muted); }
          .cm-save-row   { display:flex; align-items:center; gap:5px; font-size:11px; }
          .cm-save-dot   { width:6px; height:6px; border-radius:50%; }
          .cm-pulse-anim { animation:cmPulse 1s ease-in-out infinite; }

          /* ── Sidebar ─────────────────────────────────────── */
          .cm-meta-label-txt { font-size:9px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:var(--cm-meta-label); margin-bottom:8px; padding-left:8px; }
          .cm-divider-sm   { height:1px; background:var(--cm-divider); margin:10px 0; }
          .cm-meta-row-pad { padding:8px; margin-bottom:2px; }
          .cm-meta-row-pad2{ padding:8px; }
          .cm-field-row    { display:flex; align-items:center; gap:7px; margin-bottom:5px; }
          .cm-field-lbl    { font-size:10.5px; color:var(--cm-meta-label); font-weight:500; }
          .cm-field-body   { display:flex; align-items:center; gap:7px; margin-left:18px; }
          .cm-field-body-wrap { display:flex; flex-wrap:wrap; gap:4px; margin-left:18px; }
          .cm-field-inline { display:inline-flex; align-items:center; gap:5px; margin-left:18px; padding:3px 9px; border-radius:20px; background:var(--pill-bg); border:1px solid var(--pill-bdr); }
          .cm-assignee-avatar { width:20px; height:20px; border-radius:50%; background:linear-gradient(135deg,#7B2FF7,#F107A3); display:flex; align-items:center; justify-content:center; font-size:8px; font-weight:700; color:#fff; }
          .cm-assignee-name   { font-size:11.5px; font-weight:500; color:var(--cm-text); }
          .cm-progress-track { height:3px; background:var(--cm-surface); border-radius:3px; overflow:hidden; border:1px solid var(--cm-border); }
          .cm-progress-txt   { font-size:10px; color:var(--cm-text-muted); margin-top:3px; }
          .cm-sidebar-btn  { width:100%; padding:7px 10px; border-radius:9px; margin-bottom:4px; border:1px solid var(--cm-border); background:var(--cm-surface); color:var(--cm-text-mid); font-size:11.5px; font-weight:500; cursor:pointer; font-family:inherit; display:flex; align-items:center; gap:6px; }
          .cm-delete-btn   { width:100%; padding:7px 10px; border-radius:9px; border:1px solid rgba(239,68,68,0.22); background:rgba(239,68,68,0.06); color:#EF4444; font-size:11.5px; font-weight:500; cursor:pointer; font-family:inherit; display:flex; align-items:center; gap:6px; transition:background 0.15s ease; }
          .cm-delete-btn:hover { background:rgba(239,68,68,0.12); }

          /* ── Extra utility classes ─────────────────────────────────── */
          .cm-err-icon   { color:#EF4444; }
          .cm-icon-btn   { width:30px !important; height:30px !important; padding:0 !important; justify-content:center !important; margin-bottom:0 !important; }
          .cm-cover-btn  { padding:5px 11px; border-radius:8px; border:1px solid var(--cm-border); background:var(--cm-surface); color:var(--cm-text-mid); font-size:12px; font-weight:500; cursor:pointer; font-family:inherit; display:flex; align-items:center; gap:5px; }
          .cm-cover-btn-active { border-color:rgba(123,47,247,0.35) !important; background:rgba(123,47,247,0.1) !important; color:#A78BFA !important; }
          .cm-ai-btn:disabled { opacity:0.6; }
          .cm-save-dot-saving { background:#60A5FA; }
          .cm-save-dot-saved  { background:#10B981; }
          .cm-save-dot-error  { background:#EF4444; }
          .cm-save-row-saving { color:var(--cm-text-mid); }
          .cm-save-row-saved  { color:#10B981; font-weight:600; }
          .cm-save-row-error  { color:#EF4444; font-weight:600; }
          .cm-dot-priority { border-radius:50%; flex-shrink:0; margin-right:8px; }
          .cm-dot-urgent { width:7px; height:7px; background:var(--cm-dot-urgent); }
          .cm-dot-high   { width:7px; height:7px; background:var(--cm-dot-high); }
          .cm-dot-medium { width:7px; height:7px; background:var(--cm-dot-medium); }
          .cm-dot-low    { width:7px; height:7px; background:var(--cm-dot-low); }
          .cm-due-badge  { display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:600; padding:2px 8px; border-radius:20px; }
          .cm-due-overdue{ background:rgba(239,68,68,0.09); color:#EF4444; border:1px solid rgba(239,68,68,0.2); }
          .cm-due-soon   { background:rgba(245,158,11,0.09); color:#F59E0B; border:1px solid rgba(245,158,11,0.2); }
          .cm-due-ok     { background:rgba(16,185,129,0.09); color:#10B981; border:1px solid rgba(16,185,129,0.2); }
          .cm-sb-pill    { display:inline-flex; align-items:center; gap:5px; margin-left:18px; padding:3px 9px; border-radius:20px; background:var(--cm-sb-pill-bg); border:1px solid var(--cm-sb-pill-bdr); }
          .cm-sb-dot     { width:5px; height:5px; border-radius:50%; background:var(--cm-sb-dot); flex-shrink:0; }
          .cm-sb-lbl     { font-size:11px; font-weight:600; color:var(--cm-sb-dot); }
          .cm-progress-fill        { height:100%; border-radius:3px; transition:width 0.5s ease; }
          .cm-progress-fill-done   { background:#10B981; }
          .cm-progress-fill-active { background:linear-gradient(90deg,#7B2FF7,#C01CC4); }
          .cm-pct-txt-done   { font-size:10px; font-weight:700; margin-left:auto; color:#10B981; }
          .cm-pct-txt-active { font-size:10px; font-weight:700; margin-left:auto; color:#A78BFA; }
        `}</style>

        <DialogTitle className="sr-only">Card Details</DialogTitle>

        {/* ── LOADING ── */}
        {!cardData ? (
          <div className="cm-loading-wrap">
            <div className="cm-loading-inner">
              <div className="cm-spinner" />
              <p className="cm-loading-text">Loading card…</p>
            </div>
          </div>
        ) : (
          <div className="cm-anim-modal cm-layout">

            {/* ══ COVER ══ */}
            <div className="cm-cover">
              {(cardData.coverImageUrl || cardData.coverColor) ? (
                <>
                  {cardData.coverImageUrl
                    ? <NextImage src={cardData.coverImageUrl} alt="" width={600} height={148} className="cm-cover-img" />
                    : <div className="cm-cover-fill" />
                  }
                  <div className="cm-cover-grad" />
                </>
              ) : (
                <div className={isDark ? "cm-cover-default-dark" : "cm-cover-default-light"} />
              )}

              {/* Breadcrumb */}
              <div className="cm-breadcrumb">
                <span className={cardData.coverImageUrl ? "cm-bc-list-img" : "cm-bc-list"}>{cardData.list?.title ?? "Board"}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke={cardData.coverImageUrl ? "rgba(255,255,255,0.4)" : T.textMuted} strokeWidth="2" width="10" height="10"><polyline points="9 18 15 12 9 6"/></svg>
                <span className={cardData.coverImageUrl ? "cm-bc-id-img" : "cm-bc-id"}>#{cardData.id.slice(-8)}</span>
              </div>

              {/* Priority pill */}
              {cardData.priority && (
                <div className="cm-priority-pill">
                  <div className="cm-priority-dot" />
                  <span className="cm-priority-lbl">{priorityMeta[cardData.priority].label}</span>
                </div>
              )}

              {/* Close */}
              <DialogClose asChild>
                <button className={cardData.coverImageUrl ? "cm-close-img" : "cm-close"} title="Close">
                  <X className="h-3.5 w-3.5"/>
                </button>
              </DialogClose>
            </div>

            {/* ══ TWO-COLUMN BODY ══ */}
            <div className="cm-body">

              {/* ── LEFT PANEL ── */}
              <div className="cm-left">

                {/* Title + meta + action bar + tabs — static header */}
                <div className="cm-header">

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
                      className="cm-title-ta"
                    />
                  ) : (
                    <h1
                      onClick={() => setIsEditingTitle(true)}
                      className="cm-title-h1"
                      onMouseEnter={e => e.currentTarget.style.background=T.surfaceHover}
                      onMouseLeave={e => e.currentTarget.style.background="transparent"}
                    >{title}</h1>
                  )}

                  {/* Dates */}
                  <div className="cm-dates">
                    <Clock className="h-3 w-3 cm-muted-icon" />
                    <span className="cm-date-txt">
                      Created {new Date(cardData.createdAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                    </span>
                    <span className="cm-date-sep">·</span>
                    <span className="cm-date-txt">
                      Updated {new Date(cardData.updatedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                    </span>
                  </div>

                  {/* Action bar */}
                  <div className="cm-action-bar">
                    {/* Labels */}
                    <div ref={labelWrapperRef} className="contents">
                      <ErrorBoundary fallback={
                        <button className="cm-fallback-btn">Labels</button>
                      }>
                        <LabelManager cardId={cardData.id} orgId={organizationId} availableLabels={orgLabels} cardLabels={cardLabels} onLabelsChange={refreshCardData} />
                      </ErrorBoundary>
                    </div>

                    {/* Assignee */}
                    <div ref={assigneeWrapperRef} className="contents">
                      <ErrorBoundary fallback={
                        <button className="cm-fallback-btn">Assign</button>
                      }>
                        <AssigneePicker cardId={cardData.id} orgId={organizationId} currentAssignee={cardData.assignee || null} availableUsers={orgMembers} onAssigneeChange={refreshCardData} />
                      </ErrorBoundary>
                    </div>

                    {/* Due date */}
                    <div ref={dueDateWrapperRef} className="contents">
                      <ErrorBoundary fallback={
                        <button className="cm-fallback-btn">Due date</button>
                      }>
                        <SmartDueDate dueDate={cardData.dueDate} onDateChange={handleDueDateChange} priority={cardData.priority} animated editable />
                      </ErrorBoundary>
                    </div>

                    {/* Cover picker */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          className={`cm-cover-btn${(cardData.coverColor || cardData.coverImageUrl) ? " cm-cover-btn-active" : ""}`}
                        >
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
                        <button className="cm-action-btn cm-sidebar-btn cm-icon-btn" title="More options">
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
                  <div className="cm-tab-scroll cm-tab-wrap">
                    {TABS.map(tab => {
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`cm-tab-btn ${isActive ? "cm-tab-on" : "cm-tab-off"}`}
                        >
                          {tab.icon}
                          {tab.label}
                          {(tab.badge ?? 0) > 0 && (
                            <span className={isActive ? "cm-tab-bdg-on" : "cm-tab-bdg-off"}>{tab.badge}</span>
                          )}
                          {isActive && <div className="cm-tab-indicator" />}
                        </button>
                      );
                    })}
                  </div>
                  <div className="cm-divider-line" />
                </div>

                {/* ── SCROLLABLE TAB CONTENT ── */}
                <div className="cm-scrollbar cm-content">

                  {/* DESCRIPTION */}
                  {activeTab === "description" && (
                    <div className="cm-anim-fade">
                      <ErrorBoundary fallback={
                        <div className="cm-err-fb">
                          <AlertCircle className="h-7 w-7 mx-auto mb-2 cm-err-icon" />
                          <p className="cm-err-txt">Editor unavailable. Refresh to try again.</p>
                        </div>
                      }>
                        <div className="cm-desc-hdr">
                          <span className="cm-desc-lbl">Description</span>
                          <button
                            onClick={handleGenerateDescription}
                            disabled={aiDescLoading}
                            className="cm-ai-btn"
                          >
                            {aiDescLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                            {aiDescLoading ? "Generating…" : "AI Generate"}
                          </button>
                        </div>
                        <div className={`cm-editor-wrap ${isDark ? "cm-editor-dark" : "cm-editor-light"}`}>
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
                          <div className="cm-hint">
                            <span className="cm-hint-txt">💡 Tip: Type</span>
                            <kbd className="cm-hint-kbd">/</kbd>
                            <span className="cm-hint-txt">for commands</span>
                          </div>
                        )}
                      </ErrorBoundary>
                    </div>
                  )}

                  {/* ACTIVITY */}
                  {activeTab === "activity" && (
                    <div className="cm-anim-fade">
                      <div className="cm-sec-hdr">
                        <MessageSquare className="h-3.5 w-3.5 cm-muted-icon" />
                        <span className="cm-sec-title">Audit Log</span>
                        <span className="cm-sec-count">{auditLogs.length}</span>
                      </div>
                      <Activity items={auditLogs} />
                    </div>
                  )}

                  {/* COMMENTS */}
                  {activeTab === "comments" && (
                    <div className="cm-anim-fade">
                      <div className="cm-sec-hdr">
                        <MessageSquare className="h-3.5 w-3.5 cm-muted-icon" />
                        <span className="cm-sec-title">Comments</span>
                        {comments.length > 0 && <span className="cm-sec-count">{comments.length}</span>}
                      </div>

                      <ErrorBoundary fallback={
                        <div className="cm-err-fb">
                          <AlertCircle className="h-7 w-7 mx-auto mb-2 cm-err-icon" />
                          <p className="cm-err-txt">Comments unavailable. Refresh to try again.</p>
                        </div>
                      }>
                        <div className={`cm-comments-wrap ${isDark ? "cm-comments-dark" : "cm-comments-light"}`}>
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
                            <div className="cm-signin-wrap">
                              <p className="cm-signin-txt">Sign in to view comments.</p>
                            </div>
                          )}
                        </div>
                      </ErrorBoundary>
                    </div>
                  )}

                  {/* ATTACHMENTS */}
                  {activeTab === "attachments" && (
                    <div className="cm-anim-fade">
                      <div className="cm-sec-hdr">
                        <Paperclip className="h-3.5 w-3.5 cm-muted-icon" />
                        <span className="cm-sec-title">Files</span>
                        {attachmentCount > 0 && <span className="cm-sec-count">{attachmentCount}</span>}
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
                      <ErrorBoundary fallback={<p className="cm-loading-text">Unable to load time tracking.</p>}>
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
                      <ErrorBoundary fallback={<p className="cm-loading-text">Unable to load custom fields.</p>}>
                        <CustomFieldsPanel boardId={boardId} cardId={cardData.id} isAdmin={membership?.role === "org:admin"} />
                      </ErrorBoundary>
                    </div>
                  )}
                </div>

                {/* ── MODAL FOOTER ── */}
                <div className="cm-footer">
                  <div className="cm-footer-l">
                    <span className="cm-char-txt">{charCount.toLocaleString()} / 10,000 chars</span>
                    <KeyboardShortcutsModal />
                  </div>
                  <div className="cm-footer-r">
                    {saveStatus === "saving" && (
                      <div className="cm-save-row">
                        <div className="cm-save-dot cm-save-dot-saving cm-pulse-anim" />
                        Saving…
                      </div>
                    )}
                    {saveStatus === "saved" && (
                      <div className="cm-save-row cm-save-row-saved">
                        <div className="cm-save-dot cm-save-dot-saved" />
                        All changes saved
                      </div>
                    )}
                    {saveStatus === "error" && (
                      <div className="cm-save-row cm-save-row-error">
                        <div className="cm-save-dot cm-save-dot-error" />
                        Failed to save
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── RIGHT SIDEBAR ── */}
              <div className="cm-scrollbar cm-sidebar">
                <div className="cm-sidebar-inner">

                  {/* ─ DETAILS ─ */}
                  <p className="cm-meta-label-txt">Details</p>

                  {/* Priority */}
                  {cardData.priority && (() => {
                    const pm = priorityMeta[cardData.priority];
                    return (
                      <DropdownMenu open={priorityOpen} onOpenChange={setPriorityOpen}>
                        <DropdownMenuTrigger asChild>
                          <div className="cm-meta-row cm-meta-row-pad cursor-pointer">
                            <div className="cm-field-row">
                              <svg viewBox="0 0 24 24" fill="none" stroke={T.metaLabel} strokeWidth="1.8" width="11" height="11"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                              <span className="cm-field-lbl">Priority</span>
                            </div>
                            <div className="cm-sb-pill">
                              <div className="cm-sb-dot"/>
                              <span className="cm-sb-lbl">{pm.label}</span>
                            </div>
                          </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-44">
                          {(["URGENT","HIGH","MEDIUM","LOW"] as const).map(p => (
                            <DropdownMenuItem key={p} onClick={() => handlePriorityChange(p)} className="cursor-pointer text-sm">
                              <div className={`cm-dot-priority cm-dot-${p.toLowerCase()}`}/>
                              {priorityMeta[p].label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    );
                  })()}

                  {/* Assignee */}
                  {cardData.assignee && (
                    <div className="cm-meta-row cm-meta-row-pad">
                      <div className="cm-field-row">
                        <svg viewBox="0 0 24 24" fill="none" stroke={T.metaLabel} strokeWidth="1.8" width="11" height="11"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        <span className="cm-field-lbl">Assignee</span>
                      </div>
                      <div className="cm-field-body">
                        {cardData.assignee.imageUrl ? (
                          <NextImage src={cardData.assignee.imageUrl} alt={cardData.assignee.name} width={20} height={20} className="rounded-full object-cover" />
                        ) : (
                          <div className="cm-assignee-avatar">{cardData.assignee.name.charAt(0).toUpperCase()}</div>
                        )}
                        <span className="cm-assignee-name">{cardData.assignee.name}</span>
                      </div>
                    </div>
                  )}

                  {/* Due Date */}
                  {cardData.dueDate && (() => {
                    const due = new Date(cardData.dueDate);
                    const overdue = isPast(due);
                    const soon = !overdue && differenceInHours(due, new Date()) < 48;
                    return (
                      <div className="cm-meta-row cm-meta-row-pad">
                        <div className="cm-field-row">
                          <svg viewBox="0 0 24 24" fill="none" stroke={T.metaLabel} strokeWidth="1.8" width="11" height="11"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                          <span className="cm-field-lbl">Due Date</span>
                        </div>
                        <div className="cm-field-body-wrap">
                          <span className={`cm-due-badge ${overdue ? "cm-due-overdue" : soon ? "cm-due-soon" : "cm-due-ok"}`}>
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
                    <div className="cm-meta-row cm-meta-row-pad">
                      <div className="cm-field-row">
                        <svg viewBox="0 0 24 24" fill="none" stroke={T.metaLabel} strokeWidth="1.8" width="11" height="11"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                        <span className="cm-field-lbl">Labels</span>
                      </div>
                      <div className="cm-field-body-wrap">
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

                  <div className="cm-divider-sm"/>

                  {/* ─ PROGRESS ─ */}
                  <p className="cm-meta-label-txt">Progress</p>

                  {/* Checklist mini */}
                  {cardData.checklists && cardData.checklists.length > 0 && (() => {
                    const allItems = cardData.checklists.flatMap((cl: { items: Array<{ id: string; isComplete: boolean }> }) => cl.items);
                    const done = allItems.filter((i: { id: string; isComplete: boolean }) => i.isComplete).length;
                    const total = allItems.length;
                    const pct = total > 0 ? Math.round((done/total)*100) : 0;
                    return (
                      <div className="cm-meta-row-pad">
                        <div className="cm-field-row">
                          <CheckSquare className="h-2.5 w-2.5 cm-muted-icon" />
                          <span className="cm-field-lbl">Checklist</span>
                          <span className={pct===100 ? "cm-pct-txt-done" : "cm-pct-txt-active"}>{pct}%</span>
                        </div>
                        <div className="cm-progress-track">
                          <div className={`cm-progress-fill ${pct===100 ? "cm-progress-fill-done" : "cm-progress-fill-active"}`} style={{ width:`${pct}%` }}/>
                        </div>
                        <p className="cm-progress-txt">{done} of {total} tasks</p>
                      </div>
                    );
                  })()}

                  <div className="cm-divider-sm"/>

                  {/* ─ ACTIONS ─ */}
                  <p className="cm-meta-label-txt">Actions</p>

                  <button
                    className="cm-sidebar-btn"
                    onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied"); }}
                  >
                    <Copy className="h-3 w-3" /> Copy link
                  </button>

                  <button className="cm-delete-btn">
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
