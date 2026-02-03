"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, AuditLog, List, Label, Comment as PrismaComment, Priority } from "@prisma/client";
import { 
  ChevronRight, 
  Pencil,
  FileText,
  MessageSquare,
  Keyboard,
  MoreHorizontal,
  Copy,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
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
import { PriorityBadge } from "@/components/priority-badge";
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
  const [activeTab, setActiveTab] = useState("description");
  const [titleFocused, setTitleFocused] = useState(false);
  
  const [orgLabels, setOrgLabels] = useState<Label[]>([]);
  const [cardLabels, setCardLabels] = useState<CardLabel[]>([]);
  const [orgMembers, setOrgMembers] = useState<Array<{ id: string; name: string; imageUrl: string | null; email: string }>>([]);
  
  const [comments, setComments] = useState<Comment[]>([]);
  const { user } = useUser();

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
        }
        fetchData();
    }
  }, [id, isOpen, organizationId]);

  const onSaveTitle = async () => {
    if (!cardData) return;
    if (title.trim() === cardData.title.trim()) return;

    const result = await updateCard({
      boardId: boardId,
      id: cardData.id,
      title: title
    });
    
    if (result.error) {
      toast.error(result.error);
      return;
    }

    setCardData({ ...cardData, title });
    toast.success("Title saved");
  };

  const handleSaveDescription = async (html: string) => {
    if (!cardData) return;

    const result = await updateCard({
      boardId: boardId,
      id: cardData.id,
      description: html
    });

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
      toast.success("Comment added");
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
    toast.success("Comment updated");
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
    toast.success("Comment deleted");
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
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0 overflow-hidden [&>button]:top-6 [&>button]:right-6 [&>button]:h-8 [&>button]:w-8 [&>button]:rounded-lg [&>button]:hover:bg-accent z-[9999]">
        <DialogTitle className="hidden">Card Details</DialogTitle>

        {!cardData ? (
          <div className="p-6 flex items-center justify-center">
            <div className="animate-pulse">Loading...</div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            
            {/* --- MODERN HEADER --- */}
            <div className="p-6 pb-4 space-y-3">
              {/* Breadcrumb Navigation */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <button 
                  onClick={() => router.push(`/board/${boardId}`)}
                  className="hover:text-foreground transition-colors"
                >
                  {cardData.list.title}
                </button>
                <ChevronRight className="h-3 w-3" />
                <span className="text-foreground">Card #{cardData.id.slice(-8)}</span>
              </div>

              {/* Inline Editable Title */}
              <div className="group relative">
                <textarea
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    e.currentTarget.style.height = 'auto';
                    e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                  }}
                  onBlur={() => {
                    setTitleFocused(false);
                    onSaveTitle();
                  }}
                  onFocus={() => setTitleFocused(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      e.currentTarget.blur();
                    }
                  }}
                  rows={1}
                  className={cn(
                    "w-full text-2xl font-semibold bg-transparent resize-none outline-none border-none",
                    "rounded-lg px-3 py-2 -mx-3 -my-2 transition-colors",
                    titleFocused && "bg-accent/50"
                  )}
                />
                <Pencil className={cn(
                  "absolute right-2 top-2 h-4 w-4 text-muted-foreground transition-opacity",
                  titleFocused ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )} />
              </div>

              {/* Metadata Row */}
              <div className="flex items-center gap-3 flex-wrap">
                {cardData.priority && (
                  <ErrorBoundary fallback={<div className="text-xs text-destructive">Priority unavailable</div>}>
                    <PriorityBadge
                      priority={cardData.priority}
                      dueDate={cardData.dueDate}
                      size="md"
                      animated
                    />
                  </ErrorBoundary>
                )}
                <div className="text-xs text-muted-foreground">
                  Created {new Date(cardData.createdAt).toLocaleDateString()} • Updated {new Date(cardData.updatedAt).toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* --- MODERN ACTION BUTTONS --- */}
            <div className="px-6 pb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <ErrorBoundary fallback={<Button variant="ghost" size="sm" disabled>Labels</Button>}>
                  <LabelManager
                    cardId={cardData.id}
                    orgId={organizationId}
                    availableLabels={orgLabels}
                    cardLabels={cardLabels}
                    onLabelsChange={refreshCardData}
                  />
                </ErrorBoundary>
                
                <ErrorBoundary fallback={<Button variant="ghost" size="sm" disabled>Assign</Button>}>
                  <AssigneePicker
                    cardId={cardData.id}
                    orgId={organizationId}
                    currentAssignee={cardData.assignee || null}
                    availableUsers={orgMembers}
                    onAssigneeChange={refreshCardData}
                  />
                </ErrorBoundary>

                <ErrorBoundary fallback={<Button variant="ghost" size="sm" disabled>Due Date</Button>}>
                  <SmartDueDate
                    dueDate={cardData.dueDate}
                    onDateChange={handleDueDateChange}
                    priority={cardData.priority}
                    animated
                    editable
                  />
                </ErrorBoundary>

                <Separator orientation="vertical" className="h-4" />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      toast.success("Card link copied to clipboard");
                    }}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy link
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete card
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* --- TAB NAVIGATION --- */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <div className="border-b px-6">
                <TabsList className="h-12 bg-transparent p-0 gap-6 w-full justify-start">
                  <TabsTrigger 
                    value="description" 
                    className="relative h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Description
                  </TabsTrigger>
                  <TabsTrigger 
                    value="activity"
                    className="relative h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Activity
                    {auditLogs.length > 0 && (
                      <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                        {auditLogs.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="comments"
                    className="relative h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Comments
                    {comments.length > 0 && (
                      <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                        {comments.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="overflow-y-auto flex-1" style={{ maxHeight: 'calc(90vh - 320px)' }}>
                <TabsContent value="description" className="mt-0 p-6 space-y-4">
                  {(cardLabels.length > 0 || cardData.assignee) && (
                    <div className="flex items-center gap-4">
                      <CardLabels labels={cardLabels} />
                      <CardAssignee assignee={cardData.assignee || null} />
                    </div>
                  )}
                  
                  <ErrorBoundary
                    fallback={
                      <div className="p-4 text-center bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded">
                        <p className="text-sm text-red-800 dark:text-red-200">Editor crashed. Refresh to try again.</p>
                      </div>
                    }
                  >
                    <div className="space-y-2">
                      <RichTextEditor
                        content={cardData.description || ""}
                        onSave={handleSaveDescription}
                        placeholder="Add a detailed description... Type / for commands"
                        editable
                        minHeight="250px"
                        showToolbar
                        enableAutoSave
                        characterLimit={10000}
                      />
                      {!cardData.description && (
                        <div className="text-xs text-muted-foreground flex items-center gap-2 px-1">
                          <span className="opacity-70">💡 Type</span>
                          <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">/</kbd>
                          <span className="opacity-70">for commands or paste a link</span>
                        </div>
                      )}
                    </div>
                  </ErrorBoundary>
                </TabsContent>

                <TabsContent value="activity" className="mt-0 p-6">
                  <Activity items={auditLogs} />
                </TabsContent>

                <TabsContent value="comments" className="mt-0 p-6">
                  <ErrorBoundary
                    fallback={
                      <div className="p-4 text-center bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded">
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
                </TabsContent>
              </div>
            </Tabs>

            {/* --- FOOTER WITH STATUS --- */}
            <div className="border-t px-6 py-3 bg-muted/30">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span>Character limit: 10,000</span>
                  <Button variant="ghost" size="sm" className="h-7 text-xs px-2 hover:bg-accent">
                    <Keyboard className="h-3 w-3 mr-1.5" />
                    Keyboard shortcuts
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-green-600">
                  ✓ All changes saved
                </div>
              </div>
            </div>

          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
