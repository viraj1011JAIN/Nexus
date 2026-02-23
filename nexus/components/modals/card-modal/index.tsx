"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, AuditLog, List, Label, Priority } from "@prisma/client";
import { 
  ChevronRight, 
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
  GitBranch,
  Timer,
  Link2,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { useUser, useOrganization } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
import { LabelManager, CardLabels } from "@/components/label-manager";
import { AssigneePicker, CardAssignee } from "@/components/assignee-picker";
import { SmartDueDate } from "@/components/smart-due-date";
import { RichComments, type Comment } from "@/components/rich-comments";
import { FileAttachment } from "@/components/board/file-attachment";
import { CardCoverPicker } from "@/components/board/card-cover-picker";
import { ChecklistPanel } from "@/components/board/checklist-panel";
import { TimeTrackingPanel } from "@/components/board/time-tracking-panel";
import { DependencyPanel } from "@/components/board/dependency-panel";
import { CustomFieldsPanel } from "@/components/board/custom-fields-panel";
import { KeyboardShortcutsModal } from "@/components/keyboard-shortcuts-modal";
import { getOrganizationLabels, getCardLabels } from "@/actions/label-actions";
import { getOrganizationMembers } from "@/actions/assignee-actions";
import { getCardAttachments, type AttachmentDto } from "@/actions/attachment-actions";
import { getChecklists } from "@/actions/checklist-actions";
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
import { ErrorBoundary } from "@/components/error-boundary-realtime";
import type { CardLabel } from "@/hooks/use-optimistic-card";

type CardWithRelations = Card & { 
  list: List;
  assignee?: {
    id: string;
    name: string;
    imageUrl: string | null;
  } | null;
};

const priorityConfig = {
  URGENT: { label: "Urgent", color: "bg-gradient-to-r from-red-500 to-red-600", text: "text-white", icon: "⚠" },
  HIGH: { label: "High", color: "bg-gradient-to-r from-orange-400 to-orange-500", text: "text-white", icon: "↑" },
  MEDIUM: { label: "Medium", color: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400", icon: "—" },
  LOW: { label: "Low", color: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-400", icon: "↓" },
};

export const CardModal = () => {
  const params = useParams();
  const router = useRouter();
  
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
  const [attachments, setAttachments] = useState<AttachmentDto[]>([]);
  const [checklists, setChecklists] = useState<Parameters<typeof ChecklistPanel>[0]["initialChecklists"]>([]);
  
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
            const [labels, cardLabelsList, members, attachmentsResult, checklistsResult] = await Promise.all([
              getOrganizationLabels(),
              getCardLabels(id),
              getOrganizationMembers(),
              getCardAttachments(id),
              getChecklists(id),
            ]);
            
            setOrgLabels(labels);
            setCardLabels(cardLabelsList);
            setOrgMembers(members);
            if (attachmentsResult.data) setAttachments(attachmentsResult.data);
            if (checklistsResult.data) setChecklists(checklistsResult.data as unknown as Parameters<typeof ChecklistPanel>[0]["initialChecklists"]);
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full sm:max-w-[95vw] lg:max-w-4xl h-[90vh] max-h-[90vh] p-0 gap-0 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border-none flex flex-col">
        <DialogTitle className="sr-only">Card Details</DialogTitle>

        {!cardData ? (
          <div className="flex items-center justify-center h-full">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Loading card...</p>
            </motion.div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            
            {/* HEADER SECTION */}
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="border-b border-slate-200 dark:border-slate-700"
            >
              {/* Cover Image / Color Banner */}
              {(cardData.coverImageUrl || cardData.coverColor) && (
                <div
                  className="h-32 w-full rounded-t-2xl"
                  style={
                    cardData.coverImageUrl
                      ? { backgroundImage: `url(${cardData.coverImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                      : { backgroundColor: cardData.coverColor ?? undefined }
                  }
                />
              )}

              <div className="px-8 pt-6 pb-6 space-y-4">
                {/* Close Button */}
                <DialogClose asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-6 right-6 h-10 w-10 p-0 rounded-lg opacity-70 hover:opacity-100 hover:bg-muted hover:scale-110 transition-all duration-200 ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <X className="h-5 w-5" />
                    <span className="sr-only">Close</span>
                  </Button>
                </DialogClose>

                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <button 
                    onClick={() => router.push(`/board/${boardId}`)}
                    className="hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200 hover:underline"
                  >
                    {cardData.list.title}
                  </button>
                  <ChevronRight className="h-3 w-3" />
                  <span className="text-slate-700 dark:text-slate-300">Card #{cardData.id.slice(-8)}</span>
                </div>

                {/* Title + Priority */}
                <div className="flex items-start gap-4">
                  {isEditingTitle ? (
                    <motion.div
                      initial={{ scale: 0.98 }}
                      animate={{ scale: 1 }}
                      className="flex-1"
                    >
                      <textarea
                        ref={titleInputRef}
                        aria-label="Card title"
                        value={title}
                        onChange={(e) => {
                          setTitle(e.target.value);
                          e.currentTarget.style.height = 'auto';
                          e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                        }}
                        onBlur={onSaveTitle}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            onSaveTitle();
                          }
                          if (e.key === 'Escape') {
                            setTitle(cardData.title);
                            setIsEditingTitle(false);
                          }
                        }}
                        rows={1}
                        className="w-full text-3xl font-semibold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 outline-none resize-none border-2 border-purple-500 shadow-lg shadow-purple-500/20 ring-4 ring-purple-100 dark:ring-purple-900/30"
                      />
                    </motion.div>
                  ) : (
                    <motion.button
                      onClick={() => setIsEditingTitle(true)}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className="flex-1 text-left text-3xl font-semibold text-slate-900 dark:text-slate-100 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl px-4 py-3 transition-all duration-200 group cursor-text"
                    >
                      {title}
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-slate-400">✎</span>
                    </motion.button>
                  )}

                  {cardData.priority && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 shadow-sm",
                            priorityConfig[cardData.priority].color,
                            priorityConfig[cardData.priority].text
                          )}
                        >
                          <span className="text-lg">{priorityConfig[cardData.priority].icon}</span>
                          {priorityConfig[cardData.priority].label}
                        </motion.button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-48">
                        <DropdownMenuItem onClick={() => handlePriorityChange("URGENT")} className="cursor-pointer">
                          <span className="mr-2">⚠</span> Urgent
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handlePriorityChange("HIGH")} className="cursor-pointer">
                          <span className="mr-2">↑</span> High
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handlePriorityChange("MEDIUM")} className="cursor-pointer">
                          <span className="mr-2">—</span> Medium
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handlePriorityChange("LOW")} className="cursor-pointer">
                          <span className="mr-2">↓</span> Low
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <Clock className="h-4 w-4" />
                  <span>Created {new Date(cardData.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  <span>•</span>
                  <span>Updated {new Date(cardData.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
              </div>
            </motion.div>

            {/* ACTION BAR */}
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="px-8 py-5 border-b border-slate-200 dark:border-slate-700"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <ErrorBoundary fallback={<Button variant="outline" size="sm" disabled>Labels</Button>}>
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <LabelManager
                      cardId={cardData.id}
                      orgId={organizationId}
                      availableLabels={orgLabels}
                      cardLabels={cardLabels}
                      onLabelsChange={refreshCardData}
                    />
                  </motion.div>
                </ErrorBoundary>
                
                <ErrorBoundary fallback={<Button variant="outline" size="sm" disabled>Assign</Button>}>
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <AssigneePicker
                      cardId={cardData.id}
                      orgId={organizationId}
                      currentAssignee={cardData.assignee || null}
                      availableUsers={orgMembers}
                      onAssigneeChange={refreshCardData}
                    />
                  </motion.div>
                </ErrorBoundary>

                <ErrorBoundary fallback={<Button variant="outline" size="sm" disabled>Due Date</Button>}>
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <SmartDueDate
                      dueDate={cardData.dueDate}
                      onDateChange={handleDueDateChange}
                      priority={cardData.priority}
                      animated
                      editable
                    />
                  </motion.div>
                </ErrorBoundary>

                {/* Cover picker */}
                <Popover>
                  <PopoverTrigger asChild>
                    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "h-9 gap-2 text-xs font-medium transition-all",
                          (cardData.coverColor || cardData.coverImageUrl)
                            ? "border-purple-300 text-purple-700 dark:border-purple-600 dark:text-purple-300"
                            : ""
                        )}
                      >
                        <ImageIcon className="h-3.5 w-3.5" />
                        Cover
                      </Button>
                    </motion.div>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-4" align="start">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-3">Card Cover</p>
                    <CardCoverPicker
                      currentColor={cardData.coverColor}
                      currentImage={cardData.coverImageUrl}
                      onSelect={handleCoverChange}
                    />
                  </PopoverContent>
                </Popover>

                <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button variant="outline" size="sm" className="h-9 w-9 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      toast.success("Link copied");
                    }} className="cursor-pointer">
                      <Copy className="h-4 w-4 mr-2" />
                      Copy link
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600 cursor-pointer">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete card
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </motion.div>

            {/* TAB NAVIGATION */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.15 }}
                className="border-b border-slate-200 dark:border-slate-700 px-8"
              >
                <TabsList className="h-14 bg-transparent p-0 gap-2 w-full justify-start">
                  <TabsTrigger 
                    value="description" 
                    className="relative h-14 rounded-none border-b-[3px] border-transparent data-[state=active]:border-purple-500 data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-100 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium px-4"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Description
                  </TabsTrigger>
                  <TabsTrigger 
                    value="activity"
                    className="relative h-14 rounded-none border-b-[3px] border-transparent data-[state=active]:border-purple-500 data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-100 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium px-4"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Activity
                    {auditLogs.length > 0 && (
                      <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                        {auditLogs.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="comments"
                    className="relative h-14 rounded-none border-b-[3px] border-transparent data-[state=active]:border-purple-500 data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-100 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium px-4"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Comments
                    {comments.length > 0 && (
                      <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                        {comments.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="attachments"
                    className="relative h-14 rounded-none border-b-[3px] border-transparent data-[state=active]:border-purple-500 data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-100 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium px-4"
                  >
                    <Paperclip className="h-4 w-4 mr-2" />
                    Files
                    {attachments.length > 0 && (
                      <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                        {attachments.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="checklists"
                    className="relative h-14 rounded-none border-b-[3px] border-transparent data-[state=active]:border-purple-500 data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-100 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium px-4"
                  >
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Checklist
                    {checklists.length > 0 && (
                      <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                        {checklists.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="time"
                    className="relative h-14 rounded-none border-b-[3px] border-transparent data-[state=active]:border-violet-500 data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-100 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium px-4"
                  >
                    <Timer className="h-4 w-4 mr-2" />
                    Time
                  </TabsTrigger>
                  <TabsTrigger
                    value="dependencies"
                    className="relative h-14 rounded-none border-b-[3px] border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-100 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium px-4"
                  >
                    <Link2 className="h-4 w-4 mr-2" />
                    Links
                  </TabsTrigger>
                  <TabsTrigger
                    value="fields"
                    className="relative h-14 rounded-none border-b-[3px] border-transparent data-[state=active]:border-teal-500 data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-100 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium px-4"
                  >
                    <Settings2 className="h-4 w-4 mr-2" />
                    Fields
                  </TabsTrigger>
                </TabsList>
              </motion.div>

              <div className="overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-900/50">
                <TabsContent value="description" className="mt-0 p-8 space-y-6">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key="description-content"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      {(cardLabels.length > 0 || cardData.assignee) && (
                        <div className="flex items-center gap-4 mb-6">
                          <CardLabels labels={cardLabels} />
                          <CardAssignee assignee={cardData.assignee || null} />
                        </div>
                      )}
                      
                      <ErrorBoundary
                        fallback={
                          <div className="p-6 text-center bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl">
                            <AlertCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
                            <p className="text-sm text-red-800 dark:text-red-200">Editor unavailable. Refresh to try again.</p>
                          </div>
                        }
                      >
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                          <RichTextEditor
                            content={cardData.description || ""}
                            onSave={handleSaveDescription}
                            placeholder="Add a detailed description..."
                            editable
                            minHeight="200px"
                            showToolbar
                            enableAutoSave
                            characterLimit={10000}
                          />
                        </div>
                        {!cardData.description && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-3 px-1">
                            <span className="opacity-70">💡 Type</span>
                            <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs border border-slate-200 dark:border-slate-700">/</kbd>
                            <span className="opacity-70">for commands</span>
                          </div>
                        )}
                      </ErrorBoundary>
                    </motion.div>
                  </AnimatePresence>
                </TabsContent>

                <TabsContent value="activity" className="mt-0 p-8">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key="activity-content"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Activity items={auditLogs} />
                    </motion.div>
                  </AnimatePresence>
                </TabsContent>

                <TabsContent value="comments" className="mt-0 p-8">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key="comments-content"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ErrorBoundary
                        fallback={
                          <div className="p-6 text-center bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl">
                            <AlertCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
                            <p className="text-sm text-red-800 dark:text-red-200">Comments unavailable. Refresh to try again.</p>
                          </div>
                        }
                      >
                        {user && (
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
                          />
                        )}
                      </ErrorBoundary>
                    </motion.div>
                  </AnimatePresence>
                </TabsContent>

                {/* ATTACHMENTS TAB */}
                <TabsContent value="attachments" className="mt-0 p-8">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key="attachments-content"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      {cardData && (
                        <ErrorBoundary fallback={<p className="text-sm text-muted-foreground">Unable to load attachments.</p>}>
                          <FileAttachment
                            cardId={cardData.id}
                            boardId={boardId}
                            initialAttachments={attachments}
                          />
                        </ErrorBoundary>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </TabsContent>

                {/* CHECKLISTS TAB */}
                <TabsContent value="checklists" className="mt-0 p-8">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key="checklists-content"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      {cardData && (
                        <ErrorBoundary fallback={<p className="text-sm text-muted-foreground">Unable to load checklists.</p>}>
                          <ChecklistPanel
                            cardId={cardData.id}
                            boardId={boardId}
                            initialChecklists={checklists}
                          />
                        </ErrorBoundary>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </TabsContent>

                {/* TIME TRACKING TAB */}
                <TabsContent value="time" className="mt-0 p-8">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key="time-content"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      {cardData && (
                        <ErrorBoundary fallback={<p className="text-sm text-muted-foreground">Unable to load time tracking.</p>}>
                          <TimeTrackingPanel
                            cardId={cardData.id}
                            currentUserId={user?.id}
                          />
                        </ErrorBoundary>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </TabsContent>

                {/* DEPENDENCIES TAB */}
                <TabsContent value="dependencies" className="mt-0 p-8">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key="dependencies-content"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      {cardData && (
                        <ErrorBoundary fallback={<p className="text-sm text-muted-foreground">Unable to load dependencies.</p>}>
                          <DependencyPanel cardId={cardData.id} />
                        </ErrorBoundary>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </TabsContent>

                {/* CUSTOM FIELDS TAB */}
                <TabsContent value="fields" className="mt-0 p-6 pt-4">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key="fields-content"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      {cardData && boardId && (
                        <ErrorBoundary fallback={<p className="text-sm text-muted-foreground">Unable to load custom fields.</p>}>
                          <CustomFieldsPanel
                            boardId={boardId}
                            cardId={cardData.id}
                            isAdmin={membership?.role === "org:admin"}
                          />
                        </ErrorBoundary>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </TabsContent>
              </div>
            </Tabs>

            {/* FOOTER */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="border-t border-slate-200 dark:border-slate-700 px-8 py-4 bg-white dark:bg-slate-900"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-6">
                  <span className="text-slate-500 dark:text-slate-400">
                    {charCount.toLocaleString()} / 10,000 characters
                  </span>
                  <KeyboardShortcutsModal />
                </div>
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2"
                >
                  {saveStatus === "saving" && (
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                      <span>Saving...</span>
                    </div>
                  )}
                  {saveStatus === "saved" && (
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>All changes saved</span>
                    </div>
                  )}
                  {saveStatus === "error" && (
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-medium">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <span>Failed to save</span>
                    </div>
                  )}
                </motion.div>
              </div>
            </motion.div>

          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
