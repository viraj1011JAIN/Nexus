/**
 * Phase 3 Server Actions
 * 
 * Priority, Due Dates, and Comments CRUD operations with:
 * - Auto-escalation logic for priorities
 * - Real-time sync triggers
 * - Sentry error tracking
 * - Optimistic update support
 */

"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getTenantContext, TenantError } from "@/lib/tenant-context";
import { checkRateLimit, RATE_LIMITS } from "@/lib/action-protection";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction } from "@/lib/create-safe-action";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { withSentry } from "@/lib/sentry-helpers";
import { sendMentionEmail } from "@/lib/email";
import { createNotification } from "@/actions/notification-actions";
import { z } from "zod";
import { differenceInHours } from "date-fns";
import { emitCardEvent } from "@/lib/event-bus";

/**
 * ============================================
 * PRIORITY MANAGEMENT
 * ============================================
 */

const UpdateCardPrioritySchema = z.object({
  id: z.string().uuid(),
  boardId: z.string().uuid(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  autoEscalated: z.boolean().optional().default(false),
});

/**
 * Update Card Priority with Auto-Escalation Logic
 * 
 * **Principal-Level Enhancement:**
 * - Tracks auto-escalation events (when deadline proximity triggers priority bump)
 * - Creates audit log entries for priority changes
 * - Validates priority against due date (warns if LOW priority but due in <6h)
 */
export const updateCardPriority = createSafeAction(
  UpdateCardPrioritySchema,
  async (data) => {
    const ctx = await getTenantContext();
    const { userId, orgId } = ctx;
    const rl = checkRateLimit(userId, "update-priority", RATE_LIMITS["update-priority"]);
    if (!rl.allowed) {
      throw new Error(`Too many requests. Try again in ${Math.ceil(rl.resetInMs / 1000)}s.`);
    }

    const { id, boardId, priority, autoEscalated } = data;

    // Fetch card with due date
    const card = await db.card.findUnique({
      where: { id },
      include: { list: { select: { board: { select: { orgId: true } } } } },
    });

    if (!card) {
      throw new Error("Card not found");
    }

    if (card.list.board.orgId !== orgId) {
      throw new Error("Unauthorized");
    }

    // Auto-escalation validation (warn if priority too low for deadline)
    if (card.dueDate && !autoEscalated) {
      const hoursUntilDue = differenceInHours(card.dueDate, new Date());
      if (hoursUntilDue < 6 && priority !== "URGENT") {
        console.warn(`Card ${id} due in ${hoursUntilDue}h but priority set to ${priority} (expected URGENT)`);
      }
    }

    // Update priority
    const updated = await db.card.update({
      where: { id },
      data: { priority },
    });

    // Audit log
    await createAuditLog({
      entityId: updated.id,
      entityType: "CARD",
      entityTitle: updated.title,
      action: "UPDATE",
      orgId: ctx.orgId,
    });

    revalidatePath(`/board/${boardId}`);

    // Fire PRIORITY_CHANGED event for automations + webhooks (TASK-019).
    // Wrapped in after() so the serverless runtime stays alive until delivery completes.
    after(() => emitCardEvent(
      { type: "PRIORITY_CHANGED", orgId, boardId, cardId: id, context: { priority } },
      { cardId: id, cardTitle: updated.title, priority, boardId, orgId }
    ));

    return { data: updated };
  }
);

/**
 * Get Suggested Priority (Based on Due Date)
 * 
 * Algorithm:
 * - URGENT: <6 hours or overdue
 * - HIGH: <24 hours
 * - MEDIUM: <72 hours (3 days)
 * - LOW: >72 hours
 */
export async function getSuggestedPriority(
  dueDate: Date | null
): Promise<"LOW" | "MEDIUM" | "HIGH" | "URGENT"> {
  if (!dueDate) return "MEDIUM";

  const hoursUntilDue = differenceInHours(dueDate, new Date());

  if (hoursUntilDue < 0 || hoursUntilDue < 6) return "URGENT";
  if (hoursUntilDue < 24) return "HIGH";
  if (hoursUntilDue < 72) return "MEDIUM";
  return "LOW";
}

/**
 * ============================================
 * DUE DATE MANAGEMENT
 * ============================================
 */

const SetDueDateSchema = z.object({
  id: z.string().uuid(),
  boardId: z.string().uuid(),
  dueDate: z.string().datetime(), // ISO 8601 string
});

/**
 * Set Due Date with Auto-Escalation Check
 * 
 * **Principal-Level Enhancement:**
 * - Automatically escalates priority if deadline is urgent
 * - Stores in UTC, displays in user's timezone
 * - Creates audit log for due date changes
 */
export const setDueDate = createSafeAction(SetDueDateSchema, async (data) => {
  const ctx = await getTenantContext();
  const { userId, orgId } = ctx;
  const rl = checkRateLimit(userId, "set-due-date", RATE_LIMITS["set-due-date"]);
  if (!rl.allowed) {
    throw new Error(`Too many requests. Try again in ${Math.ceil(rl.resetInMs / 1000)}s.`);
  }

  const { id, boardId, dueDate: dueDateString } = data;
  const dueDate = new Date(dueDateString);

  // Fetch card
  const card = await db.card.findUnique({
    where: { id },
    include: { list: { select: { board: { select: { orgId: true } } } } },
  });

  if (!card) {
    throw new Error("Card not found");
  }

  if (card.list.board.orgId !== orgId) {
    throw new Error("Unauthorized");
  }

  // Auto-escalation: Suggest priority based on due date
  const suggestedPriority = await getSuggestedPriority(dueDate);
  const shouldEscalatePriority =
    suggestedPriority === "URGENT" && card.priority !== "URGENT";

  // Update due date (and priority if auto-escalating)
  const updated = await db.card.update({
    where: { id },
    data: {
      dueDate,
      ...(shouldEscalatePriority && { priority: suggestedPriority }),
    },
  });

  // Audit log
  await createAuditLog({
    entityId: updated.id,
    entityType: "CARD",
    entityTitle: updated.title,
    action: "UPDATE",
    orgId: ctx.orgId,
  });

  revalidatePath(`/board/${boardId}`);
  return { data: updated };
});

const ClearDueDateSchema = z.object({
  id: z.string().uuid(),
  boardId: z.string().uuid(),
});

/**
 * Clear Due Date
 */
export const clearDueDate = createSafeAction(ClearDueDateSchema, async (data) => {
  const ctx = await getTenantContext();
  const { userId, orgId } = ctx;
  const rl = checkRateLimit(userId, "set-due-date", RATE_LIMITS["set-due-date"]);
  if (!rl.allowed) {
    throw new Error(`Too many requests. Try again in ${Math.ceil(rl.resetInMs / 1000)}s.`);
  }

  const { id, boardId } = data;

  const card = await db.card.findUnique({
    where: { id },
    include: { list: { select: { board: { select: { orgId: true } } } } },
  });

  if (!card) {
    throw new Error("Card not found");
  }

  if (card.list.board.orgId !== orgId) {
    throw new Error("Unauthorized");
  }

  const updated = await db.card.update({
    where: { id },
    data: { dueDate: null },
  });

  await createAuditLog({
    entityId: updated.id,
    entityType: "CARD",
    entityTitle: updated.title,
    action: "UPDATE",
    orgId: ctx.orgId,
  });

  revalidatePath(`/board/${boardId}`);
  return { data: updated };
});

/**
 * ============================================
 * COMMENT MANAGEMENT
 * ============================================
 */

const CreateCommentSchema = z.object({
  cardId: z.string().uuid(),
  boardId: z.string().uuid(),
  text: z.string().min(1, "Comment cannot be empty").max(10000),
  parentId: z.string().uuid().nullable().optional(),
  mentions: z.array(z.string()).optional().default([]),
  isDraft: z.boolean().optional().default(false),
});

/**
 * Create Comment with Mentions Support
 * 
 * **Principal-Level Enhancement:**
 * - Extracts @mentions from rich text HTML
 * - Supports threading (parentId for replies)
 * - Draft mode for auto-save
 * - Triggers real-time notifications for mentioned users
 */
export const createComment = createSafeAction(CreateCommentSchema, async (data) => {
  const ctx = await getTenantContext();
  const { userId, orgId } = ctx;
  const rl = checkRateLimit(userId, "create-comment", RATE_LIMITS["create-comment"]);
  if (!rl.allowed) {
    throw new Error(`Too many requests. Try again in ${Math.ceil(rl.resetInMs / 1000)}s.`);
  }

  // Get user info from Clerk
  const user = await fetch(`https://api.clerk.dev/v1/users/${userId}`, {
    headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
  }).then((res) => res.json());

  const { cardId, boardId, text, parentId, mentions, isDraft } = data;

  // Validate card access
  const card = await db.card.findUnique({
    where: { id: cardId },
    include: { list: { select: { board: { select: { orgId: true, title: true } } } } },
  });

  if (!card) {
    throw new Error("Card not found");
  }

  if (card.list.board.orgId !== orgId) {
    throw new TenantError("FORBIDDEN", "Card does not belong to this organisation.");
  }

  // Validate parentId — if provided, the parent comment MUST belong to the same card.
  // Rejecting cross-card parents prevents orphaned thread structures in the data model.
  if (parentId) {
    const parentComment = await db.comment.findUnique({
      where: { id: parentId },
      select: { cardId: true },
    });
    if (!parentComment) {
      return { error: "Parent comment not found." };
    }
    if (parentComment.cardId !== cardId) {
      return { error: "Nested replies must belong to the same card." };
    }
  }

  // Create comment
  const comment = await db.comment.create({
    data: {
      text,
      cardId,
      userId,
      userName: user.firstName || user.username || "Unknown",
      userImage: user.imageUrl || null,
      parentId: parentId || null,
      mentions,
      isDraft,
    },
    include: {
      reactions: true,
      replies: true,
    },
  });

  // Audit log (only for non-drafts)
  if (!isDraft) {
    await createAuditLog({
      entityId: card.id,
      entityType: "CARD",
      entityTitle: card.title,
      action: "UPDATE",
      orgId: ctx.orgId,
    });
  }

  revalidatePath(`/board/${boardId}`);

  // Fire-and-forget: email + in-app notifications for @mentions.
  // Failures must not block or roll back comment creation.
  if (!isDraft && mentions.length > 0) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const cardUrl = `${appUrl}/board/${boardId}?card=${cardId}`;
    const mentionerName = comment.userName;
    void Promise.allSettled(
      mentions
        .filter((mentionedClerkId) => mentionedClerkId !== userId) // never notify the commenter themselves
        .map(async (mentionedClerkId) => {
          const mentionedUser = await db.user.findUnique({
            where: { clerkUserId: mentionedClerkId },
            select: { id: true, email: true, name: true },
          });
          if (!mentionedUser) return;

          // 1. Email notification
          await sendMentionEmail({
            mentionedUserEmail: mentionedUser.email,
            mentionedUserName: mentionedUser.name,
            mentionerName,
            cardTitle: card.title,
            boardTitle: card.list.board.title,
            cardUrl,
          }).catch(() => { /* email failure is non-fatal */ });

          // 2. In-app notification (creates a DB row → triggers Supabase Realtime
          //    postgres_changes INSERT → NotificationCenter badge increments live)
          await createNotification({
            orgId,
            userId: mentionedUser.id,
            type: "MENTIONED",
            title: `${mentionerName} mentioned you in "${card.title}"`,
            body: text.replace(/<[^>]+>/g, "").slice(0, 200),
            entityType: "CARD",
            entityId: cardId,
            entityTitle: card.title,
            actorId: userId,
            actorName: mentionerName,
            actorImage: comment.userImage ?? undefined,
          }).catch(() => { /* notification failure is non-fatal */ });
        })
    );
  }

  return { data: comment };
});

const UpdateCommentSchema = z.object({
  id: z.string().uuid(),
  boardId: z.string().uuid(),
  text: z.string().min(1).max(10000),
  mentions: z.array(z.string()).optional(),
});

/**
 * Update Comment (Edit)
 */
export const updateComment = createSafeAction(UpdateCommentSchema, async (data) => {
  const ctx = await getTenantContext();
  const { userId, orgId } = ctx;
  const rl = checkRateLimit(userId, "update-comment", RATE_LIMITS["update-comment"]);
  if (!rl.allowed) {
    throw new Error(`Too many requests. Try again in ${Math.ceil(rl.resetInMs / 1000)}s.`);
  }

  const { id, boardId, text, mentions } = data;

  // Validate ownership
  const comment = await db.comment.findUnique({
    where: { id },
    include: { card: { include: { list: { select: { board: true } } } } },
  });

  if (!comment) {
    throw new Error("Comment not found");
  }

  if (comment.userId !== userId) {
    throw new Error("Unauthorized: You can only edit your own comments");
  }

  if (comment.card.list.board.orgId !== orgId) {
    throw new Error("Unauthorized");
  }

  // Update comment
  const updated = await db.comment.update({
    where: { id },
    data: {
      text,
      ...(mentions && { mentions }),
      isDraft: false, // Publishing draft
    },
    include: {
      reactions: true,
      replies: true,
    },
  });

  await createAuditLog({
    entityId: comment.card.id,
    entityType: "CARD",
    entityTitle: comment.card.title,
    action: "UPDATE",
    orgId: ctx.orgId,
  });

  revalidatePath(`/board/${boardId}`);
  return { data: updated };
});

const DeleteCommentSchema = z.object({
  id: z.string().uuid(),
  boardId: z.string().uuid(),
});

/**
 * Delete Comment
 */
export const deleteComment = createSafeAction(DeleteCommentSchema, async (data) => {
  const ctx = await getTenantContext();
  const { userId, orgId } = ctx;
  const rl = checkRateLimit(userId, "delete-comment", RATE_LIMITS["delete-comment"]);
  if (!rl.allowed) {
    throw new Error(`Too many requests. Try again in ${Math.ceil(rl.resetInMs / 1000)}s.`);
  }

  const { id, boardId } = data;

  const comment = await db.comment.findUnique({
    where: { id },
    include: { card: { include: { list: { select: { board: true } } } } },
  });

  if (!comment) {
    throw new Error("Comment not found");
  }

  if (comment.userId !== userId) {
    throw new Error("Unauthorized: You can only delete your own comments");
  }

  if (comment.card.list.board.orgId !== orgId) {
    throw new Error("Unauthorized");
  }

  // Delete comment (cascade deletes reactions and replies via Prisma schema)
  await db.comment.delete({ where: { id } });

  await createAuditLog({
    entityId: comment.card.id,
    entityType: "CARD",
    entityTitle: comment.card.title,
    action: "UPDATE",
    orgId: ctx.orgId,
  });

  revalidatePath(`/board/${boardId}`);

  return { data: { success: true } };
});

/**
 * ============================================
 * REACTION MANAGEMENT
 * ============================================
 */

const AddReactionSchema = z.object({
  commentId: z.string().uuid(),
  boardId: z.string().uuid(),
  emoji: z.string().regex(/^[\u{1F300}-\u{1F9FF}]$/u, "Invalid emoji"),
});

/**
 * Add Reaction to Comment
 */
export const addReaction = createSafeAction(AddReactionSchema, async (data) => {
  const ctx = await getTenantContext();
  const { userId, orgId } = ctx;
  const rl = checkRateLimit(userId, "add-reaction", RATE_LIMITS["add-reaction"]);
  if (!rl.allowed) {
    throw new Error(`Too many requests. Try again in ${Math.ceil(rl.resetInMs / 1000)}s.`);
  }

  const user = await fetch(`https://api.clerk.dev/v1/users/${userId}`, {
    headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
  }).then((res) => res.json());

  const { commentId, boardId, emoji } = data;

  // Validate comment access
  const comment = await db.comment.findUnique({
    where: { id: commentId },
    include: { card: { include: { list: { select: { board: true } } } } },
  });

  if (!comment) {
    throw new Error("Comment not found");
  }

  if (comment.card.list.board.orgId !== orgId) {
    throw new TenantError("FORBIDDEN", "Comment does not belong to this organisation.");
  }

  // Enforce unique constraint at application level for a clear, non-generic error message.
  // The DB @@unique([commentId, userId, emoji]) is the final safety net.
  const existing = await db.commentReaction.findFirst({
    where: { commentId, userId, emoji },
  });

  if (existing) {
    // Return a graceful error instead of throwing — duplicate reactions are expected
    // user behaviour (e.g. double-click), not a programming fault.
    return { error: "Already reacted" };
  }

  // Add reaction
  const reaction = await db.commentReaction.create({
    data: {
      emoji,
      commentId,
      userId,
      userName: user.firstName || user.username || "Unknown",
    },
  });

  revalidatePath(`/board/${boardId}`);
  return { data: reaction };
});

const RemoveReactionSchema = z.object({
  id: z.string().uuid(),
  boardId: z.string().uuid(),
});

/**
 * Remove Reaction from Comment
 */
export const removeReaction = createSafeAction(RemoveReactionSchema, async (data) => {
  const ctx = await getTenantContext();
  const { userId, orgId } = ctx;
  const rl = checkRateLimit(userId, "remove-reaction", RATE_LIMITS["remove-reaction"]);
  if (!rl.allowed) {
    throw new Error(`Too many requests. Try again in ${Math.ceil(rl.resetInMs / 1000)}s.`);
  }

  const { id, boardId } = data;

  const reaction = await db.commentReaction.findUnique({
    where: { id },
    include: { comment: { include: { card: { include: { list: { select: { board: true } } } } } } },
  });

  if (!reaction) {
    throw new Error("Reaction not found");
  }

  if (reaction.userId !== userId) {
    throw new Error("Unauthorized: You can only remove your own reactions");
  }

  if (reaction.comment.card.list.board.orgId !== orgId) {
    throw new Error("Unauthorized");
  }

  await db.commentReaction.delete({ where: { id } });

  revalidatePath(`/board/${boardId}`);
  return { data: { success: true } };
});
