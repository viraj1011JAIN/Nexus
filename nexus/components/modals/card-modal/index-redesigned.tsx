"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, AuditLog, List, Label, Priority } from "@prisma/client";
import {
  ChevronRight,
  MoreHorizontal,
  Copy,
  Trash2,
  MessageSquare,
  Clock,
  AlertCircle,
  FileText,
  X,
  Calendar,
  Tag,
  User,
  AlignLeft,
} from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { getOrganizationLabels, getCardLabels } from "@/actions/label-actions";
import { getOrganizationMembers } from "@/actions/assignee-actions";
import {
  updateCardPriority,
  setDueDate,
  clearDueDate,
  createComment,
  updateComment,
  deleteComment,
  addReaction,
  removeReaction,
} from "@/actions/phase3-actions";
import { ErrorBoundary } from "@/components/error-boundary-realtime";
import { motion, AnimatePresence } from "framer-motion";
import type { CardLabel } from "@/hooks/use-optimistic-card";

/* ─────────────────────────── types ─────────────────────────── */

type CardWithRelations = Card & {
  list: List;
  assignee?: {
    id: string;
    name: string;
    imageUrl: string | null;
  } | null;
};

/* ─────────────────────── priority config ───────────────────── */

const priorityConfig = {
  URGENT: {
    label: "Urgent",
    color: "bg-gradient-to-r from-red-500 to-red-600",
    text: "text-white",
    icon: "⚠",
  },
  HIGH: {
    label: "High",
    color: "bg-gradient-to-r from-orange-400 to-orange-500",
    text: "text-white",
    icon: "↑",
  },
  MEDIUM: {
    label: "Medium",
    color: "bg-amber-50 dark:bg-amber-900/20",
    text: "text-amber-700 dark:text-amber-400",
    icon: "—",
  },
  LOW: {
    label: "Low",
    color: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-600 dark:text-slate-400",
    icon: "↓",
  },
};

/* ─────────────────────────── modal ─────────────────────────── */

export const CardModal = () => {
  const params = useParams();
  const router = useRouter();

  const organizationId = params.organizationId as string;
  const boardId = params.boardId as string;

  const id = useCardModal((state) => state.id);
  const isOpen = useCardModal((state) => state.isOpen);
  const onClose = useCardModal((state) => state.onClose);

  const [cardData, setCardData] = useState<CardWithRelations | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [title, setTitle] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  const [orgLabels, setOrgLabels] = useState<Label[]>([]);
  const [cardLabels, setCardLabels] = useState<CardLabel[]>([]);
  const [orgMembers, setOrgMembers] = useState<
    Array<{ id: string; name: string; imageUrl: string | null; email: string }>
  >([]);
  const [comments, setComments] = useState<Comment[]>([]);

  const { user } = useUser();
  const titleInputRef = useRef<HTMLTextAreaElement>(null);

  /* ── fetch on open ── */
  useEffect(() => {
    if (id && isOpen) {
      const fetchData = async () => {
        const card = await getCard(id);
        if (card) {
          setCardData(card as CardWithRelations);
          setTitle(card.title);

          if (organizationId) {
            const [labels, cardLabelsList, members] = await Promise.all([
              getOrganizationLabels(organizationId),
              getCardLabels(id),
              getOrganizationMembers(organizationId),
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

  /* ── auto-focus title input ── */
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  /* ── handlers ── */
  const onSaveTitle = async () => {
    if (!cardData) return;
    if (title.trim() === cardData.title.trim()) {
      setIsEditingTitle(false);
      return;
    }
    const result = await updateCard({ boardId, id: cardData.id, title });
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
    const result = await updateCard({ boardId, id: cardData.id, description: html });
    if (result.error) {
      throw new Error(result.error);
    }
    setCardData({ ...cardData, description: html });
  };

  const refreshCardData = async () => {
    if (!id) return;
    const [card, logs, cardLabelsList] = await Promise.all([
      getCard(id),
      getAuditLogs(id),
      getCardLabels(id),
    ]);
    if (card) {
      setCardData(card as CardWithRelations);
      setAuditLogs(logs);
      setCardLabels(cardLabelsList);
    }
  };

  const handlePriorityChange = async (priority: Priority) => {
    if (!cardData) return;
    const result = await updateCardPriority({
      id: cardData.id,
      boardId,
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
        boardId,
        dueDate: date.toISOString(),
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setCardData({ ...cardData, dueDate: date });
      toast.success("Due date set");
    } else {
      const result = await clearDueDate({ id: cardData.id, boardId });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setCardData({ ...cardData, dueDate: null });
      toast.success("Due date cleared");
    }
  };

  const handleCreateComment = async (text: string, parentId: string | null = null) => {
    if (!cardData || !user) return;
    const result = await createComment({
      cardId: cardData.id,
      boardId,
      text,
      parentId,
      mentions: [],
      isDraft: false,
    });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    if (result.data) setComments((prev) => [...prev, result.data as Comment]);
  };

  const handleUpdateComment = async (commentId: string, text: string) => {
    if (!cardData) return;
    const result = await updateComment({ id: commentId, boardId, text });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, text } : c)));
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!cardData) return;
    const result = await deleteComment({ id: commentId, boardId });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  const handleAddReaction = async (commentId: string, emoji: string) => {
    if (!cardData || !user) return;
    const result = await addReaction({ commentId, boardId, emoji });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    if (result.data) {
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, reactions: [...c.reactions, result.data as any] }
            : c
        )
      );
    }
  };

  const handleRemoveReaction = async (reactionId: string) => {
    if (!cardData) return;
    const result = await removeReaction({ id: reactionId, boardId });
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
      <DialogContent className="w-full sm:max-w-[95vw] lg:max-w-[1100px] xl:max-w-[1200px] h-[92vh] p-0 gap-0 bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-900/50 overflow-hidden">
        <DialogTitle className="sr-only">Card Details</DialogTitle>

        {!cardData ? (
          <div className="flex items-center justify-center h-full">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Loading card...</p>
            </motion.div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row h-full">
            
            {/* ═══════════════════ MAIN CONTENT - 65% ═══════════════════ */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden lg:border-r lg:border-slate-200 dark:lg:border-slate-700">
              
              {/* Header with breadcrumb */}
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex-shrink-0 px-6 lg:px-8 pt-6 pb-4 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <button 
                      onClick={() => router.push(`/board/${boardId}`)}
                      className="text-slate-500 hover:text-purple-600 dark:text-slate-400 dark:hover:text-purple-400 transition-colors hover:underline"
                    >
                      {cardData.list.title}
                    </button>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
                    <span className="text-slate-600 dark:text-slate-300">#{cardData.id.slice(-8)}</span>
                  </div>
                  <DialogClose asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors lg:hidden"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </DialogClose>
                </div>
              </motion.div>

              {/* Scrollable content */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                <div className="px-6 lg:px-8 py-6 space-y-8">
                  
                  {/* Title */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    {isEditingTitle ? (
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
                        className="w-full text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 rounded-xl px-4 py-3 outline-none resize-none border-2 border-purple-500 shadow-lg shadow-purple-500/10 ring-4 ring-purple-100 dark:ring-purple-900/20"
                      />
                    ) : (
                      <button
                        onClick={() => setIsEditingTitle(true)}
                        className="w-full text-left text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100 hover:text-purple-700 dark:hover:text-purple-300 transition-colors cursor-text group py-1"
                      >
                        {title}
                        <span className="opacity-0 group-hover:opacity-60 transition-opacity ml-2 text-base text-slate-400 font-normal align-middle">
                          Click to edit
                        </span>
                      </button>
                    )}
                  </motion.div>

                  {/* Labels & Assignee chips */}
                  {(cardLabels.length > 0 || cardData.assignee) && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                      className="flex items-center gap-2 flex-wrap"
                    >
                      <CardLabels labels={cardLabels} />
                      <CardAssignee assignee={cardData.assignee || null} />
                    </motion.div>
                  )}

                  {/* Description Section */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                      <AlignLeft className="h-4 w-4" />
                      <span>Description</span>
                    </div>
                    
                    <ErrorBoundary
                      fallback={
                        <div className="p-6 text-center bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl">
                          <AlertCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
                          <p className="text-sm text-red-800 dark:text-red-200">Editor unavailable</p>
                        </div>
                      }
                    >
                      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                        <RichTextEditor
                          content={cardData.description || ""}
                          onSave={handleSaveDescription}
                          placeholder="Add a more detailed description..."
                          editable
                          minHeight="200px sm:280px lg:380px"
                          maxHeight="600px"
                          showToolbar
                          enableAutoSave
                          characterLimit={10000}
                        />
                      </div>
                    </ErrorBoundary>
                  </motion.div>

                  {/* Activity Section */}
                  {auditLogs.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 }}
                      className="space-y-3"
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                        <MessageSquare className="h-4 w-4" />
                        <span>Activity</span>
                        <Badge variant="secondary" className="ml-1">
                          {auditLogs.length}
                        </Badge>
                      </div>
                      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <Activity items={auditLogs.slice(0, 5)} />
                        {auditLogs.length > 5 && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 text-center">
                            +{auditLogs.length - 5} more activities
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* Comments Section */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="space-y-3 pb-6"
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                      <MessageSquare className="h-4 w-4" />
                      <span>Comments</span>
                      {comments.length > 0 && (
                        <Badge variant="secondary" className="ml-1">
                          {comments.length}
                        </Badge>
                      )}
                    </div>
                    
                    <ErrorBoundary
                      fallback={
                        <div className="p-6 text-center bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl">
                          <AlertCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
                          <p className="text-sm text-red-800 dark:text-red-200">Comments unavailable</p>
                        </div>
                      }
                    >
                      {user && (
                        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
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
                        </div>
                      )}
                    </ErrorBoundary>
                  </motion.div>
                </div>
              </div>
            </div>

            {/* ═══════════════════ SIDEBAR - 35% ═══════════════════ */}
            <motion.aside 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="w-full lg:w-[340px] xl:w-[380px] flex-shrink-0 bg-white dark:bg-slate-900 flex flex-col border-t lg:border-t-0 border-slate-200 dark:border-slate-700"
            >
              {/* Sidebar header */}
              <div className="flex-shrink-0 px-6 py-5 border-b border-slate-200/60 dark:border-slate-700/60 hidden lg:flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Card Details</h3>
                <DialogClose asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </DialogClose>
              </div>

              {/* Scrollable sidebar content */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-5 space-y-6">
                
                {/* Add to card section */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Add to Card
                  </p>
                  
                  <div className="space-y-2">
                    {/* Priority */}
                    {cardData.priority && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium text-sm transition-all shadow-sm hover:shadow",
                              priorityConfig[cardData.priority].color,
                              priorityConfig[cardData.priority].text
                            )}
                          >
                            <span className="text-base">{priorityConfig[cardData.priority].icon}</span>
                            <span>Priority: {priorityConfig[cardData.priority].label}</span>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                          {(["URGENT", "HIGH", "MEDIUM", "LOW"] as Priority[]).map((p) => (
                            <DropdownMenuItem
                              key={p}
                              onClick={() => handlePriorityChange(p)}
                              className="cursor-pointer"
                            >
                              <span className="mr-2 text-base">{priorityConfig[p].icon}</span>
                              {priorityConfig[p].label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}

                    {/* Labels */}
                    <ErrorBoundary fallback={<Button variant="outline" size="sm" disabled className="w-full justify-start gap-2"><Tag className="h-4 w-4" />Labels</Button>}>
                      <LabelManager
                        cardId={cardData.id}
                        orgId={organizationId}
                        availableLabels={orgLabels}
                        cardLabels={cardLabels}
                        onLabelsChange={refreshCardData}
                      />
                    </ErrorBoundary>

                    {/* Assignee */}
                    <ErrorBoundary fallback={<Button variant="outline" size="sm" disabled className="w-full justify-start gap-2"><User className="h-4 w-4" />Assign</Button>}>
                      <AssigneePicker
                        cardId={cardData.id}
                        orgId={organizationId}
                        currentAssignee={cardData.assignee || null}
                        availableUsers={orgMembers}
                        onAssigneeChange={refreshCardData}
                      />
                    </ErrorBoundary>

                    {/* Due Date */}
                    <ErrorBoundary fallback={<Button variant="outline" size="sm" disabled className="w-full justify-start gap-2"><Calendar className="h-4 w-4" />Due Date</Button>}>
                      <SmartDueDate
                        dueDate={cardData.dueDate}
                        onDateChange={handleDueDateChange}
                        priority={cardData.priority}
                        animated
                        editable
                      />
                    </ErrorBoundary>
                  </div>
                </div>

                {/* Details section */}
                <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Details
                  </p>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="text-xs">Created</span>
                      <span className="ml-auto text-slate-900 dark:text-slate-100 font-medium">
                        {new Date(cardData.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="text-xs">Updated</span>
                      <span className="ml-auto text-slate-900 dark:text-slate-100 font-medium">
                        {new Date(cardData.updatedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions section */}
                <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Actions
                  </p>
                  
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        toast.success("Link copied to clipboard");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                      Copy link
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 dark:text-red-400 dark:hover:bg-red-950/20"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete card
                    </Button>
                  </div>
                </div>
              </div>
            </motion.aside>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
