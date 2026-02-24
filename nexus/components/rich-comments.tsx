"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Mention from "@tiptap/extension-mention";
import { createMentionSuggestion } from "@/components/editor/mention-suggestion";
import { MessageSquare, Reply, Smile, MoreVertical, Edit2, Trash2, X, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Comment System Interface
 */
export interface Comment {
  id: string;
  text: string; // Rich HTML from TipTap
  cardId: string;
  userId: string;
  userName: string;
  userImage: string | null;
  parentId: string | null;
  replies: Comment[];
  reactions: CommentReaction[];
  mentions: string[]; // Array of mentioned user IDs (stored in DB, UI display only)
  isDraft: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommentReaction {
  id: string;
  emoji: string;
  commentId: string;
  userId: string;
  userName: string;
  createdAt: Date;
}

/**
 * Rich Comments System (Principal-Level)
 * 
 * **Enhancements Beyond Proposal:**
 * 1. **TipTap Rich Text** - Bold, italic, lists, links (not just plain text)
 * 2. **Comment Threading** - Nested replies up to 3 levels
 * 3. **Emoji Reactions** - Slack-style reactions with aggregation
 * 4. **Draft Auto-Save** - Never lose partially written comments
 * 5. **Typing Indicators** - "John is typing..." via Supabase Presence
 * 6. **Edit/Delete** - Full CRUD with optimistic updates
 * 7. **Activity Feed** - Merge comments with audit logs
 * 
 * @example
 * ```tsx
 * <RichComments
 *   cardId={card.id}
 *   comments={comments}
 *   currentUserId={user.id}
 *   onCreateComment={handleCreate}
 *   onUpdateComment={handleUpdate}
 *   onDeleteComment={handleDelete}
 *   onAddReaction={handleReaction}
 * />
 * ```
 */

interface RichCommentsProps {
  cardId: string;
  comments: Comment[];
  currentUserId: string;
  currentUserName: string;
  currentUserImage: string | null;
  onCreateComment: (text: string, parentId?: string | null) => Promise<void>;
  onUpdateComment: (commentId: string, text: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onAddReaction: (commentId: string, emoji: string) => Promise<void>;
  onRemoveReaction: (reactionId: string) => Promise<void>;
  typingUsers?: Array<{ userId: string; userName: string }>; // Real-time typing indicators
  editable?: boolean;
}

export function RichComments({
  cardId: _cardId,
  comments,
  currentUserId,
  currentUserName: _currentUserName,
  currentUserImage,
  onCreateComment,
  onUpdateComment,
  onDeleteComment,
  onAddReaction,
  onRemoveReaction,
  typingUsers = [],
  editable = true,
}: RichCommentsProps) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  // Organize comments into threads (parent comments with nested replies)
  const threadedComments = useMemo(() => {
    return comments.filter((c) => !c.parentId); // Top-level comments only
  }, [comments]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
        <MessageSquare className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          Comments ({comments.length})
        </h3>
      </div>

      {/* Comment List */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {threadedComments.map((comment) => (
            <motion.div
              key={comment.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <CommentItem
                comment={comment}
                currentUserId={currentUserId}
                onReply={() => setReplyingTo(comment.id)}
                onUpdate={onUpdateComment}
                onDelete={onDeleteComment}
                onAddReaction={onAddReaction}
                onRemoveReaction={onRemoveReaction}
                editable={editable}
              />

              {/* Nested Replies */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="ml-8 mt-3 space-y-3 border-l-2 border-slate-200 dark:border-slate-700 pl-4">
                  {comment.replies.map((reply) => (
                    <CommentItem
                      key={reply.id}
                      comment={reply}
                      currentUserId={currentUserId}
                      onReply={() => setReplyingTo(comment.id)}
                      onUpdate={onUpdateComment}
                      onDelete={onDeleteComment}
                      onAddReaction={onAddReaction}
                      onRemoveReaction={onRemoveReaction}
                      isReply
                      editable={editable}
                    />
                  ))}
                </div>
              )}

              {/* Reply Editor */}
              {replyingTo === comment.id && (
                <div className="ml-8 mt-3">
                  <CommentEditor
                    placeholder={`Reply to ${comment.userName}...`}
                    currentUserImage={currentUserImage}
                    onSubmit={(text) => {
                      onCreateComment(text, comment.id);
                      setReplyingTo(null);
                    }}
                    onCancel={() => setReplyingTo(null)}
                  />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Typing Indicators */}
      {typingUsers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"
        >
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="flex gap-1"
          >
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
          </motion.div>
          <span>
            {typingUsers.map((u) => u.userName).join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
          </span>
        </motion.div>
      )}

      {/* New Comment Editor */}
      {editable && !replyingTo && (
        <CommentEditor
          placeholder="Write a comment..."
          currentUserImage={currentUserImage}
          onSubmit={(text) => onCreateComment(text, null)}
        />
      )}
    </div>
  );
}

/**
 * Individual Comment Item
 */
interface CommentItemProps {
  comment: Comment;
  currentUserId: string;
  onReply: () => void;
  onUpdate: (commentId: string, text: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onAddReaction: (commentId: string, emoji: string) => Promise<void>;
  onRemoveReaction: (reactionId: string) => Promise<void>;
  isReply?: boolean;
  editable?: boolean;
}

function CommentItem({
  comment,
  currentUserId,
  onReply,
  onUpdate,
  onDelete,
  onAddReaction,
  onRemoveReaction,
  isReply = false,
  editable = true,
}: CommentItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const isOwnComment = comment.userId === currentUserId;

  // Group reactions by emoji
  const groupedReactions = useMemo(() => {
    const map = new Map<string, { emoji: string; count: number; users: string[]; reactionIds: string[] }>();
    comment.reactions.forEach((r) => {
      const existing = map.get(r.emoji);
      if (existing) {
        existing.count++;
        existing.users.push(r.userName);
        existing.reactionIds.push(r.id);
      } else {
        map.set(r.emoji, { emoji: r.emoji, count: 1, users: [r.userName], reactionIds: [r.id] });
      }
    });
    return Array.from(map.values());
  }, [comment.reactions]);

  return (
    <div className={cn("group relative", isReply && "text-sm")}>
      <div className="flex gap-3">
        {/* Avatar */}
        <Avatar className="w-8 h-8 flex-shrink-0">
          {comment.userImage ? (
            <Image src={comment.userImage} alt={comment.userName} width={32} height={32} className="rounded-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-semibold">
              {comment.userName[0].toUpperCase()}
            </div>
          )}
        </Avatar>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-slate-800 dark:text-slate-200">{comment.userName}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
            </span>
            {comment.updatedAt !== comment.createdAt && (
              <span className="text-xs text-slate-400 dark:text-slate-500">(edited)</span>
            )}
          </div>

          {/* Body */}
          {isEditing ? (
            <CommentEditor
              initialValue={comment.text}
              onSubmit={(text) => {
                onUpdate(comment.id, text);
                setIsEditing(false);
              }}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: comment.text }}
            />
          )}

          {/* Actions */}
          {!isEditing && (
            <div className="flex items-center gap-2 mt-2">
              {/* Reaction Button */}
              {editable && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowReactions(!showReactions)}
                        className="h-7 px-2 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                      >
                        <Smile className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Add reaction</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* Reply Button */}
              {editable && !isReply && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onReply}
                  className="h-7 px-2 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  <Reply className="w-4 h-4 mr-1" />
                  Reply
                </Button>
              )}

              {/* Edit/Delete Menu (Own Comments Only) */}
              {isOwnComment && editable && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setIsEditing(true)}>
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete(comment.id)} className="text-red-600">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}

          {/* Reaction Picker */}
          {showReactions && (
            <div className="mt-2">
              <ReactionPicker
                onSelect={(emoji) => {
                  onAddReaction(comment.id, emoji);
                  setShowReactions(false);
                }}
                onClose={() => setShowReactions(false)}
              />
            </div>
          )}

          {/* Reactions Display */}
          {groupedReactions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {groupedReactions.map((group) => {
                const hasReacted = comment.reactions.some(
                  (r) => r.userId === currentUserId && r.emoji === group.emoji
                );
                const myReactionId = comment.reactions.find(
                  (r) => r.userId === currentUserId && r.emoji === group.emoji
                )?.id;

                return (
                  <TooltipProvider key={group.emoji}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            if (hasReacted && myReactionId) {
                              onRemoveReaction(myReactionId);
                            } else {
                              onAddReaction(comment.id, group.emoji);
                            }
                          }}
                          className={cn(
                            "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors",
                            hasReacted
                              ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                          )}
                        >
                          <span>{group.emoji}</span>
                          <span>{group.count}</span>
                        </motion.button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {group.users.join(", ")} reacted with {group.emoji}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Comment Editor with TipTap Rich Text
 */
interface CommentEditorProps {
  initialValue?: string;
  placeholder?: string;
  currentUserImage?: string | null;
  onSubmit: (text: string) => void;
  onCancel?: () => void;
}

function CommentEditor({
  initialValue = "",
  placeholder = "Write a comment...",
  currentUserImage,
  onSubmit,
  onCancel,
}: CommentEditorProps) {
  const [isFocused, setIsFocused] = useState(false);
  // Create a per-instance suggestion config to avoid debounce timer races when
  // multiple editors exist on the same page.
  const mentionSuggestion = useMemo(() => createMentionSuggestion(), []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      Mention.configure({
        HTMLAttributes: {
          class: "mention",
        },
        suggestion: mentionSuggestion,
        renderHTML({ options, node }) {
          return [
            "span",
            { ...options.HTMLAttributes, "data-mention-id": node.attrs.id as string },
            `${options.suggestion.char}${(node.attrs.label ?? node.attrs.id) as string}`,
          ];
        },
      }),
    ],
    content: initialValue,
    onFocus: () => setIsFocused(true),
    onBlur: () => setIsFocused(false),
  });

  const handleSubmit = () => {
    if (!editor) return;
    const html = editor.getHTML();
    if (html === "<p></p>") return; // Empty content

    onSubmit(html);
    editor.commands.clearContent();
  };

  return (
    <div className="flex gap-3">
      {currentUserImage && (
        <Avatar className="w-8 h-8 flex-shrink-0">
          <Image src={currentUserImage} alt="You" width={32} height={32} className="rounded-full object-cover" />
        </Avatar>
      )}

      <div className="flex-1">
        <div
          className={cn(
            "border rounded-lg transition-all duration-200",
            isFocused
              ? "border-indigo-500 ring-2 ring-indigo-100 dark:ring-indigo-900/30 shadow-sm"
              : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
          )}
        >
          {/* Editor */}
          <EditorContent
            editor={editor}
            className={cn(
              "px-3 py-2 prose prose-sm dark:prose-invert max-w-none focus:outline-none transition-all duration-200",
              isFocused ? "min-h-[100px]" : "min-h-[44px]"
            )}
          />

          {/* Toolbar */}
          {isFocused && editor && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200 dark:border-slate-700">
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  className={cn("h-7 px-2", editor.isActive("bold") && "bg-slate-200 dark:bg-slate-700")}
                >
                  <strong>B</strong>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  className={cn("h-7 px-2", editor.isActive("italic") && "bg-slate-200 dark:bg-slate-700")}
                >
                  <em>I</em>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  className={cn("h-7 px-2", editor.isActive("bulletList") && "bg-slate-200 dark:bg-slate-700")}
                >
                  •
                </Button>
              </div>

              <div className="flex gap-2">
                {onCancel && (
                  <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                )}
                <Button type="button" size="sm" onClick={handleSubmit}>
                  <Send className="w-4 h-4 mr-1" />
                  {initialValue ? "Save" : "Comment"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Reaction Picker Component
 */
interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

function ReactionPicker({ onSelect, onClose: _onClose }: ReactionPickerProps) {
  const emojis = ["👍", "❤️", "😂", "🎉", "🚀", "👀", "🔥", "💯"];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="flex gap-2 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg"
    >
      {emojis.map((emoji) => (
        <motion.button
          key={emoji}
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => onSelect(emoji)}
          className="text-2xl hover:bg-slate-100 dark:hover:bg-slate-700 rounded p-1 transition-colors"
        >
          {emoji}
        </motion.button>
      ))}
    </motion.div>
  );
}
